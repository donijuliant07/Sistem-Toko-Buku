"""Service ulasan buku: tulis, edit, moderasi, dan daftar tayang.

Aturan yang dijaga di sini:

- **Satu ulasan per pengguna per buku** (UNIQUE DB + cek di service untuk
  pesan yang ramah).
- **Ulasan baru selalu `pending`**; tampil di halaman produk hanya setelah
  moderator menyetujui.
- **Edit tidak mengubah reward.** Ulasan yang sudah `rewarded` tetap
  `rewarded`; yang `rejected` kembali `pending` untuk ditinjau ulang.
- **Batas anti-spam**: maksimum `MAX_REVIEWS_PER_DAY` ulasan baru per pengguna
  per hari (zona Asia/Jakarta), dihitung dari waktu server.
- Identitas penulis selalu dari token, tidak pernah dari body.

Pemberian poin **tidak** ada di service ini. `on_approved` adalah hook yang
dipanggil tepat setelah moderasi menyetujui ulasan; tahap reward akan
menyuntikkan `RewardsService` di sini, sehingga moderasi dan poin berada di
satu transaksi database yang sama.
"""

from __future__ import annotations

import re
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from uuid import UUID

from app.core.security import UserPayload
from app.schemas.review import (
    ReviewAuthor,
    ReviewCreate,
    ReviewModeration,
    ReviewPage,
    ReviewRead,
    ReviewSummary,
    ReviewUpdate,
)
from app.services.community.errors import CommunityError, conflict
from app.services.review_repository import OrmReviewRepository, ReviewRow

MAX_REVIEWS_PER_DAY = 5

#: Urutan karakaten yang sama berulang (mis. "aaaaaaaaaaaa") bukan ulasan.
_REPEATED_CHARS = re.compile(r"(.)\1{9,}")

#: Dipanggil setelah moderasi menyetujui ulasan, di dalam transaksi yang sama.
OnApproved = Callable[[UserPayload, ReviewRead], Awaitable[None]]


def _user_uuid(user: UserPayload) -> UUID:
    return UUID(user.id)


def _is_admin(user: UserPayload) -> bool:
    return user.role == "admin"


