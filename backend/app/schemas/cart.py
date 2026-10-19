
from pydantic import BaseModel, Field


class CartItemAdd(BaseModel):
    """Tambah satu buku ke keranjang.

    Harga dan stok tidak dikirim client: keduanya dibaca dari tabel `books`
    saat cart dibaca, dan divalidasi ulang saat pesanan dibuat.
    """

    book_id: str
    quantity: int = Field(..., gt=0, le=99)


class CartItemUpdate(BaseModel):
    quantity: int = Field(..., gt=0, le=99)


class CartMergeItem(BaseModel):
    """Satu baris keranjang tamu (localStorage) yang dibawa saat login."""

    book_id: str
    quantity: int = Field(..., gt=0, le=99)


class CartMergeInput(BaseModel):
    items: list[CartMergeItem] = Field(default_factory=list, max_length=100)


class CartItemResponse(BaseModel):
    id: str
    book_id: str
    title: str
    author: str | None = None
    cover_url: str | None = None
    # `price` dan `stock` berasal dari `books`, bukan dari client maupun dari
    # baris `cart_items` — skema live sengaja tidak menyimpan keduanya.
    unit_price: float
    stock: int
    quantity: int
    subtotal: float
    # False bila buku sudah hilang atau stoknya habis; UI memakainya untuk
    # menonaktifkan tombol, backend tetap penentu akhir saat pesanan dibuat.
    available: bool


class CartResponse(BaseModel):
    cart_id: str
    items: list[CartItemResponse]
    total_items: int
    total_price: float
