"""Tambah kolom identifier profil: username, full_name, avatar_url.

Revision ID: 20261011_06
Revises: 20261011_05
Create Date: 2026-10-11

Latar belakang
--------------
`app/api/v1/auth.py`, `app/schemas/auth.py`, dan `app/models/profile.py` sudah
membaca/mengharapkan kolom `full_name` dan `avatar_url` (plus `username` sebagai
identifier mudah dicari sesuai CLAUDE.md §2), tetapi rantai alembic tidak pernah
membuatnya. DB live pun hanya punya `id, role, created_at, updated_at`. Akibatnya
nilai jatuh ke default dan tidak bisa disimpan.

Migrasi ini melengkapinya dengan aman pada tabel berisi data:

- Ketiga kolom **nullable** dulu, jadi `ADD COLUMN` tidak menggagalkan baris lama.
- `username` **tidak** diberi NOT NULL / UNIQUE global. Baris lama tidak punya
  username, jadi menambah constraint NOT NULL/UNIQUE sekarang akan gagal pada DB
  berisi data. Sebagai gantinya dipakai **unique index parsial** yang hanya
  mengikat baris dengan username (mengizinkan banyak NULL), lalu username diisi
  untuk baris lama (backfill) dan untuk registrasi baru (trigger pada
  `public.profiles`). Handler registrasi juga melindungi dirinya sendiri:
  `auth.py` memilih profil lewat kunci `id`, jadi request tetap berhasil
  sekalipun username entah kenapa masih kosong.
- Nilai username selalu = basis (dari email, ≤16 karakter) + `_` + 8/32 heksa
  UUID, jadi tidak pernah > 56 karakter — masih di bawah `String(255)` `full_name`
  dan tanpa risiko tabrakan antar baris.
- `handle_new_user` (dibuat `20261011_04`) juga dilengkapi: selain `id`, ia kini
  menyimpan `full_name`/`avatar_url` dari metadata akun. Tanpa ini, pendaftaran
  berikutnya menyimpan username saja dan `full_name` tetap NULL — nama hanya
  "kelihatan" karena `auth.py` jatuh ke metadata saat membaca, bukan tersimpan.
  Perilaku lama dipertahankan: tetap `ON CONFLICT (id) DO NOTHING`.

Tidak ada tabel/data yang dihapus dan RLS tidak dinonaktifkan.
"""

import sqlalchemy as sa
from alembic import op

