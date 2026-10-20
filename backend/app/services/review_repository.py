"""Repository ORM ulasan buku.

Pemisahan yang sama dengan paket community: service tidak memegang SQL, dan
repository mengembalikan dataclass netral supaya model tidak bocor ke layer API.

Yang sengaja **tidak** ada di sini: reward. Menyetujui ulasan hanya mengubah
status; pemberian poin adalah tanggung jawab service reward (tahap 4–5), yang
dipanggil setelah moderasi berhasil.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.book import Book
from app.models.profile import Profile
from app.models.review import Review

#: Status ulasan yang tampil di halaman produk.
VISIBLE_STATUSES = ("approved", "rewarded")


@dataclass
class ReviewRow:
    """Ulasan beserta profil penulisnya."""

    review: Review
    author: Profile | None


class OrmReviewRepository:
    """Akses tabel `reviews` lewat sesi milik permintaan."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def commit(self) -> None:
        await self._db.commit()

    async def rollback(self) -> None:
        await self._db.rollback()

    async def book_exists(self, book_id: UUID) -> bool:
        stmt = select(Book.id).where(Book.id == book_id)
        return (await self._db.execute(stmt)).scalar_one_or_none() is not None

    async def get(self, review_id: UUID) -> Review | None:
        return await self._db.get(Review, review_id)

    async def get_for_update(self, review_id: UUID) -> Review | None:
        """Kunci baris ulasan selama keputusan moderasi.

        Tanpa kunci, dua moderator yang menekan "setujui" bersamaan bisa
        sama-sama membaca status `pending` dan sama-sama memberi reward.
        """
        stmt = select(Review).where(Review.id == review_id).with_for_update()
        return (await self._db.execute(stmt)).scalar_one_or_none()

    async def get_for_user_book(self, user_id: UUID, book_id: UUID) -> Review | None:
        stmt = select(Review).where(
            Review.user_id == user_id, Review.book_id == book_id
        )
        return (await self._db.execute(stmt)).scalar_one_or_none()

    async def create(
        self,
        *,
        user_id: UUID,
        book_id: UUID,
        rating: int,
        title: str | None,
        body: str,
    ) -> Review | None:
        """Sisipkan ulasan baru; `None` bila pengguna sudah mengulas buku ini.

        `ON CONFLICT DO NOTHING` menjaga kiriman ganda (tombol ditekan dua kali)
        dari pelanggaran unique; pemanggil menjawab 409 dengan pesan yang jelas.
        """
        stmt = (
            pg_insert(Review)
            .values(
                user_id=user_id,
                book_id=book_id,
                rating=rating,
                title=title,
                body=body,
            )
            .on_conflict_do_nothing(index_elements=["user_id", "book_id"])
            .returning(Review.id)
        )
        inserted = (await self._db.execute(stmt)).scalar_one_or_none()
        await self._db.flush()
        if inserted is None:
            return None
        return await self._db.get(Review, inserted)

    async def update_fields(self, review_id: UUID, changes: dict[str, Any]) -> None:
        """Perbarui isi ulasan dan `updated_at` (tanpa menyentuh status)."""
        await self._db.execute(
            update(Review)
            .where(Review.id == review_id)
            .values(**changes, updated_at=func.now())
        )
        await self._db.flush()

    async def decide(
        self,
        review_id: UUID,
        *,
        status: str,
        moderator_id: UUID,
        reason: str | None,
    ) -> None:
        """Catat keputusan moderator.

        `rewarded_at` tidak disentuh di sini — mengedit ulasan yang sudah
        rewarded tidak boleh mengembalikan status ke `approved` lalu membuka
        peluang reward kedua.
        """
        values: dict[str, Any] = {
            "status": status,
            "moderated_by": moderator_id,
            "moderated_at": func.now(),
            "rejection_reason": reason if status == "rejected" else None,
        }
        await self._db.execute(
            update(Review).where(Review.id == review_id).values(**values)
        )
        await self._db.flush()

    async def mark_rewarded(self, review_id: UUID) -> None:
        await self._db.execute(
            update(Review)
            .where(Review.id == review_id)
            .values(status="rewarded", rewarded_at=func.now())
        )
        await self._db.flush()

    async def list_visible(
        self, book_id: UUID, *, page: int, limit: int
    ) -> tuple[list[ReviewRow], int, float | None]:
        """Ulasan tayang untuk satu buku + total + rata-rata rating."""
        filters = (
            Review.book_id == book_id,
            Review.status.in_(VISIBLE_STATUSES),
        )
        total = (
            await self._db.execute(
                select(func.count()).select_from(Review).where(*filters)
            )
        ).scalar_one()
        average = (
            await self._db.execute(
                select(func.avg(Review.rating)).where(*filters)
            )
        ).scalar_one()

        stmt = (
            select(Review, Profile)
            .outerjoin(Profile, Profile.id == Review.user_id)
            .where(*filters)
            .order_by(Review.created_at.desc(), Review.id)
            .offset((page - 1) * limit)
            .limit(limit)
        )
        rows = (await self._db.execute(stmt)).all()
        return (
            [ReviewRow(review=row[0], author=row[1]) for row in rows],
            total,
            float(average) if average is not None else None,
        )

    async def list_mine(self, user_id: UUID) -> list[Review]:
        stmt = (
            select(Review)
            .where(Review.user_id == user_id)
            .order_by(Review.created_at.desc())
        )
        return list((await self._db.execute(stmt)).scalars().all())

    async def list_for_moderation(
        self, *, status: str | None, page: int, limit: int
    ) -> tuple[list[ReviewRow], int]:
        filters = [] if status is None else [Review.status == status]
        total = (
            await self._db.execute(
                select(func.count()).select_from(Review).where(*filters)
            )
        ).scalar_one()
        stmt = (
            select(Review, Profile)
            .outerjoin(Profile, Profile.id == Review.user_id)
            .where(*filters)
            .order_by(Review.created_at.asc(), Review.id)
            .offset((page - 1) * limit)
            .limit(limit)
        )
        rows = (await self._db.execute(stmt)).all()
        return [ReviewRow(review=row[0], author=row[1]) for row in rows], total

    async def count_recent_by_user(self, user_id: UUID, *, since: datetime) -> int:
        """Jumlah ulasan pengguna sejak `since` (dipakai batas anti-spam)."""
        return (
            await self._db.execute(
                select(func.count())
                .select_from(Review)
                .where(Review.user_id == user_id, Review.created_at >= since)
            )
        ).scalar_one()
