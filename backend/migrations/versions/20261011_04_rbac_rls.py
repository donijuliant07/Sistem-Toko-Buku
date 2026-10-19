"""RBAC/RLS: tutup celah tulis browser, tambah policy admin, perbaiki trigger profil.

Revision ID: 20261011_04
Revises: 20260928_03
Create Date: 2026-10-11

Ringkasan perubahan (semua idempoten, aman pada DB berisi data):

1. `books` — hapus `books_allow_insert` / `books_allow_delete` yang memberi
   akses tulis buku kepada role `anon`. Penulisan buku hanya lewat backend
   (service role) yang memverifikasi peran admin.
2. `profiles` — tambah policy UPDATE untuk pemilik baris saja, plus trigger
   `prevent_profile_role_escalation` yang menolak perubahan kolom `role` dari
   klien terautentikasi (mencegah self-promote ke admin). Service role dan SQL
   Editor (tanpa `auth.uid()`) tetap boleh, sehingga promosi manual masih bisa.
3. `categories` — RLS aktif tanpa policy sama sekali; tambah baca publik dan
   tulis khusus admin.
4. `handle_new_user` — perbaiki fungsi trigger yang rusak (dulu menulis kolom
   `email`/`full_name`/`phone` dan cast `'customer'::public.user_role` yang
   tidak ada). Kini hanya menyisipkan `id`, sehingga registrasi publik berhasil
   dan otomatis berrole `user` (default kolom).

Tidak ada tabel/data yang dihapus dan RLS tidak pernah dinonaktifkan.
`orders`, `order_items`, dan `payments` sengaja TIDAK diberi policy INSERT:
pesanan harus dibuat lewat backend agar harga/stok dihitung server, dan status
pembayaran tidak boleh ditetapkan dari browser.
"""

import sqlalchemy as sa
from alembic import op

revision = "20261011_04"
down_revision = "20260928_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Tutup celah tulis browser dan lengkapi policy RBAC."""
    # 1. books: hapus policy tulis untuk anon/authenticated.
    op.execute(sa.text("DROP POLICY IF EXISTS books_allow_insert ON public.books"))
    op.execute(sa.text("DROP POLICY IF EXISTS books_allow_delete ON public.books"))

    # 2. profiles: pemilik boleh UPDATE barisnya sendiri...
    op.execute(sa.text("DROP POLICY IF EXISTS profiles_update_own ON public.profiles"))
    op.execute(sa.text("""
        CREATE POLICY profiles_update_own
        ON public.profiles FOR UPDATE TO authenticated
        USING ((SELECT auth.uid()) = id)
        WITH CHECK ((SELECT auth.uid()) = id)
    """))

    # ...tapi tidak boleh mengubah `role`-nya sendiri.
    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
        RETURNS trigger
        LANGUAGE plpgsql
        SECURITY DEFINER SET search_path = public
        AS $$
        BEGIN
            IF NEW.role IS DISTINCT FROM OLD.role
               AND (SELECT auth.uid()) IS NOT NULL
               AND NOT public.is_admin() THEN
                RAISE EXCEPTION 'Perubahan role tidak diizinkan' USING ERRCODE = '42501';
            END IF;
            RETURN NEW;
        END;
        $$
    """))
    op.execute(sa.text("DROP TRIGGER IF EXISTS trg_prevent_profile_role_escalation ON public.profiles"))
    op.execute(sa.text("""
        CREATE TRIGGER trg_prevent_profile_role_escalation
        BEFORE UPDATE ON public.profiles
        FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_escalation()
    """))

    # 3. categories: baca publik, tulis khusus admin.
    op.execute(sa.text("DROP POLICY IF EXISTS categories_public_read ON public.categories"))
    op.execute(sa.text("""
        CREATE POLICY categories_public_read
        ON public.categories FOR SELECT TO anon, authenticated
        USING (true)
    """))
    op.execute(sa.text("DROP POLICY IF EXISTS categories_admin_write ON public.categories"))
    op.execute(sa.text("""
        CREATE POLICY categories_admin_write
        ON public.categories FOR ALL TO authenticated
        USING (public.is_admin())
        WITH CHECK (public.is_admin())
    """))

    # 4. Trigger pendaftaran: hanya `id`, sisanya default kolom (`role = 'user'`).
    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION public.handle_new_user()
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


def downgrade() -> None:
    """Kembalikan bentuk sebelumnya untuk policy/trigger yang ditambahkan.

    Policy `books_allow_insert`/`books_allow_delete` sengaja TIDAK dipulihkan:
    mengembalikannya berarti membuka lagi akses tulis buku bagi anon. Bila perlu
    benar-benar mundur, buat policy itu manual dengan kesadaran penuh.
    """
    op.execute(sa.text("DROP TRIGGER IF EXISTS trg_prevent_profile_role_escalation ON public.profiles"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS public.prevent_profile_role_escalation()"))
    op.execute(sa.text("DROP POLICY IF EXISTS profiles_update_own ON public.profiles"))
    op.execute(sa.text("DROP POLICY IF EXISTS categories_admin_write ON public.categories"))
    op.execute(sa.text("DROP POLICY IF EXISTS categories_public_read ON public.categories"))
