"""Create the promos table.

Revision ID: 20260928_03
Revises: 20260928_02
Create Date: 2026-10-10
"""

import sqlalchemy as sa
from alembic import op

revision = "20260928_03"
down_revision = "20260928_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create the promo/voucher table and its policies, then seed demo rows."""
    op.create_table(
        "promos",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("discount_type", sa.String(length=20), nullable=False),
        sa.Column("discount_value", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("min_purchase", sa.Numeric(precision=12, scale=2), server_default=sa.text("0"), nullable=False),
        sa.Column("max_discount", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("quota", sa.Integer(), server_default=sa.text("100"), nullable=False),
        sa.Column("used_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "discount_type IN ('Persentase', 'Potongan Tetap', 'Gratis Ongkir')",
            name="ck_promos_discount_type",
        ),
        sa.CheckConstraint("discount_value > 0", name="ck_promos_discount_value_positive"),
        sa.CheckConstraint("min_purchase >= 0", name="ck_promos_min_purchase_nonnegative"),
        sa.CheckConstraint("quota > 0", name="ck_promos_quota_positive"),
        sa.CheckConstraint("used_count >= 0", name="ck_promos_used_count_nonnegative"),
        sa.CheckConstraint("end_date >= start_date", name="ck_promos_date_range"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_promos_code"),
        schema="public",
    )
    op.create_index("ix_promos_is_active", "promos", ["is_active"], schema="public")
    op.execute(sa.text("""
        CREATE FUNCTION public.set_promos_updated_at()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$
    """))
    op.execute(sa.text("""
        CREATE TRIGGER promos_updated_at
        BEFORE UPDATE ON public.promos
        FOR EACH ROW EXECUTE FUNCTION public.set_promos_updated_at()
    """))
    op.execute(sa.text("ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY"))
    # Read-only for the storefront, and only for promos that are actually usable
    # right now. Writes go through the backend (service-role key) after a
    # staff/admin check, so no client-side write policy exists.
    op.execute(sa.text("""
        CREATE POLICY promos_public_read_active
        ON public.promos FOR SELECT TO anon, authenticated
        USING (is_active AND CURRENT_DATE BETWEEN start_date AND end_date)
    """))
    # Demo campaigns so the admin page is not empty on first load. `used_count`
    # stays 0: no redemption has actually happened, and a seeded count would be
    # a fabricated number.
    op.execute(sa.text("""
        INSERT INTO public.promos
            (code, name, discount_type, discount_value, min_purchase, max_discount, quota, is_active, start_date, end_date)
        VALUES
            ('LITERASI10',   'Pesta Literasi InforBook 10.10',  'Persentase',      20,    100000, 40000,  500, true,  '2026-10-01', '2026-10-15'),
            ('ONGKIRBEBAS',  'Gratis Ongkir Seluruh Jawa',      'Gratis Ongkir',   20000, 150000, 20000, 1000, true,  '2026-10-01', '2026-10-31'),
            ('EDUSMART',     'Spesial Pelajar & Mahasiswa SNBT','Potongan Tetap',  25000, 120000, NULL,   300, true,  '2026-09-15', '2026-10-20'),
            ('STATIONERY15', 'Diskon Alat Tulis & Jurnal',      'Persentase',      15,     75000, 25000,  250, true,  '2026-10-01', '2026-10-10'),
            ('PAYDAYOKT',    'Flash Sale Gajian Akhir Bulan',   'Persentase',      25,    200000, 60000,  400, false, '2026-10-25', '2026-10-31'),
            ('HALOPUSTAKA',  'Diskon Pelanggan Baru',           'Potongan Tetap',  15000,  80000, NULL,  2000, true,  '2026-01-01', '2026-12-31')
        ON CONFLICT (code) DO NOTHING
    """))


def downgrade() -> None:
    """Drop the promos table and its trigger function."""
    op.execute(sa.text("DROP TRIGGER IF EXISTS promos_updated_at ON public.promos"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS public.set_promos_updated_at()"))
    op.execute(sa.text("DROP POLICY IF EXISTS promos_public_read_active ON public.promos"))
    op.drop_index("ix_promos_is_active", table_name="promos", schema="public")
    op.drop_table("promos", schema="public")
