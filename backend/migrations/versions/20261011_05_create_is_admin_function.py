"""Buat `public.is_admin()` di jalur alembic.

Revision ID: 20261011_05
Revises: 20261011_04
Create Date: 2026-10-11

`20261011_04` memakai `public.is_admin()` di policy `categories_admin_write`
dan di body `prevent_profile_role_escalation`, tetapi fungsi itu tidak pernah
dibuat oleh rantai alembic — asalnya dari `backend/supabase/migrations/0002_rls.sql`
yang bukan jalur migrasi resmi. Pada DB yang dibangun murni lewat alembic,
`20261011_04` gagal dengan "function public.is_admin() does not exist".

Revisi ini menutup celah itu. Idempoten: pada DB live yang sudah punya fungsi,
`CREATE OR REPLACE` hanya menimpa definisinya dengan bentuk yang sama persis
secara perilaku. Teks body di bawah sengaja disalin persis dari `prosrc` DB live
(termasuk `auth.uid()` tanpa pembungkus `(SELECT ...)` dan nama tabel tanpa
skema), supaya menerapkannya tidak mengubah apa pun yang sudah berjalan.
"""

import sqlalchemy as sa
from alembic import op

revision = "20261011_05"
down_revision = "20261011_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Buat helper RLS `is_admin()` (body identik dengan DB live)."""
    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION public.is_admin()
        RETURNS boolean
        LANGUAGE sql
        STABLE
        SECURITY DEFINER SET search_path = public
        AS $$
            select exists (
                select 1 from profiles where id = auth.uid() and role = 'admin'
            );
        $$
    """))


def downgrade() -> None:
    """Tidak menghapus apa pun.

    `is_admin()` sudah dipakai policy `categories_admin_write` dan trigger
    `trg_prevent_profile_role_escalation` (keduanya dari `20261011_04`, yang
    downgrade-nya berjalan SETELAH revisi ini). Menghapusnya di sini butuh
    `CASCADE`, dan itu akan diam-diam membuang policy tersebut. Turunkan ke
    `20261011_04` dulu bila memang ingin membuang fungsinya.
    """
