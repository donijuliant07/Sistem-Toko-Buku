from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import require_staff_or_admin, UserPayload
from app.schemas.common import ApiResponse
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.services.category_service import category_service

router = APIRouter(prefix="/categories", tags=["Kategori"])


@router.get("", response_model=ApiResponse[List[CategoryResponse]])
async def list_categories():
    categories = category_service.get_all()
    return ApiResponse(
        sukses=True,
        pesan="Daftar kategori berhasil dimuat.",
        data=categories,
    )


@router.get("/{category_id}", response_model=ApiResponse[CategoryResponse])
async def get_category(category_id: str):
    cat = category_service.get_by_id(category_id)
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Kategori dengan ID {category_id} tidak ditemukan.",
        )
    return ApiResponse(
        sukses=True,
        pesan="Detail kategori berhasil dimuat.",
        data=cat,
    )


@router.post("", response_model=ApiResponse[CategoryResponse], status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    current_user: Annotated[UserPayload, Depends(require_staff_or_admin)],
):
    try:
        new_cat = category_service.create(payload)
        return ApiResponse(
            sukses=True,
            pesan=f"Kategori '{payload.name}' berhasil dibuat.",
            data=new_cat,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal menambahkan kategori: {str(e)}",
        )


@router.put("/{category_id}", response_model=ApiResponse[CategoryResponse])
async def update_category(
    category_id: str,
    payload: CategoryUpdate,
    current_user: Annotated[UserPayload, Depends(require_staff_or_admin)],
):
    existing = category_service.get_by_id(category_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Kategori dengan ID {category_id} tidak ditemukan.",
        )

    try:
        updated = category_service.update(category_id, payload)
        return ApiResponse(
            sukses=True,
            pesan="Kategori berhasil diperbarui.",
            data=updated,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal memperbarui kategori: {str(e)}",
        )


@router.delete("/{category_id}", response_model=ApiResponse[dict])
async def delete_category(
    category_id: str,
    current_user: Annotated[UserPayload, Depends(require_staff_or_admin)],
):
    existing = category_service.get_by_id(category_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Kategori dengan ID {category_id} tidak ditemukan.",
        )

    try:
        category_service.delete(category_id)
        return ApiResponse(
            sukses=True,
            pesan=f"Kategori '{existing.get('name')}' berhasil dihapus.",
            data={"id": category_id},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal menghapus kategori (mungkin masih digunakan pada produk): {str(e)}",
        )
