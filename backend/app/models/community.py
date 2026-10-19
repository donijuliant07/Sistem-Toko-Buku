"""Model tabel Book Community: grup, keanggotaan, dan pesan.

Satu file untuk tiga tabel karena ketiganya selalu dipakai bersama dan
dipisahnya hanya akan menambah impor tanpa manfaat.

Keputusan penting:

- `created_by` dan `sender_id` merujuk `auth.users`, sama seperti `profiles`:
  Supabase Auth adalah sumber identitas.
- `role` keanggotaan **per grup** (`owner`/`moderator`/`member`), terpisah dari
  `profiles.role` global (`user`/`admin`) yang hanya mengatur siapa boleh
  membuat grup dan siapa yang mendapat hak moderasi lintas grup.
- Pesan `text` menyimpan teks tervalidasi; pesan `book` menyimpan `book_id` dan
  **tidak** menyalin judul/harga — data buku dibaca ulang saat pesan disajikan.
"""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

#: Kategori tetap. Ditulis ulang di migrasi `20261019_10` (migrasi harus tetap
#: bisa dijalankan walau kode berubah) dan diikat oleh test.
GROUP_CATEGORIES = (
    "manga_anime",
    "business_startup",
    "self_improvement",
    "fantasy_fiction",
    "technology",
    "book_club",
    "general",
)

GROUP_VISIBILITIES = ("public", "private")

MEMBER_ROLES = ("owner", "moderator", "member")

MESSAGE_TYPES = ("text", "book")

_CATEGORY_CHECK = ", ".join(f"'{value}'" for value in GROUP_CATEGORIES)
_VISIBILITY_CHECK = ", ".join(f"'{value}'" for value in GROUP_VISIBILITIES)
_ROLE_CHECK = ", ".join(f"'{value}'" for value in MEMBER_ROLES)
_TYPE_CHECK = ", ".join(f"'{value}'" for value in MESSAGE_TYPES)


class ChatGroup(Base):
    """Satu ruang diskusi komunitas."""

    __tablename__ = "chat_groups"
    __table_args__ = (
        CheckConstraint(f"category IN ({_CATEGORY_CHECK})", name="ck_chat_groups_category"),
        CheckConstraint(
            f"visibility IN ({_VISIBILITY_CHECK})", name="ck_chat_groups_visibility"
        ),
        CheckConstraint(
            "char_length(btrim(name)) BETWEEN 3 AND 80", name="ck_chat_groups_name_len"
        ),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("''")
    )
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    visibility: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default=text("'public'")
    )
    # Disiapkan untuk foto grup; UI saat ini memakai inisial + warna kategori.
    avatar_url: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="RESTRICT", use_alter=True),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=text("now()")
    )


class ChatGroupMember(Base):
    """Keanggotaan satu pengguna di satu grup beserta role-nya."""

    __tablename__ = "chat_group_members"
    __table_args__ = (
        CheckConstraint(f"role IN ({_ROLE_CHECK})", name="ck_chat_group_members_role"),
        {"schema": "public"},
    )

    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.chat_groups.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="CASCADE", use_alter=True),
        primary_key=True,
    )
    role: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=text("'member'")
    )
    joined_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=text("now()")
    )


class ChatMessage(Base):
    """Pesan di sebuah grup. Append-only; hapus dilakukan lewat `deleted_at`."""

    __tablename__ = "chat_messages"
    __table_args__ = (
        CheckConstraint(f"message_type IN ({_TYPE_CHECK})", name="ck_chat_messages_type"),
        CheckConstraint(
            "(message_type = 'text' AND book_id IS NULL "
            "AND char_length(btrim(content)) BETWEEN 1 AND 2000) "
            "OR (message_type = 'book' AND book_id IS NOT NULL AND content = '')",
            name="ck_chat_messages_shape",
        ),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.chat_groups.id", ondelete="CASCADE"),
        nullable=False,
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="CASCADE", use_alter=True),
        nullable=False,
    )
    message_type: Mapped[str] = mapped_column(
        String(8), nullable=False, server_default=text("'text'")
    )
    content: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))
    book_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.books.id", ondelete="SET NULL"),
    )
    # Diisi klien; (group_id, sender_id, client_message_id) unik sehingga retry
    # pengiriman tidak menghasilkan pesan ganda.
    client_message_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=text("now()")
    )
    deleted_at: Mapped[datetime | None] = mapped_column()


__all__ = [
    "GROUP_CATEGORIES",
    "GROUP_VISIBILITIES",
    "MEMBER_ROLES",
    "MESSAGE_TYPES",
    "ChatGroup",
    "ChatGroupMember",
    "ChatMessage",
]
