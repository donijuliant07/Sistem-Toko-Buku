"""Kontrak API Book Rewards."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.schemas.ai_review import SpoilerLevel

# ---------------------------------------------------------------------------
# Saldo dan ledger
# ---------------------------------------------------------------------------


class PointTransactionRead(BaseModel):
    id: UUID
    points_delta: int
    balance_after: int
    transaction_type: str
    source_type: str
    source_id: str
    book_id: UUID | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class PointTransactionPage(BaseModel):
    items: list[PointTransactionRead]
    total: int
    page: int
    limit: int
    total_pages: int


class SpoilerAccessRead(BaseModel):
    """Akses satu tingkat spoiler + syaratnya, untuk ditampilkan di UI."""

    level: SpoilerLevel
    #: `free` | `purchase_eligibility` | `points`
    method: Literal["free", "purchase_eligibility", "points"]
    cost: int
    units_bought: int
    min_units: int
    #: Benar bila tingkat ini sudah pernah dibuka untuk buku ini (tanpa biaya lagi).
    unlocked: bool


class RecentReward(BaseModel):
    transaction_type: str
    points_delta: int
    created_at: datetime


class RewardsMe(BaseModel):
    points: int
    total_books_bought: int
    spoiler_access: dict[str, SpoilerAccessRead]
    recent_rewards: list[RecentReward]


# ---------------------------------------------------------------------------
# Aturan (admin)
# ---------------------------------------------------------------------------


class RewardRuleRead(BaseModel):
    key: str
    value: int
    default: int
    max_value: int


class RewardRulesRead(BaseModel):
    rules: list[RewardRuleRead]


class RewardRulesUpdate(BaseModel):
    """Hanya key yang dikirim yang diubah; tidak ada key liar yang diterima."""

    values: dict[str, int] = Field(..., min_length=1)

    @model_validator(mode="after")
    def _validate(self) -> RewardRulesUpdate:
        from app.services.rewards.rule_catalog import RULES_BY_KEY

        for key, value in self.values.items():
            definition = RULES_BY_KEY.get(key)
            if definition is None:
                raise ValueError(f"Aturan tidak dikenal: {key}")
            if isinstance(value, bool):
                raise TypeError(f"Nilai aturan {key} harus bilangan bulat.")
            if value < 0 or value > definition.max_value:
                raise ValueError(
                    f"Nilai aturan {key} harus di antara 0 dan {definition.max_value}."
                )
        return self


# ---------------------------------------------------------------------------
# Penyesuaian admin, backfill, rekonsiliasi
# ---------------------------------------------------------------------------


class AdminAdjustmentRequest(BaseModel):
    user_id: UUID
    #: Bertanda: positif menambah, negatif mengurangi. Tidak boleh nol.
    delta: int = Field(..., ge=-1_000_000, le=1_000_000)
    reason: str = Field(..., min_length=5, max_length=255)
    #: Kunci unik pilihan admin agar retry tidak menggandakan penyesuaian.
    reference: str | None = Field(default=None, max_length=80)

    @model_validator(mode="after")
    def _non_zero(self) -> AdminAdjustmentRequest:
        if self.delta == 0:
            raise ValueError("Perubahan poin tidak boleh nol.")
        self.reason = self.reason.strip()
        return self


class BackfillReport(BaseModel):
    scanned_orders: int
    rewarded_orders: int
    total_points: int
    #: Dibuat/diperiksa `reward_activities` komunitas & ulasan.
    reviewed_reviews: int
    approved_messages: int


class ReconcileReport(BaseModel):
    users_checked: int
    mismatched: list[dict[str, Any]]


# ---------------------------------------------------------------------------
# Aktivitas
# ---------------------------------------------------------------------------


class RewardActivityRead(BaseModel):
    id: UUID
    user_id: UUID
    activity_type: str
    source_type: str
    source_id: UUID
    status: str
    points_awarded: int | None = None
    reviewed_by: UUID | None = None
    reviewed_at: datetime | None = None
    approved_at: datetime | None = None
    rejection_reason: str | None = None
    created_at: datetime


class RewardActivityPage(BaseModel):
    items: list[RewardActivityRead]
    total: int
    page: int
    limit: int
    total_pages: int


# ---------------------------------------------------------------------------
# AI review berbayar
# ---------------------------------------------------------------------------


class AIReviewGenerateRequest(BaseModel):
    spoiler_level: SpoilerLevel = Field(
        default=SpoilerLevel.NO_SPOILER,
        description="Tingkat spoiler: no_spoiler, low, medium, heavy",
    )
    #: Kunci idempotensi dari klien; retry dengan kunci sama tidak menagih dua kali.
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=80)


class AIReviewSummary(BaseModel):
    """Ringkasan generasi tersimpan (tanpa isi), untuk daftar riwayat."""

    id: UUID
    book_id: UUID
    spoiler_level: SpoilerLevel
    access_method: Literal["free", "purchase_eligibility", "points"]
    points_spent: int
    status: Literal["pending", "success", "failed"]
    provider: str | None = None
    created_at: datetime
    completed_at: datetime | None = None


class AIReviewGenerationRead(AIReviewSummary):
    result: dict[str, Any] | None = None
    failure_reason: str | None = None


__all__ = [
    "AIReviewGenerateRequest",
    "AIReviewGenerationRead",
    "AIReviewSummary",
    "AdminAdjustmentRequest",
    "BackfillReport",
    "PointTransactionPage",
    "PointTransactionRead",
    "RecentReward",
    "ReconcileReport",
    "RewardActivityPage",
    "RewardActivityRead",
    "RewardRuleRead",
    "RewardRulesRead",
    "RewardRulesUpdate",
    "RewardsMe",
    "SpoilerAccessRead",
]
