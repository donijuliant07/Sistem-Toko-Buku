"""Pesanan dan layanan pengiriman.

Aturan akses:

- **Pelanggan** (`require_user`) hanya dapat membuat pesanan dan melihat
  pesanannya sendiri. Membuat pesanan selalu terikat ke `current_user.id`.
- **Admin** (`require_admin`) mengelola status, pembayaran, dan job kedaluwarsa,
  serta melihat seluruh pesanan.
- Detail pesanan milik pengguna lain dilaporkan **404**, bukan 403, supaya
  keberadaannya tidak terungkap.
"""

import math
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core import shipping
from app.core.errors import SERVICE_ERRORS
from app.core.security import UserPayload, get_current_user, require_admin, require_user
from app.schemas.common import ApiResponse, PaginatedResponse, PaginationMeta
from app.schemas.order import (
    OrderCreate,
    OrderResponse,
    OrderStatusUpdate,
    PaymentStatusUpdate,
)
from app.services.order_service import OrderTransitionError, order_service

router = APIRouter(prefix="/orders", tags=["Pesanan"])

# Prefix terpisah, file yang sama: satu-satunya konsumennya adalah alur pesanan.
shipping_router = APIRouter(prefix="/shipping-options", tags=["Pesanan"])


@shipping_router.get("", response_model=ApiResponse[list[dict]])
async def list_shipping_options():
    """Daftar layanan pengiriman dan tarifnya — sumber kebenaran untuk checkout.

    UI memakai ini agar tarif yang ditampilkan sama dengan yang dihitung backend.
    """
    options = [
        {"id": option_id, "courier": courier, "service": service, "fee": fee}
        for option_id, (courier, service, fee) in shipping.SHIPPING_OPTIONS.items()
    ]
    return ApiResponse(
        sukses=True,
        pesan="Daftar layanan pengiriman berhasil dimuat.",
        data=options,
    )


@router.get("", response_model=PaginatedResponse[OrderResponse])
async def list_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: str | None = Query(None, description="Cari No. Invoice"),
    status_filter: str | None = Query(None, alias="status", description="Filter status pesanan"),
    current_user: Annotated[UserPayload, Depends(get_current_user)] = None,
):
    # Admin melihat seluruh pesanan toko; pelanggan hanya pesanannya sendiri.
    user_id = None if current_user.role == "admin" else current_user.id

    items, total = order_service.get_list(
        page=page,
        limit=limit,
        search=search,
        status=status_filter,
        user_id=user_id,
    )
    total_pages = math.ceil(total / limit) if total > 0 else 1

    return PaginatedResponse(
        sukses=True,
        pesan="Daftar pesanan berhasil dimuat.",
        data=items,
        meta=PaginationMeta(
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        ),
    )


@router.get("/{order_id}", response_model=ApiResponse[OrderResponse])
async def get_order_detail(
    order_id: str,
    current_user: Annotated[UserPayload, Depends(get_current_user)],
):
    order = order_service.get_by_id(order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pesanan dengan ID {order_id} tidak ditemukan.",
        )

    # Pesanan milik pengguna lain selalu dilaporkan sebagai 404, bukan 403 —
    # konsisten dengan kebijakan proyek: keberadaan sumber daya yang bukan hak
    # pemanggil tidak boleh terungkap lewat kode status.
    if current_user.role != "admin" and order.get("user_id") != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pesanan dengan ID {order_id} tidak ditemukan.",
        )

    return ApiResponse(
        sukses=True,
        pesan="Detail pesanan berhasil dimuat.",
        data=order,
    )


@router.post("/expire-overdue", response_model=ApiResponse[dict])
async def expire_overdue_orders(
    current_user: Annotated[UserPayload, Depends(require_admin)],
):
    """Job: batalkan pesanan `pending` yang melewati `expires_at` dan kembalikan stok.

    Belum ada cron/scheduler di proyek ini, jadi pemanggilan dilakukan dari luar
    (mis. cron harian) atau manual oleh admin.
    """
    try:
        expired = order_service.expire_overdue_orders()
        return ApiResponse(
            sukses=True,
            pesan=f"{len(expired)} pesanan kedaluwarsa dibatalkan.",
            data={"expired_order_ids": expired},
        )
    except SERVICE_ERRORS as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal membatalkan pesanan kedaluwarsa: {e!s}",
        )


@router.post("", response_model=ApiResponse[OrderResponse], status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreate,
    current_user: Annotated[UserPayload, Depends(require_user)],
):
    # Pesanan selalu terikat ke pemilik sesi; tidak ada cara membuat pesanan
    # atas nama pengguna lain. Admin tidak boleh checkout dengan akun adminnya.
    try:
        order = order_service.create(payload, user_id=current_user.id)
        return ApiResponse(
            sukses=True,
            pesan="Pesanan berhasil dibuat.",
            data=order,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except SERVICE_ERRORS as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal membuat pesanan: {e!s}",
        )


@router.patch("/{order_id}/status", response_model=ApiResponse[dict])
async def update_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    current_user: Annotated[UserPayload, Depends(require_admin)],
):
    try:
        res = order_service.update_status(order_id, payload)
        return ApiResponse(
            sukses=True,
            pesan=f"Status pesanan berhasil diubah menjadi '{payload.status}'.",
            data=res,
        )
    except OrderTransitionError as e:
        # Aturan bisnis (mis. selesaikan sebelum pembayaran dikonfirmasi) bukan 404.
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from None
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except SERVICE_ERRORS as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal memperbarui status pesanan: {e!s}",
        )


@router.patch("/{order_id}/payment", response_model=ApiResponse[dict])
async def update_payment_status(
    order_id: str,
    payload: PaymentStatusUpdate,
    current_user: Annotated[UserPayload, Depends(require_admin)],
):
    """Konfirmasi manual pembayaran. Tidak ada payment gateway, jadi hanya admin
    yang boleh menandai pembayaran; tidak ada aksi UI yang melakukannya otomatis."""
    try:
        res = order_service.update_payment_status(order_id, payload.status)
        return ApiResponse(
            sukses=True,
            pesan=f"Status pembayaran berhasil diubah menjadi '{payload.status}'.",
            data=res,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except SERVICE_ERRORS as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal memperbarui status pembayaran: {e!s}",
        )

