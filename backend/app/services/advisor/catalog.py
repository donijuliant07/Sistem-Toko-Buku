"""Pembacaan kandidat dari katalog aktual (`books` + `categories`).

Satu-satunya tempat fitur ini menyentuh database. Kueri sengaja memakai SQL
eksplisit, bukan model ORM `Book`: tabel live punya kolom `category_id` dan
`weight_gram` yang belum ada di model/migrasi repo, sedangkan fitur ini hanya
butuh baca. Dengan SQL eksplisit, tidak ada perubahan model yang memaksa
migrasi baru — dan kolom yang tidak dipakai tidak ikut terambil.

Syarat wajib pengguna (anggaran, stok, buku yang tidak disukai) diterapkan di
`WHERE`, bukan setelah ranking: batas wajib tidak boleh dilanggar hanya karena
skor sinyal lain tinggi.
"""

from collections.abc import Sequence
from typing import Protocol
from uuid import UUID

from sqlalchemy import bindparam, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.book_advisor import BookPreferences, CandidateBook

#: Batas baris yang diambil dari database per pencarian. Cukup untuk
#: memeringkatkan kandidat terbaik tanpa menarik seluruh katalog ke memori.
MAX_CANDIDATES = 200

_SEARCH_SQL = text(
    """
    SELECT b.id, b.title, b.author, b.description, b.price, b.stock, b.cover_url,
           c.name AS category
    FROM public.books AS b
    LEFT JOIN public.categories AS c ON c.id = b.category_id
    WHERE (CAST(:min_budget AS numeric) IS NULL OR b.price >= CAST(:min_budget AS numeric))
      AND (CAST(:max_budget AS numeric) IS NULL OR b.price <= CAST(:max_budget AS numeric))
      AND (CAST(:in_stock_only AS boolean) = false OR b.stock > 0)
      AND NOT (b.id = ANY(CAST(:excluded_ids AS uuid[])))
    ORDER BY b.price ASC, b.title ASC
    LIMIT :limit
    """
).bindparams(bindparam("excluded_ids", type_=ARRAY(PGUUID(as_uuid=True))))

class AdvisorCatalog(Protocol):
    """Kontrak baca katalog untuk advisor; dipenuhi repository SQL dan fake uji."""

    async def search(self, preferences: BookPreferences, *, limit: int = MAX_CANDIDATES) -> list[CandidateBook]:
        """Kandidat yang lolos syarat wajib, sebelum ranking."""
        ...

def _excluded_ids(preferences: BookPreferences) -> list[UUID]:
    """ID buku yang dinyatakan tidak disukai (bila bentuknya UUID)."""
    ids: list[UUID] = []
    for raw in preferences.disliked_books:
        try:
            ids.append(UUID(raw))
        except ValueError:
            continue
    return ids

class SqlAdvisorCatalog:
    """Implementasi `AdvisorCatalog` di atas `AsyncSession` milik permintaan."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def search(self, preferences: BookPreferences, *, limit: int = MAX_CANDIDATES) -> list[CandidateBook]:
        """Ambil kandidat yang memenuhi syarat wajib, urut harga lalu judul.

        Batas `limit` dijepit agar pemanggil tidak bisa menarik seluruh katalog
        lewat parameter.
        """
        result = await self._db.execute(
            _SEARCH_SQL,
            {
                "min_budget": preferences.min_budget,
                "max_budget": preferences.max_budget,
                "in_stock_only": preferences.availability_preferences == "in_stock_only",
                "excluded_ids": _excluded_ids(preferences),
                "limit": max(1, min(limit, MAX_CANDIDATES)),
            },
        )
        return [
            CandidateBook(
                id=row.id,
                title=row.title,
                author=row.author,
                description=row.description,
                price=row.price,
                stock=row.stock,
                cover_url=row.cover_url,
                category=row.category,
            )
            for row in result.mappings()
        ]

def candidate_ids(candidates: Sequence[CandidateBook]) -> set[str]:
    """Himpunan ID kandidat sebagai string — dipakai memvalidasi keluaran model."""
    return {str(book.id) for book in candidates}
