"""Create books catalog table.

Revision ID: 20260928_02
Revises: 20260928_01
Create Date: 2026-09-28
"""

from alembic import op
import sqlalchemy as sa

revision = "20260928_02"
down_revision = "20260928_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create the books table and catalog constraints."""
    op.create_table(
        "books",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("author", sa.String(length=255), nullable=False),
        sa.Column("isbn", sa.String(length=32), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("stock", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("cover_url", sa.String(length=2048), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("price >= 0", name="ck_books_price_nonnegative"),
        sa.CheckConstraint("stock >= 0", name="ck_books_stock_nonnegative"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("isbn", name="uq_books_isbn"),
        schema="public",
    )
    op.create_index("ix_books_title", "books", ["title"], schema="public")
    op.create_index("ix_books_author", "books", ["author"], schema="public")
    op.execute(sa.text("""
        CREATE FUNCTION public.set_books_updated_at()
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
        CREATE TRIGGER books_updated_at
        BEFORE UPDATE ON public.books
        FOR EACH ROW EXECUTE FUNCTION public.set_books_updated_at()
    """))
    op.execute(sa.text("ALTER TABLE public.books ENABLE ROW LEVEL SECURITY"))
    op.execute(sa.text("""
        CREATE POLICY books_public_read
        ON public.books FOR SELECT TO anon, authenticated
        USING (true)
    """))


def downgrade() -> None:
    """Drop the books catalog table."""
    op.execute(sa.text("DROP TRIGGER IF EXISTS books_updated_at ON public.books"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS public.set_books_updated_at()"))
    op.execute(sa.text("DROP POLICY IF EXISTS books_public_read ON public.books"))
    op.drop_index("ix_books_author", table_name="books", schema="public")
    op.drop_index("ix_books_title", table_name="books", schema="public")
    op.drop_table("books", schema="public")
