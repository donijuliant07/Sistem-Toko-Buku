"""Tabel Book Community: grup diskusi, keanggotaan, dan pesan.

Revision ID: 20261019_10
Revises: 20261018_09
Create Date: 2026-10-19

Latar belakang
--------------
Fitur komunitas membutuhkan tiga tabel dengan laju perubahan berbeda:

- `chat_groups` — metadata grup (nama, deskripsi, kategori, visibilitas).
- `chat_group_members` — keanggotaan beserta role per grup.
- `chat_messages` — pesan, append-only (tidak ada `updated_at`; hapus = soft
  delete lewat `deleted_at`).

Keamanan
--------
Ketiga tabel mengaktifkan RLS. Policy yang dibuat **hanya SELECT** untuk browser:
seluruh penulisan lewat backend (`supabase_admin`, service role) yang memeriksa
keanggotaan dan role di `app/services/community/permissions.py`. Policy SELECT
tetap wajib karena Supabase Realtime mengevaluasi RLS dengan JWT pengguna saat
mengirim `postgres_changes`.

- Grup publik terlihat oleh semua; grup privat hanya oleh anggota dan admin.
- Pesan hanya terlihat oleh anggota grup (atau admin), sehingga mengetahui
  `group_id` tidak cukup untuk membaca isi percakapan.

`chat_messages` ditambahkan ke publikasi `supabase_realtime` bila publikasi itu
ada (Supabase). Pada Postgres biasa, blok DO melewatinya tanpa error.

Tidak ada tabel/data lama yang diubah atau dihapus.
"""

import sqlalchemy as sa
from alembic import op

revision = "20261019_10"
down_revision = "20261018_09"
branch_labels = None
depends_on = None

_CATEGORIES = (
    "manga_anime",
    "business_startup",
    "self_improvement",
    "fantasy_fiction",
    "technology",
    "book_club",
    "general",
)

_CATEGORY_SQL = ", ".join(f"'{value}'" for value in _CATEGORIES)


