"""Service pesan: halaman riwayat (keyset), kirim idempoten, hapus (soft).

Dua hal yang membuat chat ini aman dan tidak menduplikasi pesan:

- **Pengirim tidak pernah dari body.** `sender_id` diisi dari token; field
  asing di payload diabaikan Pydantic.
- **`client_message_id`** dibuat klien. Pengiriman ulang (jaringan putus, tombol
  Retry) dengan id yang sama mengembalikan pesan yang sudah ada, bukan baris
  baru — `ON CONFLICT DO NOTHING` di repository.

Paginasi memakai keyset `(created_at, id)` yang di-encode base64, sehingga pesan
baru yang masuk saat pengguna memuat halaman lama tidak menggeser hasil.
"""

from __future__ import annotations

import base64
import binascii
from datetime import datetime
from uuid import UUID

from app.core.security import UserPayload
from app.schemas.community import (
    MessageCreate,
    MessagePage,
    MessageRead,
    MessageSender,
    SharedBook,
)
from app.services.community import permissions
from app.services.community.errors import CommunityError, forbidden
from app.services.community.group_service import GroupService, _is_admin, _user_uuid
from app.services.community.rate_limit import SendRateLimiter
from app.services.community.repository import (
    MessageRow,
    OrmMemberRepository,
    OrmMessageRepository,
)

#: Batas halaman; nilai lebih besar ditolak router lewat `Query(le=...)`.
MAX_PAGE_SIZE = 50


def encode_cursor(created_at: datetime, message_id: UUID) -> str:
    """Kursor opak untuk "pesan sebelum baris ini"."""
    raw = f"{created_at.isoformat()}|{message_id}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")


def decode_cursor(cursor: str) -> tuple[datetime, UUID]:
    """Kebalikan `encode_cursor`; kursor rusak dijawab 422, bukan 500."""
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8")
        timestamp, message_id = raw.rsplit("|", 1)
        return datetime.fromisoformat(timestamp), UUID(message_id)
    except (ValueError, binascii.Error, UnicodeDecodeError):
        raise CommunityError(422, "Kursor pesan tidak valid.") from None


def _message_read(row: MessageRow) -> MessageRead:
    """Bentuk pesan; data buku diambil dari katalog saat ini (bukan snapshot)."""
    sender = row.sender
    book = row.book
    return MessageRead(
        id=row.message.id,
        group_id=row.message.group_id,
        message_type=row.message.message_type,
        content=row.message.content or "",
        sender=MessageSender(
            id=row.message.sender_id,
            username=sender.username if sender else None,
            full_name=sender.full_name if sender else None,
            avatar_url=sender.avatar_url if sender else None,
        ),
        book=(
            SharedBook(
                id=book.id,
                title=book.title,
                author=book.author,
                price=book.price,
                cover_url=book.cover_url,
            )
            if book is not None
            else None
        ),
        client_message_id=row.message.client_message_id,
        created_at=row.message.created_at,
    )


class MessageService:
    """Riwayat dan pengiriman pesan dalam satu grup."""

    def __init__(
        self,
        groups: GroupService,
        members: OrmMemberRepository,
        messages: OrmMessageRepository,
        limiter: SendRateLimiter | None = None,
    ) -> None:
        self._groups = groups
        self._members = members
        self._messages = messages
        self._limiter = limiter or SendRateLimiter()

    async def _require_reader(
        self, user: UserPayload, group_id: UUID
    ) -> str | None:
        """Role pemanggil; non-anggota grup publik dijawab 403.

        Grup privat yang tidak diikuti sudah menjadi 404 di `load_visible`,
        sehingga keberadaannya tidak bocor.
        """
        row = await self._groups.load_visible(group_id, user)
        if not permissions.can_read_messages(row.my_role, _is_admin(user)):
            raise forbidden("Gabung grup dulu untuk membaca pesan.")
        return row.my_role

    async def list_messages(
        self,
        user: UserPayload,
        group_id: UUID,
        *,
        cursor: str | None,
        limit: int,
    ) -> MessagePage:
        """Satu halaman pesan, selalu kronologis (lama → baru)."""
        await self._require_reader(user, group_id)
        before = decode_cursor(cursor) if cursor else None
        rows, has_more = await self._messages.list_page(
            group_id, before=before, limit=limit
        )
        # Repository mengembalikan terbaru-dulu; API menyajikan kronologis.
        rows.reverse()
        next_cursor = (
            encode_cursor(rows[0].message.created_at, rows[0].message.id)
            if has_more and rows
            else None
        )
        return MessagePage(
            items=[_message_read(row) for row in rows],
            next_cursor=next_cursor,
        )

    async def send_message(
        self, user: UserPayload, group_id: UUID, payload: MessageCreate
    ) -> tuple[MessageRead, bool]:
        """Kirim pesan; `(pesan, created)` — `created=False` berarti retry."""
        row = await self._groups.load_visible(group_id, user)
        if not permissions.can_send(row.my_role):
            raise forbidden("Gabung grup dulu untuk mengirim pesan.")
        user_id = _user_uuid(user)
        retry_after = self._limiter.retry_after(
            user_id=str(user_id), group_id=str(group_id)
        )
        if retry_after > 0:
            raise CommunityError(
                429, "Terlalu banyak pesan. Tunggu sebentar sebelum mengirim lagi."
            )
        book_id = payload.book_id
        if payload.message_type.value == "book":
            assert book_id is not None  # dijamin validator skema
            if not await self._messages.book_exists(book_id):
                raise CommunityError(404, "Buku tidak ditemukan.")
        message_id, created = await self._messages.insert(
            group_id=group_id,
            sender_id=user_id,
            message_type=payload.message_type.value,
            content=payload.content,
            book_id=book_id,
            client_message_id=payload.client_message_id,
        )
        await self._groups.commit()
        stored = await self._messages.get_row(message_id)
        if stored is None:  # pragma: no cover - baru disisipkan
            raise CommunityError(500, "Pesan gagal dibaca setelah dikirim.")
        return _message_read(stored), created

    async def delete_message(
        self, user: UserPayload, group_id: UUID, message_id: UUID
    ) -> None:
        """Soft delete pesan oleh pengirim, moderator, owner, atau admin."""
        row = await self._groups.load_visible(group_id, user)
        message = await self._messages.get(message_id)
        if message is None or message.group_id != group_id:
            raise CommunityError(404, "Pesan tidak ditemukan.")
        if not permissions.can_delete_message(
            row.my_role, _is_admin(user), message.sender_id == _user_uuid(user)
        ):
            if row.my_role is None and not _is_admin(user):
                raise forbidden("Gabung grup dulu untuk mengelola pesan.")
            raise forbidden("Anda tidak dapat menghapus pesan ini.")
        await self._messages.soft_delete(message_id)
        await self._groups.commit()
