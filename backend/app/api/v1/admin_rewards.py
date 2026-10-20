"""Endpoint admin Book Rewards.

- Aturan reward (`GET/PATCH /admin/rewards/rules`) — perubahan tercatat di
  `reward_rules_audit` lewat RPC `set_reward_rules`.
- Penyesuaian saldo manual, wajib beralasan dan tercatat di ledger.
- Backfill untuk data lama, dan rekonsiliasi saldo cache vs ledger.
- Antrean aktivitas reward (ulasan/kontribusi/jawaban membantu).

Seluruhnya `require_admin`; `supabase_admin` menembus RLS, jadi otorisasi
**tidak** boleh mengandalkan database.
"""

from __future__ import annotations

import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import UserPayload, require_admin
from app.schemas.common import ApiResponse
from app.schemas.rewards import (
    AdminAdjustmentRequest,
    BackfillReport,
    ReconcileReport,
    RewardActivityPage,
    RewardRulesRead,
    RewardRulesUpdate,
)
from app.services.rewards.errors import RewardsError
from app.services.rewards.service import RewardsService, rewards_service

router = APIRouter(prefix="/admin/rewards", tags=["admin-rewards"])

Admin = Annotated[UserPayload, Depends(require_admin)]


def get_rewards_service() -> RewardsService:
    return rewards_service


RewardsSvc = Annotated[RewardsService, Depends(get_rewards_service)]


def _http(exc: RewardsError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


@router.get("/rules", response_model=ApiResponse[RewardRulesRead])
async def list_rules(admin: Admin, service: RewardsSvc) -> ApiResponse[RewardRulesRead]:
    data = await asyncio.to_thread(service.list_rules)
    return ApiResponse(sukses=True, pesan="Aturan reward berhasil dimuat.", data=data)


@router.patch("/rules", response_model=ApiResponse[RewardRulesRead])
async def update_rules(
    payload: RewardRulesUpdate, admin: Admin, service: RewardsSvc
) -> ApiResponse[RewardRulesRead]:
    try:
        data = await asyncio.to_thread(service.update_rules, admin, payload.values)
    except RewardsError as exc:
        raise _http(exc) from exc
    return ApiResponse(sukses=True, pesan="Aturan reward berhasil diperbarui.", data=data)


@router.post("/adjustments", response_model=ApiResponse[dict])
async def adjust_points(
    payload: AdminAdjustmentRequest, admin: Admin, service: RewardsSvc
) -> ApiResponse[dict]:
    """Penyesuaian manual; `reason` wajib dan tersimpan di metadata ledger."""
    try:
        result = await asyncio.to_thread(
            service.adjust_points,
            admin,
            user_id=payload.user_id,
            delta=payload.delta,
            reason=payload.reason,
            reference=payload.reference,
        )
    except RewardsError as exc:
        raise _http(exc) from exc
    return ApiResponse(
        sukses=True,
        pesan="Penyesuaian poin berhasil dicatat.",
        data={
            "transaction_id": str(result.transaction_id),
            "points_delta": result.points_delta,
            "balance_after": result.balance_after,
        },
    )


@router.post("/backfill", response_model=ApiResponse[BackfillReport])
async def backfill(admin: Admin, service: RewardsSvc) -> ApiResponse[BackfillReport]:
    """Beri reward susulan untuk pesanan/ulasan/kontribusi lama. Aman diulang."""
    data = await asyncio.to_thread(service.backfill, admin)
    return ApiResponse(sukses=True, pesan="Backfill reward selesai.", data=data)


@router.get("/reconcile", response_model=ApiResponse[ReconcileReport])
async def reconcile(admin: Admin, service: RewardsSvc) -> ApiResponse[ReconcileReport]:
    """Bandingkan `profiles.points` dengan jumlah ledger (tanpa memperbaiki)."""
    data = await asyncio.to_thread(service.reconcile)
    return ApiResponse(sukses=True, pesan="Rekonsiliasi saldo selesai.", data=data)


@router.get("/activities", response_model=ApiResponse[RewardActivityPage])
async def list_activities(
    admin: Admin,
    service: RewardsSvc,
    status_filter: str | None = Query(
        default=None,
        alias="status",
        pattern="^(pending|approved|rejected|rewarded)$",
    ),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> ApiResponse[RewardActivityPage]:
    data = await asyncio.to_thread(
        service.list_activities, status=status_filter, page=page, limit=limit
    )
    return ApiResponse(sukses=True, pesan="Aktivitas reward berhasil dimuat.", data=data)


@router.post("/ai/recover", response_model=ApiResponse[dict])
async def recover_stale_ai(admin: Admin, service: RewardsSvc) -> ApiResponse[dict]:
    """Job: refund generasi AI `pending` yang prosesnya mati."""
    recovered = await asyncio.to_thread(service.recover_stale_generations)
    return ApiResponse(
        sukses=True,
        pesan="Pemulihan generasi AI selesai.",
        data={"recovered": recovered},
    )