revision = "20261011_06"
down_revision = "20261011_05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Tambah kolom profil dan penegakan username secara aman untuk data lama."""
    # 1. Kolom nullable dulu — aman untuk tabel berisi data.
    op.execute(sa.text("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text"))
    op.execute(sa.text("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text"))
    op.execute(sa.text("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text"))

    # 2. Username unik untuk baris yang mengisinya; NULL boleh berulang.
    op.execute(
        sa.text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_username "
            "ON public.profiles (lower(username)) WHERE username IS NOT NULL"
        )
    )

    # 3. Backfill konservatif & deterministik (hanya baris yang punya sumber data).
    op.execute(sa.text("""
        UPDATE public.profiles p
        SET full_name = u.raw_user_meta_data->>'full_name'
        FROM auth.users u
        WHERE u.id = p.id
          AND p.full_name IS NULL
          AND NULLIF(u.raw_user_meta_data->>'full_name', '') IS NOT NULL
    """))
    op.execute(sa.text("""
        UPDATE public.profiles p
        SET avatar_url = u.raw_user_meta_data->>'avatar_url'
        FROM auth.users u
        WHERE u.id = p.id
          AND p.avatar_url IS NULL
          AND NULLIF(u.raw_user_meta_data->>'avatar_url', '') IS NOT NULL
    """))
    # Username dari email; suffix = UUID baris (utuh) sehingga dijamin unik tanpa
    # perlu menangani konflik. `UPDATE` tidak mengenal `ON CONFLICT`; idempotensi
    # datang dari `WHERE p.username IS NULL`, jadi menjalankan ulang tidak mengubah
    # baris yang sudah punya username.
    op.execute(sa.text("""
        UPDATE public.profiles p
        SET username = COALESCE(
                NULLIF(left(lower(regexp_replace(split_part(u.email, '@', 1), '[^A-Za-z0-9_]', '', 'g')), 16), ''),
                'user'
            ) || '_' || replace(p.id::text, '-', '')
        FROM auth.users u
        WHERE u.id = p.id
          AND p.username IS NULL
          AND NULLIF(split_part(u.email, '@', 1), '') IS NOT NULL
    """))

    # 4. Registrasi baru: isi username lewat trigger `BEFORE INSERT ON public.profiles`.
    #
    #    `auth.users` **tidak punya kolom `username`** (diperiksa langsung di DB live),
    #    jadi varian lama yang menaruh trigger ini di `auth.users` dan menulis
    #    `NEW.username` akan menggagalkan setiap signup dengan
    #    `record "new" has no field "username"`. Kolom itu milik `public.profiles`,
    #    dan di sana `NEW.username` sah. Email untuk menurunkan basis dibaca dari
    #    `auth.users` (SECURITY DEFINER yang sama seperti `handle_new_user`).
    #
    #    Suffix = UUID baris, jadi username dijamin unik tanpa loop/`ON CONFLICT`
    #    dan tanpa menambah constraint NOT NULL yang akan menolak baris lama.
    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION public.set_profile_username()
        RETURNS trigger
        LANGUAGE plpgsql
        SECURITY DEFINER SET search_path = public
        AS $$
        DECLARE
            base text;
        BEGIN
            IF NEW.username IS NULL OR btrim(NEW.username) = '' THEN
                SELECT left(lower(regexp_replace(split_part(u.email, '@', 1), '[^a-z0-9_]', '', 'g')), 16)
                INTO base
                FROM auth.users u
                WHERE u.id = NEW.id;

                NEW.username := COALESCE(NULLIF(base, ''), 'user') || '_' || replace(NEW.id::text, '-', '');
            END IF;
            RETURN NEW;
        END;
        $$
    """))
    op.execute(sa.text("DROP TRIGGER IF EXISTS set_profile_username_trg ON auth.users"))
    op.execute(sa.text("DROP TRIGGER IF EXISTS set_profile_username_trg ON public.profiles"))
    op.execute(sa.text("""
        CREATE TRIGGER set_profile_username_trg
        BEFORE INSERT ON public.profiles
        FOR EACH ROW EXECUTE FUNCTION public.set_profile_username()
    """))

    # 5. Registrasi baru: simpan `full_name`/`avatar_url` dari metadata akun.
    #    `handle_new_user` (dari `20261011_04`) hanya menyisipkan `id`, sehingga
    #    kolom yang baru ditambahkan akan tetap NULL untuk setiap pendaftaran
    #    berikutnya — nama lengkap hanya "kelihatan" karena `auth.py` jatuh ke
    #    metadata saat membaca, bukan karena tersimpan. CLAUDE.md §2/§10.3
    #    meminta nilainya benar-benar tersimpan, jadi fungsi ini dilengkapi.
    #    Nilai kosong dinormalkan ke NULL; `ON CONFLICT DO NOTHING` menjaga
    #    perilaku lama (baris yang sudah ada tidak ditimpa).
    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION public.handle_new_user()
        RETURNS trigger
        LANGUAGE plpgsql
        SECURITY DEFINER SET search_path = public
        AS $$
        BEGIN
            INSERT INTO public.profiles (id, full_name, avatar_url)
            VALUES (
                NEW.id,
                NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
                NULLIF(NEW.raw_user_meta_data->>'avatar_url', '')
            )
            ON CONFLICT (id) DO NOTHING;
            RETURN NEW;
        END;
        $$
    """))


def downgrade() -> None:
    """Lepas penegakan username lalu hapus kolom yang ditambahkan.

    Menghapus kolom berarti membuang nilai yang mungkin sudah diisi, jadi
    downgrade ini hanya untuk lingkungan pengembangan — bukan DB produksi.
    """
    op.execute(sa.text("DROP TRIGGER IF EXISTS set_profile_username_trg ON public.profiles"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS public.set_profile_username()"))
    op.execute(sa.text("DROP INDEX IF EXISTS public.uq_profiles_username"))
    op.execute(sa.text("ALTER TABLE public.profiles DROP COLUMN IF EXISTS avatar_url"))
    op.execute(sa.text("ALTER TABLE public.profiles DROP COLUMN IF EXISTS full_name"))
    op.execute(sa.text("ALTER TABLE public.profiles DROP COLUMN IF EXISTS username"))
