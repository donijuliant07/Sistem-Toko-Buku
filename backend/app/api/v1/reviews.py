"""Endpoint ulasan buku.

Pola yang sama dengan endpoint community: router hanya menerjemahkan
HTTP ↔ `ReviewService`, dan `CommunityError` menjadi `HTTPException` dengan
detail Bahasa Indonesia. Izin, spam, dan batas harian diputuskan di service.

- `GET  /books/{book_id}/reviews` — publik? Tidak: seluruh API wajib login
  (sama dengan katalog), jadi `get_current_user`.
- `POST /books/{book_id}/reviews` — pengguna (`require_user`).
- `PATCH /reviews/{id}` — penulis atau admin.
- `GET  /reviews/me` — daftar milik sendiri.
- `GET  /admin/reviews` + `POST /admin/reviews/{id}/moderate` — admin.

`user_id` tidak pernah dibaca dari body; identitas selalu dari token.
"""

from __future__ import annotations

import asyncio
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import UserPayload, get_current_user, require_admin, require_user
from app.db.session import get_db
from app.schemas.common import ApiResponse
from app.schemas.review import (
    ReviewCreate,
    ReviewModeration,
    ReviewPage,
    ReviewQueuePage,
    ReviewRead,
    ReviewUpdate,
)
from app.services.community.errors import CommunityError
from app.services.review_repository import OrmReviewRepository
from app.services.review_service import ReviewService
from app.services.rewards.service import rewards_service

router = APIRouter(tags=["reviews"])

CurrentUser = Annotated[UserPayload, Depends(get_current_user)]
Customer = Annotated[UserPayload, Depends(require_user)]
Admin = Annotated[UserPayload, Depends(require_admin)]
Db = Annotated[AsyncSession, Depends(get_db)]


def get_review_service(db: Db) -> ReviewService:
    """Service ulasan; provider terpisah agar mudah diganti di tes."""
    return ReviewService(OrmReviewRepository(db), on_approved=_reward_approved_review)


async def _reward_approved_review(admin: UserPayload, review: ReviewRead) -> None:
    """Hook Book Rewards: beri poin ulasan yang baru disetujui.

    Dijalankan sebelum commit moderasi, sehingga kegagalan ledger membatalkan
    keputusan — tidak ada ulasan "approved" tanpa reward. Ledger berjalan di
    koneksi PostgREST terpisah (sinkron) karena RPC `apply_point_transaction`
    hanya tersedia untuk `service_role`; idempotensinya per (pengguna, buku)
    membuat pemanggilan ulang aman.
    """
    await asyncio.to_thread(
        rewards_service.reward_review,
        review_id=review.id,
        reviewer=admin.id,
    )


ReviewSvc = Annotated[ReviewService, Depends(get_review_service)]


def _http(exc: CommunityError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


def _ok(data: Any, pesan: str) -> ApiResponse[Any]:
    return ApiResponse(sukses=True, pesan=pesan, data=data)


@router.get("/books/{book_id}/reviews", response_model=ApiResponse[ReviewPage])
async def list_reviews(
    book_id: UUID,
    current_user: CurrentUser,
    service: ReviewSvc,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> ApiResponse[ReviewPage]:
    """Ulasan tayang (approved/rewarded) untuk satu buku + rata-rata rating."""
    try:
        data = await service.list_visible(book_id, page=page, limit=limit)
    except CommunityError as exc:
        raise _http(exc) from None
    return _ok(data, "Daftar ulasan berhasil diambil.")


@router.post(
    "/books/{book_id}/reviews",
    response_model=ApiResponse[ReviewRead],
    status_code=status.HTTP_201_CREATED,
)
async def create_review(
    book_id: UUID,
    payload: ReviewCreate,
    current_user: Customer,
    service: ReviewSvc,
) -> ApiResponse[ReviewRead]:
    """Tulis ulasan baru (selalu `pending` sampai dimoderasi)."""
    try:
        data = await service.create(current_user, book_id, payload)
    except CommunityError as exc:
        raise _http(exc) from None
    return _ok(data, "Ulasan terkirim dan menunggu moderasi.")


@router.get("/reviews/me", response_model=ApiResponse[list[ReviewRead]])
async def list_my_reviews(
    current_user: Customer, service: ReviewSvc
) -> ApiResponse[list[ReviewRead]]:
    """Semua ulasan milik pengguna, termasuk yang pending/rejected."""
    try:
        data = await service.list_mine(current_user)
    except CommunityError as exc:
        raise _http(exc) from None
    return _ok(data, "Daftar ulasan saya berhasil diambil.")


@router.patch("/reviews/{review_id}", response_model=ApiResponse[ReviewRead])
async def update_review(
    review_id: UUID,
    payload: ReviewUpdate,
    current_user: Customer,
    service: ReviewSvc,
) -> ApiResponse[ReviewRead]:
    """Edit ulasan sendiri. Ulasan yang sudah mendapat poin tidak dapat diubah."""
    try:
        data = await service.update(current_user, review_id, payload)
    except CommunityError as exc:
        raise _http(exc) from None
    return _ok(data, "Ulasan berhasil diperbarui.")


@router.get("/admin/reviews", response_model=ApiResponse[ReviewQueuePage])
async def list_reviews_for_moderation(
    admin: Admin,
    service: ReviewSvc,
    status_filter: Annotated[
        str | None,
        Query(alias="status", pattern="^(pending|approved|rejected|rewarded)$"),
    ] = "pending",
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> ApiResponse[ReviewQueuePage]:
    """Antrean moderasi (default: yang masih pending), terlama lebih dulu."""
    try:
        items, total, total_pages = await service.list_for_moderation(
            status=status_filter, page=page, limit=limit
        )
    except CommunityError as exc:
        raise _http(exc) from None
    data = ReviewQueuePage(
        items=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )
    return _ok(data, "Antrean moderasi berhasil diambil.")


@router.post(
    "/admin/reviews/{review_id}/moderate", response_model=ApiResponse[ReviewRead]
)
async def moderate_review(
    review_id: UUID,
    payload: ReviewModeration,
    admin: Admin,
    service: ReviewSvc,
) -> ApiResponse[ReviewRead]:
    """Setujui atau tolak ulasan. Keputusan yang sudah final tidak bisa diubah."""
    try:
        data = await service.moderate(admin, review_id, payload)
    except CommunityError as exc:
        raise _http(exc) from None
    pesan = "Ulasan disetujui." if payload.status == "approved" else "Ulasan ditolak."
    return _ok(data, pesan)


__all__ = ["router"]
