import math
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.security import require_staff_or_admin, UserPayload
from app.schemas.common import ApiResponse, PaginatedResponse, PaginationMeta
from app.schemas.inventory import StockAdjustmentRequest, StockMovementResponse
from app.schemas.product import ProductResponse
from app.services.inventory_service import inventory_service

router = APIRouter(prefix="/inventory", tags=["Inventori & Stok"])


@router.get("/movements", response_model=PaginatedResponse[StockMovementResponse])
async def list_stock_movements(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    product_id: Optional[str] = Query(None, description="Filter riwayat per ID produk"),
    current_user: Annotated[UserPayload, Depends(require_staff_or_admin)] = None,
):
    items, total = inventory_service.get_movements(
        page=page,
        limit=limit,
        product_id=product_id,
    )
    total_pages = math.ceil(total / limit) if total > 0 else 1

    return PaginatedResponse(
        sukses=True,
        pesan="Riwayat pergerakan stok berhasil dimuat.",
        data=items,
        meta=PaginationMeta(
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        ),
    )


@router.get("/low-stock", response_model=ApiResponse[list[ProductResponse]])
async def get_low_stock_products(
    current_user: Annotated[UserPayload, Depends(require_staff_or_admin)],
):
    low_stock_items = inventory_service.get_low_stock_products()
    return ApiResponse(
        sukses=True,
        pesan="Daftar produk stok kritis berhasil dimuat.",
        data=low_stock_items,
    )


@router.post("/adjust", response_model=ApiResponse[dict], status_code=status.HTTP_200_OK)
async def adjust_stock(
    payload: StockAdjustmentRequest,
    current_user: Annotated[UserPayload, Depends(require_staff_or_admin)],
):
    try:
        res = inventory_service.adjust_stock(payload, user_id=current_user.id)
        return ApiResponse(
            sukses=True,
            pesan="Stok produk berhasil diperbarui.",
            data=res,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal melakukan penyesuaian stok: {str(e)}",
        )
