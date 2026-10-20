"""Endpoint Book Rewards untuk pelanggan.

Semua endpoint memakai identitas token; `user_id` tidak pernah dari query/body.
Ledger dan aturan diputuskan `RewardsService`, router hanya menerjemahkan
`RewardsError` → `HTTPException` (detail diawali kode mesin, mis.
`INSUFFICIENT_POINTS: ...`).
"""

from __future__ import annotations

import asyncio
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import UserPayload, require_user
from app.schemas.common import ApiResponse
from app.schemas.rewards import PointTransactionPage, RewardsMe, SpoilerAccessRead
from app.services.rewards.errors import RewardsError
from app.services.rewards.service import RewardsService, rewards_service

router = APIRouter(prefix="/rewards", tags=["rewards"])

Customer = Annotated[UserPayload, Depends(require_user)]


def get_rewards_service() -> RewardsService:
    """Provider terpisah agar tes dapat menyuntikkan ledger/repository palsu."""
    return rewards_service


RewardsSvc = Annotated[RewardsService, Depends(get_rewards_service)]


def _http(exc: RewardsError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


@router.get("/me", response_model=ApiResponse[RewardsMe])
async def my_rewards(
    user: Customer,
    service: RewardsSvc,
    book_id: UUID | None = Query(
        default=None, description="Hitung akses spoiler untuk buku tertentu"
    ),
) -> ApiResponse[RewardsMe]:
    try:
        data = await asyncio.to_thread(service.get_me, user, book_id=book_id)
    except RewardsError as exc:
        raise _http(exc) from exc
    return ApiResponse(sukses=True, pesan="Ringkasan poin berhasil dimuat.", data=data)


@router.get("/transactions", response_model=ApiResponse[PointTransactionPage])
async def my_transactions(
    user: Customer,
    service: RewardsSvc,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> ApiResponse[PointTransactionPage]:
    try:
        data = await asyncio.to_thread(service.list_transactions, user, page=page, limit=limit)
    except RewardsError as exc:
        raise _http(exc) from exc
    return ApiResponse(sukses=True, pesan="Riwayat poin berhasil dimuat.", data=data)


@router.get("/spoiler-access", response_model=ApiResponse[dict[str, SpoilerAccessRead]])
async def spoiler_access(
    user: Customer,
    service: RewardsSvc,
    book_id: UUID = Query(..., description="Buku yang akan dibuka ulasan AI-nya"),
) -> ApiResponse[dict[str, SpoilerAccessRead]]:
    try:
        data = await asyncio.to_thread(service.spoiler_access, user, book_id)
    except RewardsError as exc:
        raise _http(exc) from exc
    return ApiResponse(sukses=True, pesan="Akses ulasan AI berhasil dimuat.", data=data)
