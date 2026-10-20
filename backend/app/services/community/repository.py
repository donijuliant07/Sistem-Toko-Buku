"""Repository ORM untuk Book Community.

Tiga repository, satu `AsyncSession` per permintaan:

- `OrmGroupRepository` — daftar/pencarian, detail, pembuatan (grup + owner dalam
  satu transaksi), perubahan metadata, dan penghapusan.
- `OrmMemberRepository` — keanggotaan, role, pencarian pengguna, dan transfer
  kepemilikan.
- `OrmMessageRepository` — halaman pesan dengan keyset pagination, penyisipan
  idempoten, dan soft delete.

Semua penulisan memakai `flush()`/`commit()` di sini; service tidak pernah
memegang SQL. Baris ORM dikembalikan sebagai dataclass netral supaya model
tidak bocor ke layer API.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.book import Book
from app.models.community import (
    ChatGroup,
    ChatGroupMember,
    ChatMessage,
    ChatMessageHelpfulMark,
)
from app.models.profile import Profile


@dataclass
class GroupRow:
    """Satu grup beserta jumlah anggota dan role pemanggil (bila anggota)."""

    group: ChatGroup
    member_count: int
    my_role: str | None


@dataclass
class MemberRow:
    """Keanggotaan yang sudah digabung dengan profil pengguna."""

    user_id: UUID
    role: str
    joined_at: datetime
    username: str | None
    full_name: str | None
    avatar_url: str | None


@dataclass
class MessageRow:
    """Pesan beserta pengirim dan buku terkait (bila tipe `book`)."""

    message: ChatMessage
    sender: Profile | None
    book: Book | None


class OrmGroupRepository:
    """Akses tabel `chat_groups` lewat sesi milik permintaan."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def commit(self) -> None:
        """Komit satu unit kerja (dipanggil service setelah operasi tulis)."""
        await self._db.commit()

    async def rollback(self) -> None:
        """Batalkan unit kerja setelah pelanggaran constraint."""
        await self._db.rollback()

    def _member_count_subquery(self) -> Any:
        return (
            select(func.count())
            .select_from(ChatGroupMember)
            .where(ChatGroupMember.group_id == ChatGroup.id)
            .scalar_subquery()
        )

    def _my_role_subquery(self, user_id: UUID) -> Any:
        return (
            select(ChatGroupMember.role)
            .where(
                ChatGroupMember.group_id == ChatGroup.id,
                ChatGroupMember.user_id == user_id,
            )
            .scalar_subquery()
        )

    async def list_page(
        self,
        *,
        user_id: UUID,
        is_admin: bool,
        q: str | None,
        category: str | None,
        only_mine: bool,
        page: int,
        page_size: int,
    ) -> tuple[list[GroupRow], int]:
        """Halaman grup yang boleh dilihat pemanggil.

        Grup privat hanya muncul untuk anggotanya; admin global melihat semua.
        `only_mine` mempersempit ke grup yang diikuti, untuk siapa pun.
        """
        my_role = self._my_role_subquery(user_id)
        filters = []
        if only_mine:
            filters.append(my_role.is_not(None))
        elif not is_admin:
            filters.append(or_(ChatGroup.visibility == "public", my_role.is_not(None)))
        if q:
            term = f"%{q.strip()}%"
            filters.append(
                or_(ChatGroup.name.ilike(term), ChatGroup.description.ilike(term))
            )
        if category:
            filters.append(ChatGroup.category == category)

        total = (
            await self._db.execute(
                select(func.count()).select_from(ChatGroup).where(*filters)
            )
        ).scalar_one()

        stmt = (
            select(
                ChatGroup,
                self._member_count_subquery().label("member_count"),
                my_role.label("my_role"),
            )
            .where(*filters)
            .order_by(ChatGroup.created_at.desc(), ChatGroup.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = (await self._db.execute(stmt)).all()
        return [
            GroupRow(group=row[0], member_count=row[1] or 0, my_role=row[2])
            for row in rows
        ], total

    async def get(self, group_id: UUID, *, user_id: UUID) -> GroupRow | None:
        """Satu grup beserta jumlah anggota dan role pemanggil."""
        stmt = select(
            ChatGroup,
            self._member_count_subquery().label("member_count"),
            self._my_role_subquery(user_id).label("my_role"),
        ).where(ChatGroup.id == group_id)
        row = (await self._db.execute(stmt)).first()
        if row is None:
            return None
        return GroupRow(group=row[0], member_count=row[1] or 0, my_role=row[2])

    async def get_for_update(self, group_id: UUID) -> ChatGroup | None:
        """Kunci baris grup untuk operasi yang mengubah keanggotaan."""
        stmt = select(ChatGroup).where(ChatGroup.id == group_id).with_for_update()
        return (await self._db.execute(stmt)).scalar_one_or_none()

    async def name_exists(self, name: str, *, exclude_id: UUID | None = None) -> bool:
        """Apakah nama grup (case-insensitive) sudah dipakai."""
        stmt = select(func.count()).select_from(ChatGroup).where(
            func.lower(func.btrim(ChatGroup.name)) == name.strip().lower()
        )
        if exclude_id is not None:
            stmt = stmt.where(ChatGroup.id != exclude_id)
        return (await self._db.execute(stmt)).scalar_one() > 0

    async def create(
        self,
        *,
        name: str,
        description: str,
        category: str,
        visibility: str,
        created_by: UUID,
    ) -> ChatGroup:
        """Buat grup dan daftarkan pembuatnya sebagai owner.

        Keduanya memakai sesi yang sama; `commit()` baru dilakukan setelah
        keduanya siap, sehingga tidak ada grup tanpa owner.
        """
        group = ChatGroup(
            name=name,
            description=description,
            category=category,
            visibility=visibility,
            created_by=created_by,
        )
        self._db.add(group)
        await self._db.flush()
        self._db.add(
            ChatGroupMember(group_id=group.id, user_id=created_by, role="owner")
        )
        await self._db.flush()
        return group

    async def update(self, group: ChatGroup, changes: dict[str, Any]) -> ChatGroup:
        """Terapkan perubahan metadata yang sudah divalidasi service."""
        for field, value in changes.items():
            setattr(group, field, value)
        await self._db.flush()
        return group

    async def delete(self, group_id: UUID) -> None:
        """Hapus grup; keanggotaan dan pesan ikut terhapus lewat ON DELETE CASCADE."""
        group = await self._db.get(ChatGroup, group_id)
        if group is not None:
            await self._db.delete(group)
            await self._db.flush()


class OrmMemberRepository:
    """Akses tabel `chat_group_members` dan profil pengguna."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get(self, group_id: UUID, user_id: UUID) -> ChatGroupMember | None:
        """Keanggotaan satu pengguna di satu grup."""
        stmt = select(ChatGroupMember).where(
            ChatGroupMember.group_id == group_id,
            ChatGroupMember.user_id == user_id,
        )
        return (await self._db.execute(stmt)).scalar_one_or_none()

    async def list(self, group_id: UUID) -> list[MemberRow]:
        """Anggota grup, owner lebih dulu, lalu nama."""
        stmt = (
            select(ChatGroupMember, Profile)
            .outerjoin(Profile, Profile.id == ChatGroupMember.user_id)
            .where(ChatGroupMember.group_id == group_id)
            .order_by(
                func.array_position(
                    func.array(["owner", "moderator", "member"]),
                    ChatGroupMember.role,
                ),
                Profile.full_name,
                ChatGroupMember.user_id,
            )
        )
        rows = (await self._db.execute(stmt)).all()
        return [
            MemberRow(
                user_id=member.user_id,
                role=member.role,
                joined_at=member.joined_at,
                username=profile.username if profile else None,
                full_name=profile.full_name if profile else None,
                avatar_url=profile.avatar_url if profile else None,
            )
            for member, profile in rows
        ]

    async def find_users(self, q: str, *, limit: int = 10) -> list[Profile]:
        """Cari profil berdasarkan username atau nama (case-insensitive)."""
        term = f"%{q.strip()}%"
        stmt = (
            select(Profile)
            .where(or_(Profile.username.ilike(term), Profile.full_name.ilike(term)))
            .order_by(Profile.full_name, Profile.username)
            .limit(limit)
        )
        return list((await self._db.execute(stmt)).scalars().all())

    async def get_profile(self, user_id: UUID) -> Profile | None:
        """Profil satu pengguna; `None` bila belum punya baris profil."""
        return await self._db.get(Profile, user_id)

    async def add(self, group_id: UUID, user_id: UUID, role: str = "member") -> bool:
        """Tambahkan anggota; `False` bila sudah menjadi anggota (idempoten)."""
        stmt = (
            pg_insert(ChatGroupMember)
            .values(group_id=group_id, user_id=user_id, role=role)
            .on_conflict_do_nothing(index_elements=["group_id", "user_id"])
            .returning(ChatGroupMember.user_id)
        )
        inserted = (await self._db.execute(stmt)).scalar_one_or_none()
        await self._db.flush()
        return inserted is not None

    async def remove(self, group_id: UUID, user_id: UUID) -> bool:
        """Hapus anggota; `False` bila bukan anggota."""
        member = await self.get(group_id, user_id)
        if member is None:
            return False
        await self._db.delete(member)
        await self._db.flush()
        return True

    async def set_role(self, group_id: UUID, user_id: UUID, role: str) -> None:
        """Ubah role anggota yang sudah ada."""
        await self._db.execute(
            update(ChatGroupMember)
            .where(
                ChatGroupMember.group_id == group_id,
                ChatGroupMember.user_id == user_id,
            )
            .values(role=role)
        )
        await self._db.flush()

    async def transfer_owner(
        self, group_id: UUID, current_owner: UUID, new_owner: UUID
    ) -> None:
        """Pindahkan kepemilikan: owner lama jadi moderator, owner baru jadi owner.

        Urutan ini penting: unique partial index hanya mengizinkan satu owner per
        grup, jadi owner lama harus diturunkan lebih dulu.
        """
        await self.set_role(group_id, current_owner, "moderator")
        await self.set_role(group_id, new_owner, "owner")


class OrmMessageRepository:
    """Akses tabel `chat_messages`."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def list_page(
        self,
        group_id: UUID,
        *,
        before: tuple[datetime, UUID] | None,
        limit: int,
    ) -> tuple[list[MessageRow], bool]:
        """Ambil satu halaman pesan (terbaru dulu) dan tanda `has_more`.

        Keyset `(created_at, id)` dipakai, bukan offset: pesan baru yang masuk
        saat pengguna memuat halaman lama tidak menggeser hasil.
        """
        filters = [
            ChatMessage.group_id == group_id,
            ChatMessage.deleted_at.is_(None),
        ]
        if before is not None:
            created_at, message_id = before
            filters.append(
                or_(
                    ChatMessage.created_at < created_at,
                    and_(
                        ChatMessage.created_at == created_at,
                        ChatMessage.id < message_id,
                    ),
                )
            )
        stmt = (
            select(ChatMessage, Profile, Book)
            .outerjoin(Profile, Profile.id == ChatMessage.sender_id)
            .outerjoin(Book, Book.id == ChatMessage.book_id)
            .where(*filters)
            .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
            .limit(limit + 1)
        )
        rows = (await self._db.execute(stmt)).all()
        has_more = len(rows) > limit
        rows = rows[:limit]
        return [
            MessageRow(message=row[0], sender=row[1], book=row[2]) for row in rows
        ], has_more

    async def get(self, message_id: UUID) -> ChatMessage | None:
        """Satu pesan (termasuk yang sudah di-soft-delete)."""
        return await self._db.get(ChatMessage, message_id)

    async def book_exists(self, book_id: UUID) -> bool:
        """Apakah `book_id` merujuk buku yang ada (untuk 404 sebelum insert)."""
        stmt = select(Book.id).where(Book.id == book_id)
        return (await self._db.execute(stmt)).scalar_one_or_none() is not None

    async def find_by_client_id(
        self, group_id: UUID, sender_id: UUID, client_message_id: UUID
    ) -> MessageRow | None:
        """Pesan yang sudah tersimpan untuk `client_message_id` yang sama."""
        stmt = (
            select(ChatMessage, Profile, Book)
            .outerjoin(Profile, Profile.id == ChatMessage.sender_id)
            .outerjoin(Book, Book.id == ChatMessage.book_id)
            .where(
                ChatMessage.group_id == group_id,
                ChatMessage.sender_id == sender_id,
                ChatMessage.client_message_id == client_message_id,
            )
        )
        row = (await self._db.execute(stmt)).first()
        if row is None:
            return None
        return MessageRow(message=row[0], sender=row[1], book=row[2])

    async def get_row(self, message_id: UUID) -> MessageRow | None:
        """Satu pesan beserta pengirim dan bukunya."""
        stmt = (
            select(ChatMessage, Profile, Book)
            .outerjoin(Profile, Profile.id == ChatMessage.sender_id)
            .outerjoin(Book, Book.id == ChatMessage.book_id)
            .where(ChatMessage.id == message_id)
        )
        row = (await self._db.execute(stmt)).first()
        if row is None:
            return None
        return MessageRow(message=row[0], sender=row[1], book=row[2])

    async def insert(
        self,
        *,
        group_id: UUID,
        sender_id: UUID,
        message_type: str,
        content: str,
        book_id: UUID | None,
        client_message_id: UUID | None,
    ) -> tuple[UUID, bool]:
        """Sisipkan pesan; `(id, True)` bila baru, `(id, False)` bila retry.

        `ON CONFLICT DO NOTHING` membuat pengiriman ulang dengan
        `client_message_id` yang sama tidak menghasilkan baris kedua. Bila
        konflik, baris yang sudah ada dibaca dan dikembalikan.
        """
        stmt = (
            pg_insert(ChatMessage)
            .values(
                group_id=group_id,
                sender_id=sender_id,
                message_type=message_type,
                content=content,
                book_id=book_id,
                client_message_id=client_message_id,
            )
            .on_conflict_do_nothing()
            .returning(ChatMessage.id)
        )
        inserted = (await self._db.execute(stmt)).scalar_one_or_none()
        if inserted is not None:
            await self._db.flush()
            return inserted, True

        if client_message_id is None:  # pragma: no cover - tidak mungkin tanpa konflik
            raise RuntimeError("Pesan gagal disimpan tanpa client_message_id.")
        existing = await self.find_by_client_id(
            group_id, sender_id, client_message_id
        )
        if existing is None:  # pragma: no cover - konflik selain idempotensi
            raise RuntimeError("Pesan gagal disimpan.")
        return existing.message.id, False

    async def soft_delete(self, message_id: UUID) -> None:
        """Tandai pesan terhapus tanpa membuang barisnya."""
        await self._db.execute(
            update(ChatMessage)
            .where(ChatMessage.id == message_id)
            .values(deleted_at=func.now())
        )
        await self._db.flush()


@dataclass
class MessageInteraction:
    """Hitungan interaksi untuk satu pesan (tanda "membantu")."""

    helpful_count: int
    helpful_by_me: bool


class OrmMessageInteractionRepository:
    """Pesan lanjutan, balasan, dan tanda "membantu".

    Dipisah dari `OrmMessageRepository` supaya jalur baca/ kirim yang sudah
    stabil tidak ikut berubah; tabelnya (`chat_message_helpful_marks`) dan
    kolom `parent_message_id`/`moderation_status` berasal dari migrasi
    `20261019_11`.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get(self, message_id: UUID) -> ChatMessage | None:
        return await self._db.get(ChatMessage, message_id)

    async def insert_reply(
        self,
        *,
        group_id: UUID,
        sender_id: UUID,
        content: str,
        parent_message_id: UUID,
        client_message_id: UUID | None,
    ) -> tuple[UUID, bool]:
        """Sisipkan balasan teks; idempoten lewat `client_message_id`."""
        stmt = (
            pg_insert(ChatMessage)
            .values(
                group_id=group_id,
                sender_id=sender_id,
                message_type="text",
                content=content,
                parent_message_id=parent_message_id,
                client_message_id=client_message_id,
            )
            .on_conflict_do_nothing()
            .returning(ChatMessage.id)
        )
        inserted = (await self._db.execute(stmt)).scalar_one_or_none()
        if inserted is not None:
            await self._db.flush()
            return inserted, True

        if client_message_id is None:  # pragma: no cover - tidak mungkin tanpa konflik
            raise RuntimeError("Balasan gagal disimpan tanpa client_message_id.")
        existing = (
            await self._db.execute(
                select(ChatMessage.id).where(
                    ChatMessage.group_id == group_id,
                    ChatMessage.sender_id == sender_id,
                    ChatMessage.client_message_id == client_message_id,
                )
            )
        ).scalar_one_or_none()
        if existing is None:  # pragma: no cover - konflik selain idempotensi
            raise RuntimeError("Balasan gagal disimpan.")
        return existing, False

    async def set_moderation_status(self, message_id: UUID, *, status: str) -> None:
        await self._db.execute(
            update(ChatMessage)
            .where(ChatMessage.id == message_id)
            .values(moderation_status=status)
        )
        await self._db.flush()

    async def add_helpful(self, message_id: UUID, user_id: UUID) -> bool:
        """Tandai "membantu"; `False` bila pengguna sudah menandainya."""
        stmt = (
            pg_insert(ChatMessageHelpfulMark)
            .values(message_id=message_id, user_id=user_id)
            .on_conflict_do_nothing(
                index_elements=["message_id", "user_id"]
            )
            .returning(ChatMessageHelpfulMark.message_id)
        )
        inserted = (await self._db.execute(stmt)).scalar_one_or_none()
        await self._db.flush()
        return inserted is not None

    async def count_helpful(self, message_id: UUID) -> int:
        return (
            await self._db.execute(
                select(func.count())
                .select_from(ChatMessageHelpfulMark)
                .where(ChatMessageHelpfulMark.message_id == message_id)
            )
        ).scalar_one()

    async def is_helpful(self, message_id: UUID, user_id: UUID) -> bool:
        return (
            await self._db.execute(
                select(ChatMessageHelpfulMark.message_id).where(
                    ChatMessageHelpfulMark.message_id == message_id,
                    ChatMessageHelpfulMark.user_id == user_id,
                )
            )
        ).scalar_one_or_none() is not None

    async def lock_message(self, message_id: UUID) -> ChatMessage | None:
        """Kunci baris pesan: dua tanda bersamaan diproses berurutan.

        Tanpa kunci, dua penanda terakhir bisa sama-sama melihat hitungan di
        bawah ambang dan reward terpicu dua kali; ledger tetap idempoten, tapi
        kunci ini membuat hasilnya deterministik.
        """
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.id == message_id)
            .with_for_update()
        )
        return (await self._db.execute(stmt)).scalar_one_or_none()

    async def commit(self) -> None:
        await self._db.commit()

    async def helpful_map(
        self, message_ids: list[UUID], *, user_id: UUID
    ) -> dict[UUID, MessageInteraction]:
        """Hitungan "membantu" untuk sekumpulan pesan, dalam satu kueri.

        Dipakai saat menyajikan satu halaman; tanpa ini setiap pesan menambah
        satu kueri.
        """
        if not message_ids:
            return {}
        rows = (
            await self._db.execute(
                select(
                    ChatMessageHelpfulMark.message_id,
                    func.count().label("total"),
                    func.bool_or(ChatMessageHelpfulMark.user_id == user_id).label(
                        "mine"
                    ),
                )
                .where(ChatMessageHelpfulMark.message_id.in_(message_ids))
                .group_by(ChatMessageHelpfulMark.message_id)
            )
        ).all()
        return {
            row[0]: MessageInteraction(helpful_count=row[1], helpful_by_me=bool(row[2]))
            for row in rows
        }
