"""Skema data untuk sistem validasi harga (AI Price Validation).

Mendefinisikan enum, model analisis statistik, model permintaan & respons AI,
serta struktur akhir penawaran tervalidasi yang siap dikembalikan oleh API.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field

#: Status keputusan akhir terhadap satu penawaran
ValidationStatus = Literal["valid", "review", "rejected"]

#: Status kecocokan produk terhadap target buku
ProductMatchStatus = Literal["match", "likely_match", "uncertain", "mismatch"]

#: Penilaian kewajaran harga terhadap distribusi pasar
PriceAssessment = Literal[
    "fair",
    "potential_outlier",
    "extreme_low",
    "extreme_high",
    "insufficient_data",
]

#: Status ketersediaan integrasi AI validator
AIValidationStatus = Literal[
    "completed",
    "fallback",
    "unavailable",
    "disabled",
    "error",
]


class PriceStatistics(BaseModel):
    """Statistik harga dari kumpulan penawaran yang sebanding."""

    model_config = ConfigDict(from_attributes=True)

    sample_size: int = Field(ge=0, description="Jumlah kandidat yang sebanding")
    median_price: Decimal | None = Field(default=None, description="Median harga kandidat")
    min_price: Decimal | None = Field(default=None, description="Harga minimum")
    max_price: Decimal | None = Field(default=None, description="Harga maksimum")
    price_spread: Decimal | None = Field(default=None, description="Selisih max - min")
    is_reliable: bool = Field(
        default=False,
        description="True jika ukuran sampel cukup untuk kesimpulan statistik yang meyakinkan",
    )


class DetectedProductAttributes(BaseModel):
    """Atribut produk yang diekstrak dari teks judul dan metadata."""

    is_bundle: bool = False
    is_ebook: bool = False
    is_preorder: bool = False
    is_used: bool = False
    is_non_book: bool = False
    condition_note: str | None = None
    detected_isbn: str | None = None


class DeterministicEvaluation(BaseModel):
    """Hasil evaluasi deterministik berbasis aturan Python sebelum analisis AI."""

    is_data_valid: bool
    rejection_reasons: list[str] = Field(default_factory=list)
    review_reasons: list[str] = Field(default_factory=list)
    match_status: ProductMatchStatus
    match_score: float = Field(ge=0.0, le=1.0)
    attributes: DetectedProductAttributes = Field(default_factory=DetectedProductAttributes)
    deviation_percent: float | None = None
    price_assessment: PriceAssessment = "insufficient_data"
    is_outlier: bool = False


class AICandidateAssessment(BaseModel):
    """Output terstruktur per penawaran dari model AI."""

    offer_id: str
    product_match: ProductMatchStatus
    price_assessment: PriceAssessment
    confidence: float = Field(ge=0.0, le=1.0, description="Tingkat keyakinan model (0..1)")
    reasons: list[str] = Field(default_factory=list, description="Alasan analisis dalam bahasa Indonesia")
    requires_review: bool = False
    suggested_status: ValidationStatus = "valid"


class AIValidationResult(BaseModel):
    """Hasil agregat pemanggilan AI Price Validator."""

    status: AIValidationStatus
    model_name: str | None = None
    latency_ms: float | None = None
    from_cache: bool = False
    assessments: dict[str, AICandidateAssessment] = Field(default_factory=dict)
    warning: str | None = None


class ValidatedMarketplaceQuote(BaseModel):
    """Satu kutipan harga yang telah melalui validasi hybrid (deterministik + AI).

    Mempertahankan seluruh field asli kutipan sumber tanpa memodifikasi harga
    atau URL aslinya.
    """

    model_config = ConfigDict(from_attributes=True)

    marketplace: str
    label: str
    price: Decimal
    currency: str = "IDR"
    product_url: str | None = None
    product_title: str | None = None
    seller_name: str | None = None
    in_stock: bool | None = None
    source: str
    fetched_at: Any

    # Lapisan validasi
    validation_status: ValidationStatus
    match_status: ProductMatchStatus
    price_assessment: PriceAssessment
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    reasons: list[str] = Field(default_factory=list)
    is_outlier: bool = False
    deviation_percent: float | None = None
    attributes: DetectedProductAttributes = Field(default_factory=DetectedProductAttributes)
