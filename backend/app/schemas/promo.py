from typing import Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime


class PromoBase(BaseModel):
    code: str = Field(..., min_length=3, description="Kode voucher promo")
    title: str = Field(..., min_length=3, description="Judul voucher promo")
    discount_type: Literal["Persentase", "Nominal"] = Field(default="Persentase")
    discount_value: float = Field(..., gt=0, description="Nilai diskon (% atau Rp)")
    min_purchase: float = Field(default=0, ge=0, description="Minimal total belanja")
    max_discount: Optional[float] = Field(None, ge=0, description="Maksimal potongan diskon")
    quota: int = Field(default=100, ge=1, description="Kuota penggunaan voucher")
    status: Literal["Aktif", "Nonaktif", "Dijadwalkan"] = Field(default="Aktif")
    start_date: str | datetime
    end_date: str | datetime


class PromoCreate(PromoBase):
    pass


class PromoUpdate(BaseModel):
    title: Optional[str] = None
    discount_type: Optional[Literal["Persentase", "Nominal"]] = None
    discount_value: Optional[float] = Field(None, gt=0)
    min_purchase: Optional[float] = Field(None, ge=0)
    max_discount: Optional[float] = Field(None, ge=0)
    quota: Optional[int] = Field(None, ge=1)
    status: Optional[Literal["Aktif", "Nonaktif", "Dijadwalkan"]] = None
    start_date: Optional[str | datetime] = None
    end_date: Optional[str | datetime] = None


class PromoResponse(PromoBase):
    id: str
    used_count: int
    created_at: str | datetime
