"""Skema perbandingan harga lintas marketplace.

Tiga lapis yang dibedakan tegas di sini:

1. **Sumber** (`MarketplaceSource*`) — konfigurasi *di mana* harga dicari untuk
   sebuah buku: link produk yang diisi admin, atau kata kunci pencarian sebagai
   cadangan. Bentuknya CRUD biasa, hanya admin.
2. **Kutipan** (`MarketplacePriceRead`) — satu harga hasil scrape dari satu
   marketplace pada satu waktu.
3. **Perbandingan** (`MarketplaceComparisonResponse`) — gabungan kutipan
   terbaru + riwayat, yang dikirim ke halaman pembanding.

Angka dan stok dari marketplace **tidak dipercaya sebagai sumber kebenaran**
toko: `store_price` selalu dibaca ulang dari tabel `books` oleh service, bukan
dititipkan klien (sejalan dengan aturan di `app/services/__init__.py`).
"""

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, model_validator

from app.schemas.price_validation import (
    AIValidationStatus,
    PriceStatistics,
    ValidatedMarketplaceQuote,
)

#: Slug marketplace yang dikenal sistem. Daftar ini adalah cerminan CHECK
#: constraint `ck_marketplace_sources_slug` / `ck_marketplace_prices_slug`.
MarketplaceSlug = Literal[
    "tokopedia",
    "shopee",
    "lazada",
    "blibli",
    "gramedia",
    "periplus",
    "google_books",
    "open_library",
    "demo_store_a",
    "demo_store_b",
    "demo_store_c",
]

#: Bagaimana sebuah harga diperoleh. `admin_url` = link produk yang diisi admin,
#: `search` = hasil pencarian otomatis, `manual` = diisi manusia (mis. koreksi),
#: `mock` = **data contoh, bukan harga nyata**. Nilai terakhir itu ada supaya
#: keaslian sebuah kutipan bisa dibaca langsung dari datanya, tanpa UI perlu tahu
#: daftar slug mana yang palsu — dan tanpa ada dua sumber kebenaran yang bisa
#: berbeda diam-diam.
PriceSource = Literal["admin_url", "search", "manual", "mock"]


class MarketplaceSourceCreate(BaseModel):
    """Payload penambahan sumber marketplace untuk satu buku.

    Minimal salah satu dari `product_url` / `search_keyword` harus ada —
    cerminan CHECK `ck_marketplace_sources_target` supaya kesalahannya berakhir
    sebagai 422 yang rapi, bukan error PostgREST.
    """

    book_id: UUID
    marketplace: MarketplaceSlug
    product_url: AnyHttpUrl | None = None
    search_keyword: str | None = Field(default=None, min_length=1, max_length=255)
    is_active: bool = True

    @model_validator(mode="after")
    def _require_target(self) -> "MarketplaceSourceCreate":
        if not self.product_url and not self.search_keyword:
            raise ValueError(
                "Isi minimal salah satu: link produk atau kata kunci pencarian."
            )
        if self.search_keyword is not None:
            self.search_keyword = self.search_keyword.strip() or None
        return self


class MarketplaceSourceUpdate(BaseModel):
    """Patch parsial sumber; hanya field yang dikirim yang diubah."""

    product_url: AnyHttpUrl | None = None
    search_keyword: str | None = Field(default=None, min_length=1, max_length=255)
    is_active: bool | None = None

    @model_validator(mode="after")
    def _require_change(self) -> "MarketplaceSourceUpdate":
        if not self.model_dump(exclude_unset=True):
            raise ValueError("Minimal satu field harus diubah.")
        if self.search_keyword is not None:
            self.search_keyword = self.search_keyword.strip() or None
        return self


class MarketplaceSourceRead(BaseModel):
    """Satu sumber marketplace seperti yang dilihat admin."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    book_id: UUID
    marketplace: MarketplaceSlug
    label: str
    product_url: str | None
    search_keyword: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class MarketplacePriceRead(BaseModel):
    """Satu kutipan harga hasil scrape."""

    marketplace: MarketplaceSlug
    label: str
    price: Decimal
    currency: str
    product_url: str | None = None
    product_title: str | None = None
    seller_name: str | None = None
    in_stock: bool | None = None
    match_score: float | None = Field(default=None, ge=0, le=1)
    source: PriceSource
    fetched_at: datetime


class MarketplaceHistoryPoint(BaseModel):
    """Satu titik riwayat harga; dipakai untuk grafik tren."""

    price: Decimal
    fetched_at: datetime


class MarketplaceComparisonResponse(BaseModel):
    """Perbandingan harga satu buku di seluruh marketplace yang aktif.

    `quotes` selalu terurut harga menaik sehingga `quotes[0]` adalah penawaran
    termurah. `warnings` menampung marketplace yang gagal di-scrape agar UI bisa
    memberi tahu tanpa membatalkan seluruh perbandingan.
    """

    book_id: UUID
    book_title: str
    store_price: Decimal
    quotes: list[MarketplacePriceRead]
    valid_offers: list[ValidatedMarketplaceQuote] = Field(default_factory=list)
    review_offers: list[ValidatedMarketplaceQuote] = Field(default_factory=list)
    rejected_offers: list[ValidatedMarketplaceQuote] = Field(default_factory=list)
    price_statistics: PriceStatistics | None = None
    ai_validation_status: AIValidationStatus = "unavailable"
    validation_summary: list[str] = Field(default_factory=list)
    lowest_price: Decimal | None = None
    highest_price: Decimal | None = None
    savings: Decimal | None = Field(
        default=None,
        description="Selisih harga toko ini dengan penawaran termurah (positif = marketplace lebih murah).",
    )
    history: dict[str, list[MarketplaceHistoryPoint]] = Field(default_factory=dict)
    fetched_at: datetime
    from_cache: bool = False
    warnings: list[str] = Field(default_factory=list)


class MarketplaceInfo(BaseModel):
    """Slug + label untuk dropdown admin; sumbernya registry adapter."""

    slug: str
    label: str