def _looks_like_spam(body: str) -> bool:
    """Validasi dasar: terlalu sedikit kata unik atau huruf berulang panjang."""
    if _REPEATED_CHARS.search(body.lower()):
        return True
    words = body.lower().split()
    return len(words) >= 8 and len(set(words)) <= max(2, len(words) // 4)


def _to_read(row: ReviewRow) -> ReviewRead:
    """Bentuk API ulasan; penulis boleh tidak ada (daftar milik sendiri)."""
    review = row.review
    author = row.author
    return ReviewRead(
        id=review.id,
        book_id=review.book_id,
        rating=review.rating,
        title=review.title,
        body=review.body,
        status=review.status,
        author=(
            ReviewAuthor(
                id=author.id,
                username=author.username,
                full_name=author.full_name,
                avatar_url=author.avatar_url,
            )
            if author is not None
            else None
        ),
        rejection_reason=review.rejection_reason,
        rewarded_at=review.rewarded_at,
        created_at=review.created_at,
        updated_at=review.updated_at,
    )


class ReviewService:
    """Semua aksi ulasan; satu unit kerja per aksi, `commit()` sekali."""

    def __init__(
        self,
        reviews: OrmReviewRepository,
        *,
        on_approved: OnApproved | None = None,
    ) -> None:
        self._reviews = reviews
        self._on_approved = on_approved

    # ------------------------------------------------------------------
    # Pengguna
    # ------------------------------------------------------------------
    async def create(
        self, user: UserPayload, book_id: UUID, payload: ReviewCreate
    ) -> ReviewRead:
        if not await self._reviews.book_exists(book_id):
            raise CommunityError(404, "Buku tidak ditemukan.")
        if _looks_like_spam(payload.body):
            raise CommunityError(
                422, "Ulasan terdeteksi sebagai spam. Tulis ulasan yang lebih jelas."
            )

        user_id = _user_uuid(user)
        existing = await self._reviews.get_for_user_book(user_id, book_id)
        if existing is not None:
            raise conflict("Kamu sudah mengulas buku ini. Silakan edit ulasanmu.")

        since = datetime.now(UTC) - timedelta(days=1)
        if await self._reviews.count_recent_by_user(user_id, since=since) >= MAX_REVIEWS_PER_DAY:
            raise CommunityError(
                429, "Terlalu banyak ulasan dalam sehari. Coba lagi besok."
            )

        review = await self._reviews.create(
            user_id=user_id,
            book_id=book_id,
            rating=payload.rating,
            title=payload.title,
            body=payload.body,
        )
        if review is None:  # kalah balapan dengan request paralel
            raise conflict("Kamu sudah mengulas buku ini.")
        await self._reviews.commit()
        return _to_read(ReviewRow(review=review, author=None))

    async def update(
        self, user: UserPayload, review_id: UUID, payload: ReviewUpdate
    ) -> ReviewRead:
        review = await self._reviews.get_for_update(review_id)
        if review is None:
            raise CommunityError(404, "Ulasan tidak ditemukan.")
        if review.user_id != _user_uuid(user) and not _is_admin(user):
            # 404, bukan 403: keberadaan ulasan orang lain tidak perlu dibocorkan.
            raise CommunityError(404, "Ulasan tidak ditemukan.")
        if review.status == "rewarded":
            raise conflict("Ulasan yang sudah mendapat poin tidak dapat diubah.")

        changes = payload.model_dump(exclude_unset=True)
        if "body" in changes and _looks_like_spam(changes["body"]):
            raise CommunityError(
                422, "Ulasan terdeteksi sebagai spam. Tulis ulasan yang lebih jelas."
            )
        # Ulasan yang ditolak kembali ke antrean moderasi setelah diperbaiki.
        if review.status == "rejected":
            changes.update(
                status="pending", moderated_by=None, moderated_at=None,
                rejection_reason=None,
            )
        if changes:
            await self._reviews.update_fields(review_id, changes)
        await self._reviews.commit()

        refreshed = await self._reviews.get(review_id)
        assert refreshed is not None  # baris baru saja dikunci dan di-update
        return _to_read(ReviewRow(review=refreshed, author=None))

    async def list_visible(
        self, book_id: UUID, *, page: int, limit: int
    ) -> ReviewPage:
        rows, total, average = await self._reviews.list_visible(
            book_id, page=page, limit=limit
        )
        return ReviewPage(
            items=[_to_read(row) for row in rows],
            summary=ReviewSummary(
                book_id=book_id,
                average_rating=round(average, 2) if average is not None else None,
                total=total,
            ),
            total=total,
            page=page,
            limit=limit,
            total_pages=max(1, -(-total // limit)),
        )

    async def list_mine(self, user: UserPayload) -> list[ReviewRead]:
        reviews = await self._reviews.list_mine(_user_uuid(user))
        return [_to_read(ReviewRow(review=review, author=None)) for review in reviews]

    # ------------------------------------------------------------------
    # Admin
    # ------------------------------------------------------------------
    async def moderate(
        self, admin: UserPayload, review_id: UUID, payload: ReviewModeration
    ) -> ReviewRead:
        review = await self._reviews.get_for_update(review_id)
        if review is None:
            raise CommunityError(404, "Ulasan tidak ditemukan.")
        if review.status == "rewarded":
            raise conflict("Ulasan ini sudah disetujui dan diberi poin.")
        if review.status == "approved":
            # Sudah disetujui tetapi belum ber-reward (mis. reward ditunda):
            # keputusan tidak boleh diubah bolak-balik.
            raise conflict("Ulasan ini sudah disetujui.")

        await self._reviews.decide(
            review_id,
            status=payload.status,
            moderator_id=_user_uuid(admin),
            reason=payload.reason,
        )
        refreshed = await self._reviews.get(review_id)
        assert refreshed is not None
        result = _to_read(ReviewRow(review=refreshed, author=None))

        if payload.status == "approved" and self._on_approved is not None:
            # Dipanggil sebelum commit: bila reward melempar error, keputusan
            # moderasi tidak tersimpan. Ledger sendiri berjalan di koneksi
            # terpisah (RPC), jadi hook diimplementasikan idempoten — lihat
            # `RewardsService.reward_review`.
            await self._on_approved(admin, result)

        await self._reviews.commit()
        if payload.status == "approved" and self._on_approved is not None:
            # Status `rewarded` disimpan sesudah commit karena ledger tidak bisa
            # berbagi transaksi dengan ORM. Bila langkah ini gagal, ulasan tetap
            # `approved` dan backfill admin akan menyusulkan reward-nya.
            await self._reviews.mark_rewarded(review_id)
            await self._reviews.commit()
            refreshed = await self._reviews.get(review_id)
            if refreshed is not None:
                result = _to_read(ReviewRow(review=refreshed, author=None))
        return result

    async def list_for_moderation(
        self, *, status: str | None, page: int, limit: int
    ) -> tuple[list[ReviewRead], int, int]:
        """Antrean moderasi: `(item, total, total_pages)`.

        Ringkasan rating per buku tidak bermakna di antrean lintas buku, jadi
        router tidak membungkusnya dengan `ReviewPage`.
        """
        rows, total = await self._reviews.list_for_moderation(
            status=status, page=page, limit=limit
        )
        return (
            [_to_read(row) for row in rows],
            total,
            max(1, -(-total // limit)),
        )


__all__ = ["MAX_REVIEWS_PER_DAY", "OnApproved", "ReviewService"]
