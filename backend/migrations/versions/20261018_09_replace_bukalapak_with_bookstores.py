"""Ganti slug Bukalapak dengan Gramedia dan Periplus.

Revision ID: 20261018_09
Revises: 20261015_08
Create Date: 2026-10-18

Bukalapak tidak lagi menjual produk fisik; Gramedia dan Periplus menggantikan
slug e-commerce buku di CHECK constraint.
"""

import sqlalchemy as sa
from alembic import op

revision = "20261018_09"
down_revision = "20261015_08"
branch_labels = None
depends_on = None

_SLUGS = (
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
)

_SLUG_SQL = ", ".join(f"'{slug}'" for slug in _SLUGS)


def _replace_check(table: str, name: str, expression: str) -> None:
    op.execute(sa.text(f"ALTER TABLE public.{table} DROP CONSTRAINT IF EXISTS {name}"))
    op.execute(sa.text(f"ALTER TABLE public.{table} ADD CONSTRAINT {name} CHECK ({expression})"))


def upgrade() -> None:
    op.execute(sa.text("DELETE FROM public.marketplace_sources WHERE marketplace = 'bukalapak'"))
    op.execute(sa.text("DELETE FROM public.marketplace_prices WHERE marketplace = 'bukalapak'"))
    _replace_check(
        "marketplace_sources",
        "ck_marketplace_sources_slug",
        f"marketplace IN ({_SLUG_SQL})",
    )
    _replace_check(
        "marketplace_prices",
        "ck_marketplace_prices_slug",
        f"marketplace IN ({_SLUG_SQL})",
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM public.marketplace_sources WHERE marketplace IN ('gramedia', 'periplus')"))
    op.execute(sa.text("DELETE FROM public.marketplace_prices WHERE marketplace IN ('gramedia', 'periplus')"))
    _SLUGS_OLD = (
        "tokopedia",
        "shopee",
        "lazada",
        "blibli",
        "bukalapak",
        "google_books",
        "open_library",
        "demo_store_a",
        "demo_store_b",
        "demo_store_c",
    )
    old_sql = ", ".join(f"'{slug}'" for slug in _SLUGS_OLD)
    _replace_check(
        "marketplace_sources",
        "ck_marketplace_sources_slug",
        f"marketplace IN ({old_sql})",
    )
    _replace_check(
        "marketplace_prices",
        "ck_marketplace_prices_slug",
        f"marketplace IN ({old_sql})",
    )
