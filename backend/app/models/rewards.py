"""Model ledger poin, aktivitas reward, dan aturan reward.

Satu file untuk empat tabel yang selalu dibaca bersama sebagai satu sistem:

- `PointTransaction` — buku besar. **Satu-satunya** catatan perubahan saldo;
  `profiles.points` hanyalah cache dari `balance_after` terakhir.
- `RewardActivity` — jejak moderasi untuk reward ulasan/komunitas (siapa
  menyetujui, kapan, berapa poinnya).
- `RewardRule` / `RewardRuleAudit` — konfigurasi admin beserta riwayatnya.

Semua penulisan saldo harus lewat RPC `apply_point_transaction` (migrasi
`20261019_11`), yang mengunci baris profil, menegakkan idempotensi dan cap
harian, lalu menulis ledger. Service hanya memanggil RPC; tidak ada `INSERT`
langsung ke `point_transactions` dari aplikasi.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

#: Jenis transaksi; cerminan CHECK `ck_point_tx_type`.
TRANSACTION_TYPES = (
    "purchase_reward",
    "review_reward",
    "community_reward",
    "ai_redemption",
    "refund",
    "order_reversal",
    "admin_adjustment",
)

#: Sumber transaksi; cerminan CHECK `ck_point_tx_source`.
SOURCE_TYPES = ("order", "review", "chat_message", "ai_generation", "admin")

#: Jenis aktivitas yang dimoderasi; cerminan CHECK `ck_reward_activity_type`.
ACTIVITY_TYPES = ("review", "community_contribution", "helpful_answer")

ACTIVITY_STATUSES = ("pending", "approved", "rejected", "rewarded")

_TYPE_SQL = ", ".join(f"'{value}'" for value in TRANSACTION_TYPES)
_SOURCE_SQL = ", ".join(f"'{value}'" for value in SOURCE_TYPES)
_ACTIVITY_SQL = ", ".join(f"'{value}'" for value in ACTIVITY_TYPES)
_ACTIVITY_STATUS_SQL = ", ".join(f"'{value}'" for value in ACTIVITY_STATUSES)


class PointTransaction(Base):
    """Satu baris buku besar poin.

    `points_delta` bertanda (+/-) dan `balance_after` adalah saldo tepat setelah
    transaksi ini diterapkan; keduanya bisa diverifikasi ulang dari ledger.
    """

    __tablename__ = "point_transactions"
    __table_args__ = (
        CheckConstraint("points_delta <> 0", name="ck_point_tx_nonzero"),
        CheckConstraint("balance_after >= 0", name="ck_point_tx_balance"),
        CheckConstraint(f"transaction_type IN ({_TYPE_SQL})", name="ck_point_tx_type"),
        CheckConstraint(f"source_type IN ({_SOURCE_SQL})", name="ck_point_tx_source"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    #: NULL untuk transaksi tanpa sumber (mis. penyesuaian admin).
    book_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("public.books.id", ondelete="SET NULL")
    )
    points_delta: Mapped[int] = mapped_column(nullable=False)
    balance_after: Mapped[int] = mapped_column(BigInteger, nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(24), nullable=False)
    source_type: Mapped[str] = mapped_column(String(24), nullable=False)
    #: Teks bebas (uuid order, id ulasan, dst.) — bukan FK: sumbernya bisa
    #: berasal dari tabel yang tidak dikelola ORM.
    source_id: Mapped[str] = mapped_column(String(128), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(160), nullable=False)
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("public.profiles.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=text("now()")
    )


class RewardActivity(Base):
    """Jejak aktivitas yang dimoderasi untuk reward.

    `status = 'rewarded'` hanya diset **setelah** transaksi ledger untuk
    aktivitas itu benar-benar tersimpan.
    """

    __tablename__ = "reward_activities"
    __table_args__ = (
        CheckConstraint(
            f"activity_type IN ({_ACTIVITY_SQL})", name="ck_reward_activity_type"
        ),
        CheckConstraint(
            "source_type IN ('review', 'chat_message')",
            name="ck_reward_activity_source",
        ),
        CheckConstraint(
            f"status IN ({_ACTIVITY_STATUS_SQL})", name="ck_reward_activity_status"
        ),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    activity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    source_type: Mapped[str] = mapped_column(String(24), nullable=False)
    source_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=text("'pending'")
    )
    points_awarded: Mapped[int | None] = mapped_column()
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("public.profiles.id", ondelete="SET NULL")
    )
    reviewed_at: Mapped[datetime | None] = mapped_column()
    approved_at: Mapped[datetime | None] = mapped_column()
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=text("now()")
    )


class RewardRule(Base):
    """Nilai aturan reward yang dapat diubah admin (satu baris per key)."""

    __tablename__ = "reward_rules"
    __table_args__ = (
        CheckConstraint("value >= 0", name="ck_reward_rules_value"),
        {"schema": "public"},
    )

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[int] = mapped_column(BigInteger, nullable=False)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("public.profiles.id", ondelete="SET NULL")
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=text("now()")
    )


class RewardRuleAudit(Base):
    """Riwayat perubahan aturan; append-only, ditulis service admin."""

    __tablename__ = "reward_rules_audit"
    __table_args__ = ({"schema": "public"},)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    key: Mapped[str] = mapped_column(String(64), nullable=False)
    old_value: Mapped[int | None] = mapped_column(BigInteger)
    new_value: Mapped[int] = mapped_column(BigInteger, nullable=False)
    changed_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.profiles.id", ondelete="RESTRICT"),
        nullable=False,
    )
    changed_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=text("now()")
    )


class AIReviewGeneration(Base):
    """Siklus hidup satu permintaan AI Book Review (berbayar atau gratis)."""

    __tablename__ = "ai_review_generations"
    __table_args__ = (
        CheckConstraint(
            "spoiler_level IN ('no_spoiler', 'low', 'medium', 'heavy')",
            name="ck_ai_gen_level",
        ),
        CheckConstraint(
            "access_method IN ('free', 'purchase_eligibility', 'points')",
            name="ck_ai_gen_access",
        ),
        CheckConstraint(
            "status IN ('pending', 'success', 'failed')", name="ck_ai_gen_status"
        ),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.books.id", ondelete="CASCADE"),
        nullable=False,
    )
    spoiler_level: Mapped[str] = mapped_column(String(16), nullable=False)
    access_method: Mapped[str] = mapped_column(String(24), nullable=False)
    points_spent: Mapped[int] = mapped_column(nullable=False, server_default=text("0"))
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=text("'pending'")
    )
    idempotency_key: Mapped[str] = mapped_column(String(160), nullable=False)
    redemption_tx_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("public.point_transactions.id", ondelete="SET NULL")
    )
    refund_tx_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("public.point_transactions.id", ondelete="SET NULL")
    )
    failure_reason: Mapped[str | None] = mapped_column(Text)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    provider: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=text("now()")
    )
    started_at: Mapped[datetime | None] = mapped_column()
    completed_at: Mapped[datetime | None] = mapped_column()


__all__ = [
    "ACTIVITY_STATUSES",
    "ACTIVITY_TYPES",
    "SOURCE_TYPES",
    "TRANSACTION_TYPES",
    "AIReviewGeneration",
    "PointTransaction",
    "RewardActivity",
    "RewardRule",
    "RewardRuleAudit",
]
