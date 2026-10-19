from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, model_validator

DiscountType = Literal["Persentase", "Potongan Tetap", "Gratis Ongkir"]

# Diturunkan dari `is_active` + rentang tanggal, bukan kolom tersimpan — status
# yang disimpan bisa basi (lihat `orders.expires_at` di AUDIT poin 5).
PromoStatus = Literal["Aktif", "Jadwal", "Kadaluarsa", "Nonaktif"]


class PromoBase(BaseModel):
    code: str = Field(..., min_length=3, max_length=32, description="Kode voucher yang diketik pelanggan")
    name: str = Field(..., min_length=3, max_length=255)
    discount_type: DiscountType
    discount_value: float = Field(..., gt=0, description="Persen bila 'Persentase', nominal rupiah bila lainnya")
    min_purchase: float = Field(default=0, ge=0)
    max_discount: float | None = Field(default=None, gt=0)
    quota: int = Field(default=100, gt=0)
    is_active: bool = True
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def _check(self) -> "PromoBase":
        # Cerminan CHECK constraint `ck_promos_date_range` supaya pesan errornya
        # rapi (422), bukan 500 dari PostgREST.
        if self.end_date < self.start_date:
            raise ValueError("Tanggal berakhir tidak boleh lebih awal dari tanggal mulai.")
        if self.discount_type == "Persentase" and self.discount_value > 100:
            raise ValueError("Diskon persentase tidak boleh lebih dari 100%.")
        return self


class PromoCreate(PromoBase):
    """Payload pembuatan promo; `code` akan dirapikan jadi huruf besar."""

    @model_validator(mode="after")
    def _normalize(self) -> "PromoCreate":
        self.code = self.code.strip().upper()
        return self


class PromoUpdate(BaseModel):
    """Patch parsial; hanya field yang dikirim yang diubah."""

    name: str | None = Field(default=None, min_length=3, max_length=255)
    discount_type: DiscountType | None = None
    discount_value: float | None = Field(default=None, gt=0)
    min_purchase: float | None = Field(default=None, ge=0)
    max_discount: float | None = Field(default=None, gt=0)
    quota: int | None = Field(default=None, gt=0)
    is_active: bool | None = None
    start_date: date | None = None
    end_date: date | None = None


class PromoResponse(BaseModel):
    id: str
    code: str
    name: str
    discount_type: DiscountType
    discount_value: float
    min_purchase: float
    max_discount: float | None = None
    quota: int
    used_count: int
    is_active: bool
    # Dihitung server dari `is_active` + rentang tanggal; tidak pernah dikirim client.
    status: PromoStatus
    start_date: date
    end_date: date
    created_at: str | None = None
    updated_at: str | None = None
