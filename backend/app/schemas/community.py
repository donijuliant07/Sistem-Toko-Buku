"""Skema Book Community: grup, keanggotaan, dan pesan.

Tiga lapis yang dibedakan tegas:

1. **Input** (`GroupCreate`, `MessageCreate`, ...) — divalidasi ketat di sini
   sebelum menyentuh service. `sender_id`, role, dan `created_at` **tidak
   pernah** diterima dari klien.
2. **Read** (`GroupSummary`, `MessageRead`, ...) — bentuk yang dikonsumsi
   frontend, selalu berisi data yang sudah diotorisasi service.
3. **Halaman** (`GroupPage`, `MessagePage`) — metadata paginasi.

Harga buku pada pesan `book` adalah harga **saat ini** (dibaca ulang dari
`books` saat pesan disajikan), bukan snapshot saat pesan dikirim.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.community import (
    GROUP_CATEGORIES,
    GROUP_VISIBILITIES,
    MEMBER_ROLES,
)

MAX_GROUP_NAME = 80
MAX_GROUP_DESCRIPTION = 1000
MAX_MESSAGE_LENGTH = 2000


class GroupCategory(str, Enum):
    """Kategori grup. Dibekukan di sini dan di CHECK constraint tabel."""

    MANGA_ANIME = "manga_anime"
    BUSINESS_STARTUP = "business_startup"
    SELF_IMPROVEMENT = "self_improvement"
    FANTASY_FICTION = "fantasy_fiction"
    TECHNOLOGY = "technology"
    BOOK_CLUB = "book_club"
    GENERAL = "general"


class GroupVisibility(str, Enum):
    """Publik dapat ditemukan dan diikuti; privat hanya lewat penambahan anggota."""

    PUBLIC = "public"
    PRIVATE = "private"


class MemberRole(str, Enum):
    """Role keanggotaan per grup."""

    OWNER = "owner"
    MODERATOR = "moderator"
    MEMBER = "member"


class MessageType(str, Enum):
    """Jenis pesan; `book` selalu membawa `book_id`."""

    TEXT = "text"
    BOOK = "book"


def _clean_required(value: str, *, field: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError(f"{field} tidak boleh kosong")
    return value


class GroupCreate(BaseModel):
    """Payload pembuatan grup. Hanya admin yang boleh mengirim ini."""

    name: str = Field(min_length=3, max_length=MAX_GROUP_NAME)
    description: str = Field(default="", max_length=MAX_GROUP_DESCRIPTION)
    category: GroupCategory
    visibility: GroupVisibility = GroupVisibility.PUBLIC

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        return _clean_required(value, field="Nama grup")

    @field_validator("description")
    @classmethod
    def _strip_description(cls, value: str) -> str:
        return value.strip()


class GroupUpdate(BaseModel):
    """Perubahan metadata grup oleh owner/admin. Minimal satu field harus diisi."""

    name: str | None = Field(default=None, min_length=3, max_length=MAX_GROUP_NAME)
    description: str | None = Field(default=None, max_length=MAX_GROUP_DESCRIPTION)
    category: GroupCategory | None = None
    avatar_url: str | None = None  # <-- 1. TAMBAHKAN KOLOM INI

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str | None) -> str | None:
        return _clean_required(value, field="Nama grup") if value is not None else None

    @field_validator("description")
    @classmethod
    def _strip_description(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None

    @field_validator("avatar_url")
    @classmethod
    def _strip_avatar_url(cls, value: str | None) -> str | None:
        if value is not None:
            value = value.strip()
            return value if value else None
        return None

    @model_validator(mode="after")
    def _require_change(self) -> "GroupUpdate":
        # 2. UPDATE VALIDATOR INI AGAR AVATAR_URL DIPERHITUNGKAN
        if (
            self.name is None
            and self.description is None
            and self.category is None
            and self.avatar_url is None
        ):
            raise ValueError("Tidak ada perubahan yang dikirim")
        return self


class GroupSummary(BaseModel):
    """Satu baris daftar grup beserta status keanggotaan pemanggil."""

    id: UUID
    name: str
    description: str
    category: GroupCategory
    visibility: GroupVisibility
    avatar_url: str | None = None
    member_count: int = 0
    is_member: bool = False
    my_role: MemberRole | None = None
    created_at: datetime


class GroupPage(BaseModel):
    """Halaman daftar grup (offset pagination; daftar grup berukuran kecil)."""

    items: list[GroupSummary]
    total: int
    page: int
    page_size: int


class GroupDetail(GroupSummary):
    """Detail grup; `can_*` dihitung backend agar UI tidak menebak izin."""

    created_by: UUID
    can_manage_group: bool = False
    can_manage_members: bool = False
    can_send: bool = False


class MemberProfile(BaseModel):
    """Profil ringkas untuk daftar anggota dan pencarian tambah anggota."""

    id: UUID
    username: str | None = None
    full_name: str | None = None
    avatar_url: str | None = None


class GroupMemberRead(BaseModel):
    """Anggota grup dengan role-nya di grup ini."""

    user: MemberProfile
    role: MemberRole
    joined_at: datetime


class MemberAddRequest(BaseModel):
    """Tambahkan pengguna ke grup berdasarkan id (pilihan dari hasil pencarian)."""

    user_id: UUID


class MemberRoleUpdate(BaseModel):
    """Ubah role anggota. `owner` sengaja tidak boleh di-set lewat sini."""

    role: MemberRole

    @model_validator(mode="after")
    def _forbid_owner(self) -> "MemberRoleUpdate":
        if self.role is MemberRole.OWNER:
            raise ValueError("Kepemilikan dipindahkan lewat endpoint transfer-owner")
        return self


class TransferOwnerRequest(BaseModel):
    """Pindahkan kepemilikan grup ke anggota lain."""

    user_id: UUID


class UserSearchResult(MemberProfile):
    """Hasil pencarian pengguna untuk dialog tambah anggota."""


class MessageCreate(BaseModel):
    """Payload pengiriman pesan.

    `client_message_id` dibuat klien agar retry aman: pengiriman ulang dengan id
    yang sama mengembalikan pesan yang sudah ada, bukan membuat pesan baru.
    """

    message_type: MessageType = MessageType.TEXT
    content: str = Field(default="", max_length=MAX_MESSAGE_LENGTH)
    book_id: UUID | None = None
    #: Balasan: pesan teks yang menunjuk pesan lain di grup yang sama.
    parent_message_id: UUID | None = None
    client_message_id: UUID | None = None

    @model_validator(mode="after")
    def _validate_shape(self) -> "MessageCreate":
        if self.message_type is MessageType.TEXT:
            if self.book_id is not None:
                raise ValueError("Pesan teks tidak boleh menyertakan book_id")
            if not self.content.strip():
                raise ValueError("Pesan tidak boleh kosong")
            self.content = self.content.strip()
        else:
            if self.book_id is None:
                raise ValueError("Pesan buku wajib menyertakan book_id")
            if self.parent_message_id is not None:
                raise ValueError("Pesan buku tidak boleh menjadi balasan")
            if self.content.strip():
                raise ValueError("Pesan buku tidak boleh berisi teks")
            self.content = ""
        return self


class MessageSender(BaseModel):
    """Pengirim pesan; dari profil yang sudah ada."""

    id: UUID
    username: str | None = None
    full_name: str | None = None
    avatar_url: str | None = None


class SharedBook(BaseModel):
    """Kartu buku di dalam chat — data terkini dari katalog."""

    id: UUID
    title: str
    author: str
    price: Decimal
    cover_url: str | None = None


class MessageRead(BaseModel):
    """Satu pesan yang sudah disajikan ke frontend."""

    id: UUID
    group_id: UUID
    message_type: MessageType
    content: str
    sender: MessageSender
    book: SharedBook | None = None
    parent_message_id: UUID | None = None
    client_message_id: UUID | None = None
    created_at: datetime
    #: `none` = tidak diajukan untuk reward kontribusi (perilaku lama).
    moderation_status: str = "none"
    #: Jumlah anggota lain yang menandai pesan ini "membantu".
    helpful_count: int = 0
    #: Apakah pemanggil sudah menandainya "membantu".
    helpful_by_me: bool = False


class MessageModeration(BaseModel):
    """Keputusan moderator atas usulan reward kontribusi sebuah pesan."""

    status: str = Field(..., pattern="^(approved|rejected)$")
    reason: str | None = Field(default=None, max_length=255)


class HelpfulResult(BaseModel):
    """Hasil tanda "membantu" (idempoten: menekan ulang hitungannya tetap)."""

    message_id: UUID
    helpful_count: int
    helpful_by_me: bool
    created: bool



class MessagePage(BaseModel):
    """Satu halaman pesan, selalu **kronologis** (lama → baru)."""

    items: list[MessageRead]
    #: Kursor untuk memuat pesan lebih lama; `None` bila sudah tidak ada lagi.
    next_cursor: str | None = None


class DeleteResult(BaseModel):
    """Hasil aksi yang tidak mengembalikan entitas."""

    id: UUID


#: Dipakai test untuk memastikan enum skema sama dengan CHECK di model/migrasi.
assert tuple(category.value for category in GroupCategory) == GROUP_CATEGORIES
assert tuple(visibility.value for visibility in GroupVisibility) == GROUP_VISIBILITIES
assert tuple(role.value for role in MemberRole) == MEMBER_ROLES
