"""Perbandingan harga buku lintas marketplace, dan pengelolaan sumbernya.

Dua kelompok endpoint dengan otorisasi berbeda:

- **Pembanding harga** (`GET /books/{id}/marketplace-prices`) hanya untuk akun
  pelanggan yang sudah login (`require_user`). Sama seperti keranjang, akun admin
  tidak ikut memakainya — admin berbelanja dengan akun pelanggan terpisah.
- **Sumber marketplace** (`/marketplace-sources`) hanya untuk admin. Tanpa
  sumber, sebuah buku tidak akan pernah punya harga pembanding, jadi ini bagian
  yang wajib diisi admin lebih dulu.

Catatan desain: endpoint pembanding ditaruh di router ini, bukan di
`app/api/v1/books.py`, karena router itu sengaja hanya berisi katalog + ulasan
AI. Efek sampingnya menguntungkan: otorisasi tiap endpoint terbaca dari berkasnya
sendiri, tanpa satu endpoint publik ikut "terbawa" jadi terbatas.

Karena `supabase_admin` menembus RLS, otorisasi **tidak** boleh mengandalkan
kebijakan database — seluruh pemeriksaan peran ada di dependency FastAPI di sini.
"""

from __future__ import annotations

import time
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.books import DB_UNREACHABLE, load_book_for_read
from app.core.security import UserPayload, require_admin, require_user
from app.db.session import get_db
from app.schemas.common import ApiResponse
from app.schemas.marketplace import (
    MarketplaceComparisonResponse,
    MarketplaceInfo,
    MarketplaceSourceCreate,
    MarketplaceSourceRead,
    MarketplaceSourceUpdate,
)
from app.services.book_service import OrmBookRepository
from app.services.marketplace.registry import marketplace_label, supported_marketplaces
from app.services.marketplace.seeding import build_default_source_rows
from app.services.marketplace.service import MarketplaceComparisonService, build_service
from app.services.marketplace_repository import (
    OrmMarketplacePriceRepository,
    OrmMarketplaceSourceRepository,
)

router = APIRouter(tags=["marketplace"])

#: Jeda minimum antar permintaan *paksa* (tanpa cache) untuk satu buku.
#: Tanpa ini, `refresh=true` yang dipanggil berulang adalah cara termudah
#: menjadikan fitur ini sebagai alat tekan ke marketplace. Batasnya per buku,
#: bukan per pengguna, supaya tetap berlaku walau banyak akun bergantian.
FORCE_REFRESH_COOLDOWN_SECONDS = 60

#: Waktu pengambilan paksa terakhir per buku. In-memory dan per-proses, sama
#: seperti cache ulasan AI (`app/services/ai_review_service.py`): cukup untuk
#: pemakaian satu proses, dan tidak berpura-pura jadi rate limiter terdistribusi.
_LAST_FORCE_REFRESH: dict[str, float] = {}


def comparison_service(db: Annotated[AsyncSession, Depends(get_db)]) -> MarketplaceComparisonService:
    """Service perbandingan harga dengan repository yang terikat sesi permintaan.

    Inilah satu-satunya tempat repository nyata disusun; pengujian meng-override
    dependency ini untuk menyuntikkan repository palsu — tanpa database.
    """
    return build_service(
        OrmMarketplaceSourceRepository(db),
        OrmMarketplacePriceRepository(db),
    )


def _guard_force_refresh(book_id: str) -> None:
    """Tolak pengambilan paksa yang terlalu sering untuk buku yang sama."""
    now = time.monotonic()
    last = _LAST_FORCE_REFRESH.get(book_id)
    if last is not None and now - last < FORCE_REFRESH_COOLDOWN_SECONDS:
        remaining = int(FORCE_REFRESH_COOLDOWN_SECONDS - (now - last)) + 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Perbandingan harga baru saja diperbarui. "
                f"Coba lagi dalam {remaining} detik."
            ),
        )
    _LAST_FORCE_REFRESH[book_id] = now


# ---------------------------------------------------------------------------
# Pembanding harga (pelanggan)
# ---------------------------------------------------------------------------


@router.get(
    "/books/{book_id}/marketplace-prices",
    response_model=ApiResponse[MarketplaceComparisonResponse],
)
async def compare_marketplace_prices(
    book_id: str,
    current_user: Annotated[UserPayload, Depends(require_user)],
    service: Annotated[MarketplaceComparisonService, Depends(comparison_service)],
    db: Annotated[AsyncSession, Depends(get_db)],
    refresh: Annotated[bool, Query(description="Paksa ambil ulang, mengabaikan cache.")] = False,
) -> ApiResponse[MarketplaceComparisonResponse]:
    """Bandingkan harga satu buku di seluruh marketplace yang dikonfigurasi admin.

    Harga yang masih segar diambil dari cache; hanya yang basi (atau diminta
    paksa) yang diambil ulang dari marketplace.
    """
    if refresh:
        _guard_force_refresh(book_id)

    book = await load_book_for_read(book_id, db)
    compared = await service.compare_book(book, force_refresh=refresh)
    await db.commit()

    if not compared["quotes"] and not compared["warnings"]:
        compared["warnings"] = ["Belum ada harga marketplace yang bisa ditampilkan."]

    return ApiResponse(
        sukses=True,
        pesan="Perbandingan harga berhasil dimuat.",
        data=MarketplaceComparisonResponse.model_validate(compared),
    )


@router.get("/marketplaces", response_model=ApiResponse[list[MarketplaceInfo]])
async def list_marketplaces(
    current_user: Annotated[UserPayload, Depends(require_user)],
) -> ApiResponse[list[MarketplaceInfo]]:
    """Marketplace yang didukung, untuk dropdown di halaman admin."""
    return ApiResponse(
        sukses=True,
        pesan="Daftar marketplace berhasil dimuat.",
        data=[
            MarketplaceInfo(slug=adapter.slug, label=adapter.label)
            for adapter in supported_marketplaces()
        ],
    )


