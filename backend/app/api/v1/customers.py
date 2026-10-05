import math
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query
from app.core.security import require_staff_or_admin, UserPayload
from app.schemas.common import PaginatedResponse, PaginationMeta
from app.schemas.customer import CustomerResponse
from app.services.customer_service import customer_service

router = APIRouter(prefix="/customers", tags=["Pelanggan"])


@router.get("", response_model=PaginatedResponse[CustomerResponse])
async def list_customers(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None, description="Cari nama atau email pelanggan"),
    current_user: Annotated[UserPayload, Depends(require_staff_or_admin)] = None,
):
    items, total = customer_service.get_list(
        page=page,
        limit=limit,
        search=search,
    )
    total_pages = math.ceil(total / limit) if total > 0 else 1

    return PaginatedResponse(
        sukses=True,
        pesan="Daftar pelanggan berhasil dimuat.",
        data=items,
        meta=PaginationMeta(
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        ),
    )
