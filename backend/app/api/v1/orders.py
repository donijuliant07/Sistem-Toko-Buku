import math
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.security import get_current_user, require_staff_or_admin, UserPayload
from app.schemas.common import ApiResponse, PaginatedResponse, PaginationMeta
from app.schemas.order import OrderCreate, OrderStatusUpdate, OrderResponse
from app.services.order_service import order_service

router = APIRouter(prefix="/orders", tags=["Pesanan"])


@router.get("", response_model=PaginatedResponse[OrderResponse])
async def list_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None, description="Cari No. Invoice atau nama pelanggan"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter status pesanan"),
    current_user: Annotated[UserPayload, Depends(get_current_user)] = None,
):
    customer_id = None if current_user.role in ["admin", "staff"] else current_user.id

    items, total = order_service.get_list(
        page=page,
        limit=limit,
        search=search,
        status=status_filter,
        customer_id=customer_id,
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

    if current_user.role not in ["admin", "staff"] and order.get("customer_id") != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda tidak memiliki akses untuk melihat pesanan ini.",
        )

    return ApiResponse(
        sukses=True,
        pesan="Detail pesanan berhasil dimuat.",
        data=order,
    )


@router.post("", response_model=ApiResponse[OrderResponse], status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreate,
    current_user: Annotated[Optional[UserPayload], Depends(get_current_user)] = None,
):
    try:
        cust_id = current_user.id if current_user else None
        order = order_service.create(payload, customer_id=cust_id)
        return ApiResponse(
            sukses=True,
            pesan="Pesanan berhasil dibuat.",
            data=order,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal membuat pesanan: {str(e)}",
        )


@router.patch("/{order_id}/status", response_model=ApiResponse[dict])
async def update_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    current_user: Annotated[UserPayload, Depends(require_staff_or_admin)],
):
    order = order_service.get_by_id(order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pesanan dengan ID {order_id} tidak ditemukan.",
        )

    try:
        res = order_service.update_status(order_id, payload, user_id=current_user.id)
        return ApiResponse(
            sukses=True,
            pesan=f"Status pesanan berhasil diubah menjadi '{payload.status}'.",
            data=res,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal memperbarui status pesanan: {str(e)}",
        )
