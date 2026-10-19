from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

StockMovementType = Literal["Restok", "Penjualan", "Penyesuaian", "Retur"]


class StockAdjustmentRequest(BaseModel):
    product_id: str = Field(..., description="ID Produk yang disesuaikan stoknya")
    quantity: int = Field(..., description="Jumlah penambahan/pengurangan stok atau stok baru")
    type: StockMovementType = Field(..., description="Jenis pergerakan stok")
    reason: str = Field(..., min_length=3, description="Alasan penyesuaian stok")
    reference_id: str | None = None


class StockMovementResponse(BaseModel):
    id: str
    product_id: str
    type: StockMovementType
    quantity: int
    stock_before: int
    stock_after: int
    reason: str
    reference_id: str | None = None
    created_by: str | None = None
    created_at: str | datetime
    product_title: str | None = None


class LowStockBookResponse(BaseModel):
    """Buku dengan stok kritis — kolom yang memang ada di tabel `books`."""

    id: str
    title: str
    author: str | None = None
    stock: int
    cover_url: str | None = None
