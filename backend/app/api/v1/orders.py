import math
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core import shipping
from app.core.security import get_current_user, require_admin, require_user, UserPayload
from app.schemas.common import ApiResponse, PaginatedResponse, PaginationMeta
from app.schemas.order import OrderCreate, OrderStatusUpdate, PaymentStatusUpdate, OrderResponse
from app.services.order_service import order_service

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
    search: Optional[str] = Query(None, description="Cari No. Invoice"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter status pesanan"),
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

    if current_user.role != "admin" and order.get("user_id") != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda tidak memiliki akses untuk melihat pesanan ini.",
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal membatalkan pesanan kedaluwarsa: {str(e)}",
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal membuat pesanan: {str(e)}",
        )


@router.patch("/{order_id}/status", response_model=ApiResponse[dict])
async def update_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    current_user: Annotated[UserPayload, Depends(require_admin)],
):
    try:
        res = order_service.update_status(order_id, payload, user_id=current_user.id)
        return ApiResponse(
            sukses=True,
            pesan=f"Status pesanan berhasil diubah menjadi '{payload.status}'.",
            data=res,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal memperbarui status pesanan: {str(e)}",
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal memperbarui status pembayaran: {str(e)}",
        )

