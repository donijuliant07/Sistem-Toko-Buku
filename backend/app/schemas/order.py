from typing import Optional, Literal, List
from pydantic import BaseModel, Field
from datetime import datetime

OrderStatus = Literal["Menunggu Pembayaran", "Diproses", "Dikirim", "Selesai", "Dibatalkan"]
PaymentStatus = Literal["Belum Bayar", "Sudah Bayar", "Gagal", "Refund"]


class OrderItemBase(BaseModel):
    product_id: Optional[str] = None
    title: str
    author: str
    cover_url: str
    unit_price: float = Field(..., ge=0)
    quantity: int = Field(..., gt=0)
    total_price: float = Field(..., ge=0)


class OrderItemResponse(OrderItemBase):
    id: str
    order_id: str


class OrderStatusHistoryResponse(BaseModel):
    id: str
    order_id: str
    status: OrderStatus
    notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: str | datetime


class OrderCreate(BaseModel):
    customer_name: str = Field(..., min_length=2)
    customer_email: str
    customer_phone: str
    shipping_address: str = Field(..., min_length=5)
    courier: str
    payment_method: str
    shipping_fee: float = Field(default=0, ge=0)
    discount_amount: float = Field(default=0, ge=0)
    promo_code: Optional[str] = None
    notes: Optional[str] = None
    items: List[OrderItemBase] = Field(..., min_length=1)


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    tracking_number: Optional[str] = None
    notes: Optional[str] = None


class OrderResponse(BaseModel):
    id: str
    order_number: str
    customer_id: Optional[str] = None
    customer_name: str
    customer_email: str
    customer_phone: str
    shipping_address: str
    courier: str
    tracking_number: Optional[str] = None
    status: OrderStatus
    payment_status: PaymentStatus
    payment_method: str
    subtotal: float
    shipping_fee: float
    discount_amount: float
    total_amount: float
    promo_code: Optional[str] = None
    notes: Optional[str] = None
    created_at: str | datetime
    updated_at: str | datetime
    items: Optional[List[OrderItemResponse]] = []
    history: Optional[List[OrderStatusHistoryResponse]] = []