def upgrade() -> None:
    """Buat ketiga tabel komunitas, policy baca, dan sambungkan Realtime."""
    op.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS public.chat_groups (
            id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name         varchar(80) NOT NULL,
            description  text NOT NULL DEFAULT '',
            category     varchar(32) NOT NULL,
            visibility   varchar(10) NOT NULL DEFAULT 'public',
            avatar_url   text,
            created_by   uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
            created_at   timestamptz NOT NULL DEFAULT now(),
            updated_at   timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT ck_chat_groups_category CHECK (category IN ({_CATEGORY_SQL})),
            CONSTRAINT ck_chat_groups_visibility CHECK (visibility IN ('public', 'private')),
            CONSTRAINT ck_chat_groups_name_len CHECK (char_length(btrim(name)) BETWEEN 3 AND 80)
        )
    """))
    # Nama grup tidak boleh kembar (case-insensitive, spasi tepi diabaikan).
    op.execute(sa.text(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_groups_name_lower "
        "ON public.chat_groups (lower(btrim(name)))"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_chat_groups_category_visibility "
        "ON public.chat_groups (category, visibility)"
    ))

    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS public.chat_group_members (
            group_id   uuid NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
            user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            role       varchar(16) NOT NULL DEFAULT 'member',
            joined_at  timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT pk_chat_group_members PRIMARY KEY (group_id, user_id),
            CONSTRAINT ck_chat_group_members_role CHECK (role IN ('owner', 'moderator', 'member'))
        )
    """))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_chat_group_members_user "
        "ON public.chat_group_members (user_id)"
    ))
    # Satu grup hanya punya satu owner. Transfer kepemilikan menurunkan owner
    # lama ke moderator dalam transaksi yang sama, jadi index ini tidak pernah
    # dilanggar oleh alur aplikasi.
    op.execute(sa.text(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_group_members_single_owner "
        "ON public.chat_group_members (group_id) WHERE role = 'owner'"
    ))

    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS public.chat_messages (
            id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            group_id           uuid NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
            sender_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            message_type       varchar(8) NOT NULL DEFAULT 'text',
            content            text NOT NULL DEFAULT '',
            book_id            uuid REFERENCES public.books(id) ON DELETE SET NULL,
            client_message_id  uuid,
            created_at         timestamptz NOT NULL DEFAULT now(),
            deleted_at         timestamptz,
            CONSTRAINT ck_chat_messages_type CHECK (message_type IN ('text', 'book')),
            CONSTRAINT ck_chat_messages_shape CHECK (
                (message_type = 'text' AND book_id IS NULL
                 AND char_length(btrim(content)) BETWEEN 1 AND 2000)
                OR (message_type = 'book' AND book_id IS NOT NULL AND content = '')
            )
        )
    """))
    # Idempotensi retry: pengiriman ulang dengan `client_message_id` yang sama
    # tidak membuat baris kedua.
    op.execute(sa.text(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_messages_client "
        "ON public.chat_messages (group_id, sender_id, client_message_id) "
        "WHERE client_message_id IS NOT NULL"
    ))
    # Index keyset: "halaman pesan terbaru sebuah grup" dan "pesan sebelum kursor".
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_chat_messages_group_keyset "
        "ON public.chat_messages (group_id, created_at DESC, id DESC)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_chat_messages_book "
        "ON public.chat_messages (book_id) WHERE book_id IS NOT NULL"
    ))

    # `updated_at` grup diurus trigger, mengikuti pola `set_*_updated_at()` yang
    # sudah ada, supaya tetap benar walau baris diubah dari SQL Editor.
    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION public.set_chat_groups_updated_at()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$
    """))
    op.execute(sa.text("DROP TRIGGER IF EXISTS chat_groups_updated_at ON public.chat_groups"))
    op.execute(sa.text("""
        CREATE TRIGGER chat_groups_updated_at
        BEFORE UPDATE ON public.chat_groups
        FOR EACH ROW EXECUTE FUNCTION public.set_chat_groups_updated_at()
    """))

    # Helper policy. SECURITY DEFINER supaya policy tidak rekursif membaca
    # `chat_group_members` lewat RLS tabel itu sendiri.
    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION public.is_group_member(p_group uuid)
        RETURNS boolean
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = public
        AS $$
            SELECT EXISTS (
                SELECT 1 FROM chat_group_members
                WHERE group_id = p_group AND user_id = (SELECT auth.uid())
            )
        $$
    """))
    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION public.is_group_owner(p_group uuid)
        RETURNS boolean
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = public
        AS $$
            SELECT EXISTS (
                SELECT 1 FROM chat_group_members
                WHERE group_id = p_group AND user_id = (SELECT auth.uid()) AND role = 'owner'
            )
        $$
    """))

    op.execute(sa.text("ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY"))
    op.execute(sa.text("ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY"))
    op.execute(sa.text("ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY"))

    # Hanya SELECT untuk browser: tulis selalu lewat backend (service role).
    op.execute(sa.text("DROP POLICY IF EXISTS chat_groups_public_read ON public.chat_groups"))
    op.execute(sa.text("""
        CREATE POLICY chat_groups_public_read
        ON public.chat_groups FOR SELECT TO anon, authenticated
        USING (visibility = 'public')
    """))
    op.execute(sa.text("DROP POLICY IF EXISTS chat_groups_member_read ON public.chat_groups"))
    op.execute(sa.text("""
        CREATE POLICY chat_groups_member_read
        ON public.chat_groups FOR SELECT TO authenticated
        USING (public.is_group_member(id) OR public.is_admin())
    """))

    op.execute(sa.text("DROP POLICY IF EXISTS chat_group_members_member_read ON public.chat_group_members"))
    op.execute(sa.text("""
        CREATE POLICY chat_group_members_member_read
        ON public.chat_group_members FOR SELECT TO authenticated
        USING (public.is_group_member(group_id) OR public.is_admin())
    """))

    op.execute(sa.text("DROP POLICY IF EXISTS chat_messages_member_read ON public.chat_messages"))
    op.execute(sa.text("""
        CREATE POLICY chat_messages_member_read
        ON public.chat_messages FOR SELECT TO authenticated
        USING (
            deleted_at IS NULL
            AND (public.is_group_member(group_id) OR public.is_admin())
        )
    """))

    # Realtime: kirim INSERT/UPDATE pesan ke klien. Blok DO membuat migrasi ini
    # aman di Postgres biasa (tanpa Supabase Realtime) dan idempoten.
    op.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
               AND NOT EXISTS (
                   SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime'
                     AND schemaname = 'public'
                     AND tablename = 'chat_messages'
               )
            THEN
                ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
            END IF;
        END
        $$
    """))

    # Event DELETE di Supabase Realtime hanya membawa primary key kecuali
    # REPLICA IDENTITY FULL; frontend menyaring event dengan `group_id`, jadi
    # tanpa ini pesan yang dihapus tidak bisa dicocokkan ke ruang chat.
    op.execute(sa.text("ALTER TABLE public.chat_messages REPLICA IDENTITY FULL"))


def downgrade() -> None:
    """Hapus seluruh objek komunitas.

    Menghapus tabel berarti membuang seluruh riwayat percakapan; downgrade ini
    hanya untuk lingkungan pengembangan, bukan DB produksi.
    """
    op.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
               AND EXISTS (
                   SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime'
                     AND schemaname = 'public'
                     AND tablename = 'chat_messages'
               )
            THEN
                ALTER PUBLICATION supabase_realtime DROP TABLE public.chat_messages;
            END IF;
        END
        $$
    """))
    op.execute(sa.text("DROP POLICY IF EXISTS chat_messages_member_read ON public.chat_messages"))
    op.execute(sa.text("DROP POLICY IF EXISTS chat_group_members_member_read ON public.chat_group_members"))
    op.execute(sa.text("DROP POLICY IF EXISTS chat_groups_member_read ON public.chat_groups"))
    op.execute(sa.text("DROP POLICY IF EXISTS chat_groups_public_read ON public.chat_groups"))
    op.execute(sa.text("DROP TRIGGER IF EXISTS chat_groups_updated_at ON public.chat_groups"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS public.set_chat_groups_updated_at()"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS public.is_group_owner(uuid)"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS public.is_group_member(uuid)"))
    op.execute(sa.text("DROP TABLE IF EXISTS public.chat_messages"))
    op.execute(sa.text("DROP TABLE IF EXISTS public.chat_group_members"))
    op.execute(sa.text("DROP TABLE IF EXISTS public.chat_groups"))
