"""Endpoint AI Book Review berbayar (Book Rewards).

Alur satu permintaan:

1. `require_user` — admin tidak berbelanja/berpoin, jadi ditolak (403).
2. Buku dibaca dari katalog (404 bila tidak ada).
3. `RewardsService.generate_ai_review` menentukan akses (`free`,
   `purchase_eligibility`, atau `points`), menagih ledger bila perlu, memanggil
   model, dan menyimpan hasil. Idempotensi ditangani service + database.

Endpoint lama `POST /books/{book_id}/ai-review` tetap ada untuk kompatibilitas
frontend, tetapi sekarang menjadi alias tipis ke alur yang sama — tanpa poin
tidak bisa membuka `medium`/`heavy`.
"""

from __future__ import annotations

import asyncio
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.books import load_book_for_read
from app.core.security import UserPayload, require_user
from app.db.session import get_db
from app.schemas.ai_review import AIReviewResponse, SpoilerLevel
from app.schemas.common import ApiResponse
from app.schemas.rewards import (
    AIReviewGenerateRequest,
    AIReviewGenerationRead,
    AIReviewSummary,
)
from app.services.ai_review_service import generate_ai_book_review
from app.services.rewards.errors import RewardsError
from app.services.rewards.service import RewardsService, rewards_service

router = APIRouter(prefix="/ai", tags=["ai"])

Customer = Annotated[UserPayload, Depends(require_user)]
Db = Annotated[AsyncSession, Depends(get_db)]


def get_rewards_service() -> RewardsService:
    return rewards_service


RewardsSvc = Annotated[RewardsService, Depends(get_rewards_service)]


def _http(exc: RewardsError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


def _generator(book: dict, spoiler_level: SpoilerLevel) -> AIReviewResponse:
    """Adapter sinkron ke generator async milik `ai_review_service`.

    `RewardsService` memanggil generator di thread terpisah (`asyncio.to_thread`)
    dan memakai signature `(book=..., spoiler_level=...)`; di sini coroutine
    async milik modul AI dijalankan dengan loop baru di thread itu.
    """
    return asyncio.run(
        generate_ai_book_review(
            book_id=str(book["id"]),
            title=book.get("title") or "Buku",
            author=book.get("author") or "Penulis",
            description=book.get("description") or "",
            isbn=book.get("isbn") or "",
            spoiler_level=spoiler_level,
        )
    )


def _run_generation(
    service: RewardsService,
    user: UserPayload,
    *,
    book_id: UUID,
    book: dict,
    spoiler_level: SpoilerLevel,
    idempotency_key: str | None,
) -> tuple[AIReviewGenerationRead, bool]:
    return service.generate_ai_review(
        user,
        book_id=book_id,
        spoiler_level=spoiler_level,
        book=book,
        generator=_generator,
        idempotency_key=idempotency_key,
    )


@router.post(
    "/books/{book_id}/review",
    response_model=ApiResponse[AIReviewGenerationRead],
    status_code=status.HTTP_201_CREATED,
)
async def generate_review(
    book_id: UUID,
    payload: AIReviewGenerateRequest,
    user: Customer,
    service: RewardsSvc,
    db: Db,
) -> ApiResponse[AIReviewGenerationRead]:
    """Buat (atau ambil ulang) ulasan AI untuk satu buku."""
    book = await load_book_for_read(book_id, db)
    try:
        generation, reused = await asyncio.to_thread(
            _run_generation,
            service,
            user,
            book_id=book_id,
            book=book,
            spoiler_level=payload.spoiler_level,
            idempotency_key=payload.idempotency_key,
        )
    except RewardsError as exc:
        raise _http(exc) from exc
    return ApiResponse(
        sukses=True,
        pesan="Ulasan AI berhasil diambil." if reused else "Ulasan AI berhasil dibuat.",
        data=generation,
    )


@router.get("/books/{book_id}/access", response_model=ApiResponse[dict])
async def review_access(
    book_id: UUID,
    user: Customer,
    service: RewardsSvc,
) -> ApiResponse[dict]:
    """Syarat tiap tingkat spoiler untuk buku ini (gratis / syarat beli / poin)."""
    try:
        access = await asyncio.to_thread(service.spoiler_access, user, book_id)
    except RewardsError as exc:
        raise _http(exc) from exc
    return ApiResponse(
        sukses=True,
        pesan="Akses ulasan AI berhasil dimuat.",
        data={level: item.model_dump(mode="json") for level, item in access.items()},
    )


@router.get("/reviews/{generation_id}", response_model=ApiResponse[AIReviewGenerationRead])
async def get_review(
    generation_id: UUID,
    user: Customer,
    service: RewardsSvc,
) -> ApiResponse[AIReviewGenerationRead]:
    """Hasil tersimpan; pemilik saja (selain itu 404)."""
    try:
        data = await asyncio.to_thread(service.get_generation, user, generation_id)
    except RewardsError as exc:
        raise _http(exc) from exc
    return ApiResponse(sukses=True, pesan="Ulasan AI berhasil dimuat.", data=data)


@router.get("/reviews", response_model=ApiResponse[list[AIReviewSummary]])
async def list_reviews(
    user: Customer,
    service: RewardsSvc,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
) -> ApiResponse[list[AIReviewSummary]]:
    items, _total = await asyncio.to_thread(
        service.list_generations, user, page=page, limit=limit
    )
    return ApiResponse(sukses=True, pesan="Riwayat ulasan AI berhasil dimuat.", data=items)
