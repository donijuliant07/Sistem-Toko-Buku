from typing import Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime

StockMovementType = Literal["Restok", "Penjualan", "Penyesuaian", "Retur"]


class StockAdjustmentRequest(BaseModel):
    product_id: str = Field(..., description="ID Produk yang disesuaikan stoknya")
    quantity: int = Field(..., description="Jumlah penambahan/pengurangan stok atau stok baru")
    type: StockMovementType = Field(..., description="Jenis pergerakan stok")
    reason: str = Field(..., min_length=3, description="Alasan penyesuaian stok")
    reference_id: Optional[str] = None


class StockMovementResponse(BaseModel):
    id: str
    product_id: str
    type: StockMovementType
    quantity: int
    stock_before: int
    stock_after: int
    reason: str
    reference_id: Optional[str] = None
    created_by: Optional[str] = None
    created_at: str | datetime
    product_title: Optional[str] = None
