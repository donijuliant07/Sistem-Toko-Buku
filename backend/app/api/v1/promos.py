from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.security import require_staff_or_admin, UserPayload
from app.schemas.common import ApiResponse
from app.schemas.promo import PromoCreate, PromoUpdate, PromoResponse
from app.services.promo_service import promo_service

router = APIRouter(prefix="/promos", tags=["Voucher & Promo"])


@router.get("", response_model=ApiResponse[List[PromoResponse]])
async def list_promos(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: Annotated[UserPayload, Depends(require_staff_or_admin)] = None,
):
    promos = promo_service.get_all(status_filter=status_filter)
    return ApiResponse(
        sukses=True,
        pesan="Daftar voucher promo berhasil dimuat.",
        data=promos,
    )


@router.post("", response_model=ApiResponse[PromoResponse], status_code=status.HTTP_201_CREATED)
async def create_promo(
    payload: PromoCreate,
    current_user: Annotated[UserPayload, Depends(require_staff_or_admin)],
):
    existing = promo_service.get_by_code(payload.code)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Kode voucher '{payload.code}' sudah digunakan.",
        )

    try:
        new_promo = promo_service.create(payload)
        return ApiResponse(
            sukses=True,
            pesan=f"Voucher promo '{payload.title}' berhasil dibuat.",
            data=new_promo,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal membuat promo: {str(e)}",
        )


@router.patch("/{promo_id}/toggle", response_model=ApiResponse[PromoResponse])
async def toggle_promo_status(
    promo_id: str,
    is_active: bool = Query(..., description="Status aktifkan atau nonaktifkan voucher"),
    current_user: Annotated[UserPayload, Depends(require_staff_or_admin)] = None,
):
    try:
        updated = promo_service.toggle_status(promo_id, is_active)
        status_text = "diaktifkan" if is_active else "dinonaktifkan"
        return ApiResponse(
            sukses=True,
            pesan=f"Voucher berhasil {status_text}.",
            data=updated,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal mengubah status voucher: {str(e)}",
        )
