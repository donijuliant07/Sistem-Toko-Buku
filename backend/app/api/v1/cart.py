from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import UserPayload, require_user
from app.schemas.cart import (
    CartItemAdd,
    CartItemUpdate,
    CartMergeInput,
    CartResponse,
)
from app.schemas.common import ApiResponse
from app.services.cart_service import CartItemNotFound, cart_service

router = APIRouter(prefix="/cart", tags=["Keranjang"])


@router.get("", response_model=ApiResponse[CartResponse])
async def get_cart(
    current_user: Annotated[UserPayload, Depends(require_user)],
):
    """Isi keranjang milik user yang sedang login, dengan harga/stok terkini.

    Harga dan stok dibaca dari `books` pada setiap permintaan, jadi keranjang
    tidak pernah menyajikan angka basi dari sisi client.
    """
    try:
        data = cart_service.get(current_user.id)
        return ApiResponse(sukses=True, pesan="Keranjang berhasil dimuat.", data=data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal memuat keranjang: {str(e)}",
        )


@router.post("/items", response_model=ApiResponse[CartResponse], status_code=status.HTTP_201_CREATED)
async def add_cart_item(
    payload: CartItemAdd,
    current_user: Annotated[UserPayload, Depends(require_user)],
):
    try:
        data = cart_service.add_item(current_user.id, payload.book_id, payload.quantity)
        return ApiResponse(sukses=True, pesan="Buku ditambahkan ke keranjang.", data=data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal menambahkan ke keranjang: {str(e)}",
        )


@router.patch("/items/{item_id}", response_model=ApiResponse[CartResponse])
async def update_cart_item(
    item_id: str,
    payload: CartItemUpdate,
    current_user: Annotated[UserPayload, Depends(require_user)],
):
    try:
        data = cart_service.update_item(current_user.id, item_id, payload.quantity)
        return ApiResponse(sukses=True, pesan="Jumlah buku diperbarui.", data=data)
    except CartItemNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal memperbarui keranjang: {str(e)}",
        )


@router.delete("/items/{item_id}", response_model=ApiResponse[CartResponse])
async def remove_cart_item(
    item_id: str,
    current_user: Annotated[UserPayload, Depends(require_user)],
):
    try:
        data = cart_service.remove_item(current_user.id, item_id)
        return ApiResponse(sukses=True, pesan="Buku dihapus dari keranjang.", data=data)
    except CartItemNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal menghapus dari keranjang: {str(e)}",
        )


@router.delete("", response_model=ApiResponse[CartResponse])
async def clear_cart(
    current_user: Annotated[UserPayload, Depends(require_user)],
):
    """Kosongkan keranjang. Dipanggil setelah pesanan berhasil dibuat."""
    try:
        data = cart_service.clear(current_user.id)
        return ApiResponse(sukses=True, pesan="Keranjang dikosongkan.", data=data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal mengosongkan keranjang: {str(e)}",
        )


@router.post("/merge", response_model=ApiResponse[CartResponse])
async def merge_cart(
    payload: CartMergeInput,
    current_user: Annotated[UserPayload, Depends(require_user)],
):
    """Gabungkan keranjang tamu (localStorage) ke keranjang server setelah login.

    Baris yang stoknya sudah tidak cukup dilewati, bukan menggagalkan permintaan.
    """
    try:
        data = cart_service.merge(current_user.id, payload.items)
        return ApiResponse(sukses=True, pesan="Keranjang digabungkan.", data=data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal menggabungkan keranjang: {str(e)}",
        )
