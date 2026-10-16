"""Repository ORM untuk sumber dan hasil harga marketplace.

Satu implementasi per kontrak di `app/services/base.py`:

- `OrmMarketplaceSourceRepository` → `MarketplaceSourceRepository`
- `OrmMarketplacePriceRepository` → `MarketplacePriceRepository`

Semuanya `async` karena memakai `AsyncSession` yang sama dengan jalur `books`.
`flush()` dipakai (bukan `commit()`) supaya satu permintaan tetap satu transaksi:
komit dilakukan sekali di layer API, sehingga sumber dan snapshot yang dibuat
dalam satu permintaan tidak pernah setengah tersimpan.

Tidak ada pemetaan ke dict di sini — service orkestrasi yang mengubah baris ORM
menjadi dataclass netral, jadi model ORM tidak pernah bocor ke layer API.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.marketplace import MarketplacePrice, MarketplaceSource
from app.services.base import MarketplacePriceRepository, MarketplaceSourceRepository

#: Kolom snapshot yang boleh diisi pemanggil. `id` tidak ikut (dibuat database),
#: tetapi `fetched_at` **ikut**: waktu diambilnya harga adalah fakta yang diketahui
#: scraper, bukan sesuatu yang boleh ditentukan jam database — dua jam berbeda
#: membuat riwayat dan aturan cache tidak bisa diuji.
_SNAPSHOT_COLUMNS = (
    "book_id",
    "marketplace",
    "price",
    "currency",
    "product_url",
    "product_title",
    "seller_name",
    "in_stock",
    "match_score",
    "source",
    "fetched_at",
)


class OrmMarketplaceSourceRepository(MarketplaceSourceRepository):
    """Sumber harga marketplace lewat `AsyncSession` milik permintaan."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def list_for_book(self, book_id: UUID, *, only_active: bool = False) -> list[Any]:
        """Sumber milik satu buku, diurutkan slug marketplace agar stabil."""
        stmt = select(MarketplaceSource).where(MarketplaceSource.book_id == book_id)
        if only_active:
            stmt = stmt.where(MarketplaceSource.is_active.is_(True))
        stmt = stmt.order_by(MarketplaceSource.marketplace)
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def get(self, source_id: UUID) -> Any | None:
        """Satu sumber berdasarkan id, atau `None`."""
        return await self._db.get(MarketplaceSource, source_id)

    async def create(self, payload: Any) -> Any:
        """Sisipkan sumber baru; `payload` adalah `MarketplaceSourceCreate`."""
        data = payload.model_dump(mode="json")
        source = MarketplaceSource(
            book_id=data["book_id"],
            marketplace=data["marketplace"],
            product_url=data.get("product_url"),
            search_keyword=data.get("search_keyword"),
            is_active=data.get("is_active", True),
        )
        self._db.add(source)
        await self._db.flush()
        return source

    async def update(self, source_id: UUID, payload: Any) -> Any | None:
        """Terapkan hanya field yang benar-benar dikirim klien (`exclude_unset`)."""
        source = await self.get(source_id)
        if source is None:
            return None
        changes = payload.model_dump(mode="json", exclude_unset=True)
        for field, value in changes.items():
            setattr(source, field, value)
        await self._db.flush()
        return source

    async def delete(self, source_id: UUID) -> bool:
        """Hapus sumber; `False` bila id-nya tidak ada."""
        source = await self.get(source_id)
        if source is None:
            return False
        await self._db.delete(source)
        await self._db.flush()
        return True


class OrmMarketplacePriceRepository(MarketplacePriceRepository):
    """Snapshot harga marketplace lewat `AsyncSession` milik permintaan."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def latest_for_book(self, book_id: UUID) -> list[Any]:
        """Snapshot terbaru per marketplace.

        Diambil dengan satu kueri terurut lalu disaring di Python, bukan dengan
        `DISTINCT ON`: jumlah marketplace per buku kecil dan tetap, dan bentuk
        kueri portable ini bisa dijalankan di atas fake session pada pengujian
        tanpa SQL spesifik PostgreSQL.
        """
        rows = await self._fetch(book_id)
        latest: dict[str, Any] = {}
        for row in rows:
            latest.setdefault(row.marketplace, row)
        return list(latest.values())

    async def history_for_book(self, book_id: UUID, *, limit: int = 60) -> list[Any]:
        """Riwayat harga satu buku, terbaru lebih dulu, dibatasi `limit` baris."""
        stmt = (
            select(MarketplacePrice)
            .where(MarketplacePrice.book_id == book_id)
            .order_by(MarketplacePrice.fetched_at.desc(), MarketplacePrice.id.desc())
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def add_snapshot(self, payload: Any) -> Any:
        """Sisipkan satu titik harga; tidak pernah menimpa baris lama."""
        data = payload if isinstance(payload, dict) else payload.model_dump(mode="json")
        snapshot = MarketplacePrice(**{k: data[k] for k in _SNAPSHOT_COLUMNS if k in data})
        self._db.add(snapshot)
        await self._db.flush()
        return snapshot

    async def _fetch(self, book_id: UUID) -> list[Any]:
        """Seluruh snapshot satu buku, terbaru lebih dulu."""
        stmt = (
            select(MarketplacePrice)
            .where(MarketplacePrice.book_id == book_id)
            .order_by(MarketplacePrice.fetched_at.desc(), MarketplacePrice.id.desc())
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().all())
