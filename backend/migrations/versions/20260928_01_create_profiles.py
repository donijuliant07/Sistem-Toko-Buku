"""Create profiles linked to Supabase Auth users.

Revision ID: 20260928_01
Revises:
Create Date: 2026-09-28
"""

from alembic import op
import sqlalchemy as sa

revision = "20260928_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create profiles and provision rows for existing and future users."""
    op.create_table(
        "profiles",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("role", sa.String(length=20), server_default=sa.text("'user'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("role IN ('user', 'admin')", name="ck_profiles_role"),
        sa.ForeignKeyConstraint(["id"], ["auth.users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="public",
    )
    op.execute(sa.text("""
        INSERT INTO public.profiles (id)
        SELECT id FROM auth.users
        ON CONFLICT (id) DO NOTHING
    """))
    op.execute(sa.text("ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY"))
    op.execute(sa.text("""
        CREATE POLICY profiles_select_own
        ON public.profiles FOR SELECT TO authenticated
        USING ((SELECT auth.uid()) = id)
    """))
    op.execute(sa.text("""
        CREATE FUNCTION public.handle_new_user()
        RETURNS trigger
        LANGUAGE plpgsql
        SECURITY DEFINER SET search_path = public
        AS $$
        BEGIN
            INSERT INTO public.profiles (id) VALUES (NEW.id)
            ON CONFLICT (id) DO NOTHING;
            RETURN NEW;
        END;
        $$
    """))
    op.execute(sa.text("""
        CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()
    """))


def downgrade() -> None:
    """Remove profile provisioning and the profiles table."""
    op.execute(sa.text("DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS public.handle_new_user()"))
    op.drop_table("profiles", schema="public")