@router.post(
    "/books/{book_id}/marketplace-sources/seed",
    response_model=ApiResponse[list[MarketplaceSourceRead]],
)
async def seed_book_marketplace_sources(
    book_id: str,
    current_user: Annotated[UserPayload, Depends(require_admin)],
    service: Annotated[MarketplaceComparisonService, Depends(comparison_service)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[list[MarketplaceSourceRead]]:
    """Isi sumber marketplace bawaan untuk buku yang sudah ada.

    Buku baru mendapat sumber otomatis saat dibuat; endpoint ini untuk buku lama
    yang belum punya sumber sama sekali. Idempoten: sumber yang sudah ada untuk
    marketplace yang sama dibiarkan apa adanya.
    """
    parsed = _uuid_or_422(book_id)
    await _ensure_book_exists(parsed, db)
    book = await OrmBookRepository(db).get(parsed)
    created_rows = await service.sources.create_many_if_absent(
        build_default_source_rows(parsed, title=book.get("title") or "", author=book.get("author"))
    )
    await db.commit()
    return ApiResponse(
        sukses=True,
        pesan=(
            f"{len(created_rows)} sumber marketplace ditambahkan."
            if created_rows
            else "Semua sumber marketplace bawaan sudah terdaftar."
        ),
        data=[_source_payload(source) for source in created_rows],
    )


# ---------------------------------------------------------------------------
# Sumber marketplace (admin)
# ---------------------------------------------------------------------------


@router.get("/marketplace-sources", response_model=ApiResponse[list[MarketplaceSourceRead]])
async def list_marketplace_sources(
    book_id: str,
    current_user: Annotated[UserPayload, Depends(require_admin)],
    service: Annotated[MarketplaceComparisonService, Depends(comparison_service)],
) -> ApiResponse[list[MarketplaceSourceRead]]:
    """Seluruh sumber harga (termasuk yang dimatikan) untuk satu buku."""
    sources = await service.sources.list_for_book(_uuid_or_422(book_id))
    return ApiResponse(
        sukses=True,
        pesan="Daftar sumber marketplace berhasil dimuat.",
        data=[_source_payload(source) for source in sources],
    )


@router.post(
    "/marketplace-sources",
    response_model=ApiResponse[MarketplaceSourceRead],
    status_code=status.HTTP_201_CREATED,
)
async def create_marketplace_source(
    payload: MarketplaceSourceCreate,
    current_user: Annotated[UserPayload, Depends(require_admin)],
    service: Annotated[MarketplaceComparisonService, Depends(comparison_service)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[MarketplaceSourceRead]:
    """Tambah satu sumber (link produk atau kata kunci) untuk sebuah buku."""
    await _ensure_book_exists(payload.book_id, db)
    existing = await service.sources.list_for_book(payload.book_id)
    if any(source.marketplace == payload.marketplace for source in existing):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{marketplace_label(payload.marketplace)} sudah terdaftar untuk buku ini.",
        )

    source = await service.sources.create(payload)
    await db.commit()
    return ApiResponse(
        sukses=True,
        pesan="Sumber marketplace berhasil ditambahkan.",
        data=_source_payload(source),
    )


@router.patch(
    "/marketplace-sources/{source_id}",
    response_model=ApiResponse[MarketplaceSourceRead],
)
async def update_marketplace_source(
    source_id: str,
    payload: MarketplaceSourceUpdate,
    current_user: Annotated[UserPayload, Depends(require_admin)],
    service: Annotated[MarketplaceComparisonService, Depends(comparison_service)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[MarketplaceSourceRead]:
    """Ubah link produk, kata kunci, atau status aktif sebuah sumber."""
    source = await service.sources.update(_uuid_or_422(source_id), payload)
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sumber marketplace tidak ditemukan.")
    await db.commit()
    return ApiResponse(
        sukses=True,
        pesan="Sumber marketplace berhasil diperbarui.",
        data=_source_payload(source),
    )


@router.delete("/marketplace-sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_marketplace_source(
    source_id: str,
    current_user: Annotated[UserPayload, Depends(require_admin)],
    service: Annotated[MarketplaceComparisonService, Depends(comparison_service)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Hapus satu sumber; riwayat harganya tetap tersimpan di `marketplace_prices`."""
    deleted = await service.sources.delete(_uuid_or_422(source_id))
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sumber marketplace tidak ditemukan.")
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Pembantu
# ---------------------------------------------------------------------------


def _uuid_or_422(raw: str) -> Any:
    """Ubah string path menjadi UUID; nilai tidak sah jadi 422, bukan 500."""
    from uuid import UUID

    try:
        return UUID(raw)
    except (ValueError, AttributeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Identifier tidak valid.",
        ) from exc


async def _ensure_book_exists(book_id: Any, db: AsyncSession) -> None:
    """Pastikan bukunya ada, supaya sumber tidak menunjuk buku hantu."""
    try:
        found = await OrmBookRepository(db).get(book_id)
    except DB_UNREACHABLE as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database sedang tidak dapat dijangkau.",
        ) from exc
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Buku tidak ditemukan.")


def _source_payload(source: Any) -> dict[str, Any]:
    """Bentuk respons satu sumber, lengkap dengan label marketplace-nya."""
    return {
        "id": source.id,
        "book_id": source.book_id,
        "marketplace": source.marketplace,
        "label": marketplace_label(source.marketplace),
        "product_url": source.product_url,
        "search_keyword": source.search_keyword,
        "is_active": source.is_active,
        "created_at": source.created_at,
        "updated_at": source.updated_at,
    }
