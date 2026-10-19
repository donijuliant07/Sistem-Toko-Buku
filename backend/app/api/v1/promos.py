"""Voucher dan diskon. Seluruh endpoint khusus admin.

Endpoint ini mengelola kelola promo; penerapan diskon pada checkout belum
tersedia (`OrderService.create` menolak `promo_code`).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.errors import SERVICE_ERRORS
from app.core.security import UserPayload, require_admin
from app.schemas.common import ApiResponse
from app.schemas.promo import PromoCreate, PromoResponse, PromoUpdate
from app.services.promo_service import PromoNotFound, promo_service

router = APIRouter(prefix="/promos", tags=["Promo"])


@router.get("", response_model=ApiResponse[list[PromoResponse]])
async def list_promos(
    current_user: Annotated[UserPayload, Depends(require_admin)],
):
    """Seluruh promo (termasuk nonaktif & terjadwal) untuk halaman admin."""
    return ApiResponse(
        sukses=True,
        pesan="Daftar promo berhasil dimuat.",
        data=promo_service.get_all(),
    )


@router.post("", response_model=ApiResponse[PromoResponse], status_code=status.HTTP_201_CREATED)
async def create_promo(
    payload: PromoCreate,
    current_user: Annotated[UserPayload, Depends(require_admin)],
):
    try:
        promo = promo_service.create(payload)
    except SERVICE_ERRORS as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal membuat promo: {exc}",
        )
    return ApiResponse(sukses=True, pesan="Promo berhasil dibuat.", data=promo)


@router.patch("/{promo_id}", response_model=ApiResponse[PromoResponse])
async def update_promo(
    promo_id: str,
    payload: PromoUpdate,
    current_user: Annotated[UserPayload, Depends(require_admin)],
):
    try:
        promo = promo_service.update(promo_id, payload)
    except PromoNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        # Rentang tanggal tidak valid setelah patch.
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except SERVICE_ERRORS as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal memperbarui promo: {exc}",
        )
    return ApiResponse(sukses=True, pesan="Promo berhasil diperbarui.", data=promo)


@router.delete("/{promo_id}", response_model=ApiResponse[dict])
async def delete_promo(
    promo_id: str,
    current_user: Annotated[UserPayload, Depends(require_admin)],
):
    try:
        promo_service.delete(promo_id)
    except PromoNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except SERVICE_ERRORS as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal menghapus promo: {exc}",
        )
    return ApiResponse(sukses=True, pesan="Promo berhasil dihapus.", data={"id": promo_id})
