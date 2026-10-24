"""Pembayaran manual: instruksi, bukti transfer, dan verifikasi admin.

Dua router dalam satu modul:

- `router` (`/orders/{order_id}/payment...`) — pelanggan, `require_user`.
  Pemilik pesanan ditentukan backend dari sesi; ID pesanan milik orang lain
  dilaporkan 404.
- `admin_router` (`/admin/payments...`) — `require_admin`. Approve/reject hanya
  di sini; tidak ada endpoint publik yang bisa menulis status final.

Tidak ada payment gateway. Unggahan bukti hanya memindahkan status ke
`under_review`; `paid` muncul semata-mata dari keputusan admin.
"""

import asyncio
import math
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, UploadFile

from app.core.security import UserPayload, require_admin, require_user
from app.schemas.common import ApiResponse, PaginatedResponse, PaginationMeta
from app.schemas.payment import (
    PaymentAdminListItem,
    PaymentDetailRead,
    PaymentRead,
    PaymentStatusView,
    RejectPaymentRequest,
)
from app.services.payment_service import PaymentError, http_error, payment_service

router = APIRouter(prefix="/orders", tags=["Pembayaran"])
admin_router = APIRouter(prefix="/admin/payments", tags=["Pembayaran Admin"])

User = Annotated[UserPayload, Depends(require_user)]
Admin = Annotated[UserPayload, Depends(require_admin)]


@router.get("/{order_id}/payment", response_model=ApiResponse[PaymentRead])
async def get_order_payment(order_id: str, user: User) -> ApiResponse[PaymentRead]:
    """Instruksi pembayaran + status + bukti terakhir milik pesanan ini."""
    try:
        data = await asyncio.to_thread(payment_service.get_for_owner, order_id, user.id)
    except PaymentError as exc:
        raise http_error(exc) from None
    return ApiResponse(sukses=True, pesan="Data pembayaran berhasil dimuat.", data=data)


@router.get("/{order_id}/payment/proofs", response_model=ApiResponse[list])
async def list_order_proofs(order_id: str, user: User) -> ApiResponse[list]:
    """Riwayat bukti (termasuk yang ditolak), terlama dulu untuk kronologi."""
    try:
        data = await asyncio.to_thread(payment_service.get_for_owner, order_id, user.id)
    except PaymentError as exc:
        raise http_error(exc) from None
    return ApiResponse(
        sukses=True,
        pesan="Riwayat bukti pembayaran berhasil dimuat.",
        data=sorted(data.history, key=lambda proof: str(proof.uploaded_at)),
    )


@router.post("/{order_id}/payment/proof", response_model=ApiResponse[PaymentRead])
async def submit_payment_proof(
    order_id: str,
    user: User,
    file: Annotated[UploadFile, File()],
) -> ApiResponse[PaymentRead]:
    """Unggah/ganti bukti transfer. Hasilnya `under_review`, bukan `paid`."""
    file_bytes = await file.read()
    try:
        data = await asyncio.to_thread(
            payment_service.submit_proof,
            order_id,
            user.id,
            file_bytes,
            file.filename,
            file.content_type,
        )
    except PaymentError as exc:
        raise http_error(exc) from None
    return ApiResponse(
        sukses=True,
        pesan="Bukti pembayaran terkirim. Menunggu verifikasi admin.",
        data=data,
    )


@admin_router.get("", response_model=PaginatedResponse[PaymentAdminListItem])
async def list_payments(
    admin: Admin,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status_filter: PaymentStatusView | None = Query(default=None, alias="status"),
    search: str | None = Query(None, description="Cari nomor pesanan atau nama pembeli"),
) -> PaginatedResponse[PaymentAdminListItem]:
    items, total = await asyncio.to_thread(
        payment_service.list_for_admin, page, limit, status_filter, search
    )
    return PaginatedResponse(
        sukses=True,
        pesan="Daftar pembayaran berhasil dimuat.",
        data=items,
        meta=PaginationMeta(
            total=total,
            page=page,
            limit=limit,
            total_pages=math.ceil(total / limit) if total > 0 else 1,
        ),
    )


@admin_router.get("/{payment_id}", response_model=ApiResponse[PaymentDetailRead])
async def get_payment_detail(payment_id: str, admin: Admin) -> ApiResponse[PaymentDetailRead]:
    """Pembayaran + ringkasan pesanan + semua bukti (signed URL)."""
    try:
        data = await asyncio.to_thread(payment_service.get_for_admin, payment_id)
    except PaymentError as exc:
        raise http_error(exc) from None
    return ApiResponse(sukses=True, pesan="Detail pembayaran berhasil dimuat.", data=data)


@admin_router.post("/{payment_id}/approve", response_model=ApiResponse[PaymentRead])
async def approve_payment(payment_id: str, admin: Admin) -> ApiResponse[PaymentRead]:
    try:
        data = await asyncio.to_thread(payment_service.approve, payment_id, admin.id)
    except PaymentError as exc:
        raise http_error(exc) from None
    return ApiResponse(sukses=True, pesan="Pembayaran dikonfirmasi.", data=data)


@admin_router.post("/{payment_id}/reject", response_model=ApiResponse[PaymentRead])
async def reject_payment(
    payment_id: str, payload: RejectPaymentRequest, admin: Admin
) -> ApiResponse[PaymentRead]:
    """Alasan wajib; user melihatnya dan dapat mengunggah bukti baru."""
    try:
        data = await asyncio.to_thread(
            payment_service.reject, payment_id, admin.id, payload.reason
        )
    except PaymentError as exc:
        raise http_error(exc) from None
    return ApiResponse(sukses=True, pesan="Pembayaran ditolak.", data=data)
