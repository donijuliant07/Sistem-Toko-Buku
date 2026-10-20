"""Biaya poin pesan AI Book Advisor.

Revision ID: 20261020_12
Revises: 20261019_11
Create Date: 2026-10-20

Perubahan
---------
1. Aturan `advisor_message_points` (nilai awal 10) di `reward_rules`, sehingga
   biaya dapat diubah admin tanpa deploy. `rule_catalog.py` menjadi fallback
   bila baris belum ada.
2. Tipe transaksi `ai_chat_charge` (negatif) dan sumber `ai_chat` di ledger,
   supaya tagihan chat tidak tercampur dengan `ai_redemption` milik ulasan AI.
   Refund memakai tipe `refund` yang sudah ada dengan sumber `ai_chat`.

Tidak ada tabel/kolom baru. Idempotensi memakai `idempotency_key` unik yang
sudah ada (`advisor:<message_id>:charge`), sehingga satu pesan hanya ditagih
sekali walau request diulang.

Catatan: migrasi ini **belum** diterapkan ke database live. Kode memakai nilai
default 10 dari `rule_catalog` bila baris aturan belum ada, tetapi tagihan
ledger dengan tipe `ai_chat_charge` memerlukan migrasi ini.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20261020_12"
down_revision = "20261019_11"
branch_labels = None
depends_on = None

_RULE_KEY = "advisor_message_points"
_DEFAULT_VALUE = 10

_RULE_KEYS = (
    "purchase_points_per_10000",
    "review_points",
    "community_contribution_points",
    "community_contribution_daily_cap",
    "helpful_answer_points",
    "helpful_answer_daily_cap",
    "spoiler_medium_points",
    "spoiler_heavy_points",
    "spoiler_medium_min_units",
    "spoiler_heavy_min_units",
    "helpful_answer_min_marks",
)

_TX_TYPES = (
    "purchase_reward",
    "review_reward",
    "community_reward",
    "ai_redemption",
    "ai_chat_charge",
    "refund",
    "order_reversal",
    "admin_adjustment",
)

_SOURCE_TYPES = ("order", "review", "chat_message", "ai_generation", "ai_chat", "admin")


def _sql_list(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{value}'" for value in values)


def _replace_check(name: str, table: str, expression: str) -> None:
    op.execute(sa.text(f"ALTER TABLE public.{table} DROP CONSTRAINT IF EXISTS {name}"))
    op.execute(
        sa.text(f"ALTER TABLE public.{table} ADD CONSTRAINT {name} CHECK ({expression})")
    )


def upgrade() -> None:
    _replace_check(
        "ck_reward_rules_key",
        "reward_rules",
        f"key IN ({_sql_list((*_RULE_KEYS, _RULE_KEY))})",
    )
    op.execute(
        sa.text(
            "INSERT INTO public.reward_rules (key, value) VALUES (:key, :value) "
            "ON CONFLICT (key) DO NOTHING"
        ).bindparams(key=_RULE_KEY, value=_DEFAULT_VALUE)
    )

    _replace_check(
        "ck_point_tx_type", "point_transactions", f"transaction_type IN ({_sql_list(_TX_TYPES)})"
    )
    _replace_check(
        "ck_point_tx_source", "point_transactions", f"source_type IN ({_sql_list(_SOURCE_TYPES)})"
    )
    _replace_check(
        "ck_point_tx_sign",
        "point_transactions",
        "(transaction_type IN "
        "('purchase_reward', 'review_reward', 'community_reward', 'refund') "
        "AND points_delta > 0) "
        "OR (transaction_type IN ('ai_redemption', 'ai_chat_charge', 'order_reversal') "
        "AND points_delta < 0) "
        "OR (transaction_type = 'admin_adjustment')",
    )


def downgrade() -> None:
    # Trigger `guard_reward_rules_write` menolak DELETE kecuali service
    # menyalakannya; migrasi membuka jalur itu hanya untuk pernyataan ini.
    op.execute(sa.text("SELECT set_config('app.rewards_rules_ok', 'on', true)"))
    op.execute(
        sa.text("DELETE FROM public.reward_rules WHERE key = :key").bindparams(
            key=_RULE_KEY
        )
    )
    op.execute(sa.text("SELECT set_config('app.rewards_rules_ok', 'off', true)"))

    _replace_check(
        "ck_point_tx_sign",
        "point_transactions",
        "(transaction_type IN "
        "('purchase_reward', 'review_reward', 'community_reward', 'refund') "
        "AND points_delta > 0) "
        "OR (transaction_type IN ('ai_redemption', 'order_reversal') "
        "AND points_delta < 0) "
        "OR (transaction_type = 'admin_adjustment')",
    )
    _replace_check(
        "ck_point_tx_source",
        "point_transactions",
        "source_type IN ('order', 'review', 'chat_message', 'ai_generation', 'admin')",
    )
    _replace_check(
        "ck_point_tx_type",
        "point_transactions",
        "transaction_type IN "
        "('purchase_reward', 'review_reward', 'community_reward', 'ai_redemption', "
        "'refund', 'order_reversal', 'admin_adjustment')",
    )
    _replace_check(
        "ck_reward_rules_key", "reward_rules", f"key IN ({_sql_list(_RULE_KEYS)})"
    )
