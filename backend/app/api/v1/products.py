import math
from typing import Annotated, Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.security import require_staff_or_admin, UserPayload
from app.schemas.common import ApiResponse, PaginatedResponse, PaginationMeta
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse
from app.services.product_service import product_service

router = APIRouter(prefix="/products", tags=["Produk & Buku"])


@router.get("", response_model=PaginatedResponse[ProductResponse])
async def list_products(
    page: int = Query(1, ge=1, description="Nomor halaman"),
    limit: int = Query(10, ge=1, le=100, description="Jumlah data per halaman"),
    search: Optional[str] = Query(None, description="Pencarian judul, penulis, atau ISBN"),
    category_id: Optional[str] = Query(None, description="Filter berdasarkan ID kategori"),
    type: Optional[Literal["Buku", "Non-Buku"]] = Query(None, description="Filter tipe barang"),
    status: Optional[Literal["Aktif", "Draft", "Habis"]] = Query(None, description="Filter status produk"),
    sort_by: str = Query("created_at", description="Kolom pengurutan"),
    sort_order: Literal["asc", "desc"] = Query("desc", description="Arah pengurutan"),
):
    items, total = product_service.get_list(
        page=page,
        limit=limit,
        search=search,
        category_id=category_id,
        product_type=type,
        status=status,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    total_pages = math.ceil(total / limit) if total > 0 else 1

    return PaginatedResponse(
        sukses=True,
        pesan="Daftar produk berhasil dimuat.",
        data=items,
        meta=PaginationMeta(
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        ),
    )


@router.get("/{product_id}", response_model=ApiResponse[ProductResponse])
async def get_product_detail(product_id: str):
    product = product_service.get_by_id(product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Produk dengan ID {product_id} tidak ditemukan.",
        )
    return ApiResponse(
        sukses=True,
        pesan="Detail produk berhasil dimuat.",
        data=product,
    )


@router.post("", response_model=ApiResponse[ProductResponse], status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    current_user: Annotated[UserPayload, Depends(require_staff_or_admin)],
):
    try:
        new_prod = product_service.create(payload)
        return ApiResponse(
            sukses=True,
            pesan=f"Produk '{payload.title}' berhasil ditambahkan.",
            data=new_prod,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal menambahkan produk: {str(e)}",
        )


@router.put("/{product_id}", response_model=ApiResponse[ProductResponse])
async def update_product(
    product_id: str,
    payload: ProductUpdate,
    current_user: Annotated[UserPayload, Depends(require_staff_or_admin)],
):
    existing = product_service.get_by_id(product_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Produk dengan ID {product_id} tidak ditemukan.",
        )

    try:
        updated = product_service.update(product_id, payload)
        return ApiResponse(
            sukses=True,
            pesan="Data produk berhasil diperbarui.",
            data=updated,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal memperbarui produk: {str(e)}",
        )


@router.delete("/{product_id}", response_model=ApiResponse[dict])
async def delete_product(
    product_id: str,
    current_user: Annotated[UserPayload, Depends(require_staff_or_admin)],
):
    existing = product_service.get_by_id(product_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Produk dengan ID {product_id} tidak ditemukan.",
        )

    product_service.delete(product_id)
    return ApiResponse(
        sukses=True,
        pesan=f"Produk '{existing.get('title')}' berhasil dihapus dari katalog.",
        data={"id": product_id},
    )
