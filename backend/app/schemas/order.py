from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# `orders.status` dan `payments.status` punya CHECK constraint di database live,
# jadi nilai-nilai ini adalah kosakata nyata — bukan sekadar konvensi aplikasi:
#
#   orders_status_check   -> pending, paid, processing, shipped, completed, cancelled, expired
#   payments_status_check -> pending, success, failed, expired, refunded
#
# Menulis nilai di luar daftar ini ditolak database (23514).
OrderStatus = Literal["pending", "paid", "processing", "shipped", "completed", "cancelled", "expired"]

PaymentStatus = Literal["pending", "success", "failed", "expired", "refunded"]


class OrderCustomer(BaseModel):
    """Kontak penerima. Disimpan di dalam kolom JSONB `orders.shipping_address`."""

    name: str = Field(..., min_length=2)
    email: str
    phone: str


class OrderAddress(BaseModel):
    """Alamat pengiriman. Disimpan di dalam kolom JSONB `orders.shipping_address`."""

    recipient_name: str = Field(..., min_length=2)
    phone: str = Field(..., min_length=9)
    full_address: str = Field(..., min_length=5)
    city: str | None = None
    province: str | None = None
    postal_code: str | None = None


class OrderItemBase(BaseModel):
    """Item pesanan. `book_id` wajib: skema live tidak menyimpan judul/harga bebas."""

    book_id: str
    quantity: int = Field(..., gt=0, le=99)
    # Dikirim client demi kelengkapan kontrak lama, tetapi TIDAK dipercaya:
    # `OrderService.create` selalu menimpa nya dari tabel `books`.
    title: str | None = None
    unit_price: float | None = Field(default=None, ge=0)


class OrderItemResponse(BaseModel):
    id: str
    order_id: str
    book_id: str
    title: str | None = None
    author: str | None = None
    cover_url: str | None = None
    unit_price: float
    quantity: int
    total_price: float


class OrderCreate(BaseModel):
    # Objek lama (masih dipakai UI saat ini). Nomor telepon/alamat dipakai untuk
    # mengisi `shipping_address` JSONB.
    customer_name: str | None = None
    customer_email: str | None = None
    customer_phone: str | None = None
    shipping_address: str | None = None
    # Bentuk kanonik sesuai skema live.
    customer: OrderCustomer | None = None
    address: OrderAddress | None = None

    # Kurir, layanan, dan ongkir ditentukan backend dari `app.core.shipping`;
    # client hanya memilih id layanan.
    shipping_option_id: str
    payment_method: str
    notes: str | None = None
    items: list[OrderItemBase] = Field(..., min_length=1)

    # Dikirim client lama demi kompatibilitas kontrak, tetapi TIDAK dipercaya:
    # `OrderService.create` menolak nilai yang tidak nol/ kosong. Tidak ada tabel
    # `promos` di database live, jadi belum ada diskon yang bisa divalidasi.
    shipping_fee: float = Field(default=0, ge=0)
    discount_amount: float = Field(default=0, ge=0)
    promo_code: str | None = None


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    tracking_number: str | None = None
    notes: str | None = None


class PaymentStatusUpdate(BaseModel):
    status: PaymentStatus


class OrderResponse(BaseModel):
    id: str
    order_number: str
    user_id: str | None = None

    customer_name: str | None = None
    customer_email: str | None = None
    customer_phone: str | None = None
    shipping_address: str
    address: OrderAddress | None = None

    courier: str | None = None
    courier_service: str | None = None
    tracking_number: str | None = None

    status: str
    payment_status: str
    payment_method: str | None = None

    subtotal: float
    shipping_fee: float
    discount_amount: float
    total_amount: float

    promo_code: str | None = None
    notes: str | None = None
    created_at: str | datetime
    updated_at: str | datetime
    items: list[OrderItemResponse] | None = []
