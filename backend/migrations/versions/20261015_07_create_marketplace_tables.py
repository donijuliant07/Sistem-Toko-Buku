"""Tambah tabel perbandingan harga marketplace.

Revision ID: 20261015_07
Revises: 20261011_06
Create Date: 2026-10-15

Latar belakang
--------------
`books.price` hanya menyimpan harga toko sendiri. Fitur perbandingan harga
membutuhkan dua hal yang belum punya tempat: **di mana** harga sebuah buku
dicari di tiap marketplace, dan **berapa** harga yang pernah terbaca beserta
kapan terbacanya.

Dua tabel, dipisah menurut laju perubahannya:

- `marketplace_sources` — konfigurasi, jarang berubah (link produk yang diisi
  admin, atau kata kunci pencarian sebagai cadangan). Satu baris per
  `(book_id, marketplace)`.
- `marketplace_prices` — hasil pembacaan, terus bertambah. Baris terbaru per
  `(book_id, marketplace)` berperan sebagai cache; seluruh barisnya adalah
  riwayat harga. Karena itu tidak ada kolom `is_current` dan tidak ada
  `UPDATE`: penulisan selalu `INSERT`, sehingga riwayatnya utuh.

Keamanan
--------
Kedua tabel mengaktifkan RLS **tanpa satu pun policy**, sehingga peran `anon`
dan `authenticated` tidak bisa membacanya sama sekali. Backend mengaksesnya
lewat `supabase_admin` (service role) yang menembus RLS, dan otorisasi
sesungguhnya ada di dependency FastAPI (`require_user` untuk pembanding harga,
`require_admin` untuk pengelolaan sumber). Ini pola yang sama dengan
`categories_admin_write` di `20261011_04_rbac_rls.py`.

Tidak ada tabel/kolom yang diubah, tidak ada data yang dihapus, dan tidak ada
RLS yang sedang berjalan yang dimatikan.
"""

import sqlalchemy as sa
from alembic import op

revision = "20261015_07"
down_revision = "20261011_06"
branch_labels = None
depends_on = None

#: Daftar slug marketplace. Ditulis ulang di migrasi (bukan diimpor dari
#: `app.models.marketplace`) dengan sengaja: migrasi harus tetap bisa dijalankan
#: walau kode aplikasi kelak berubah. Keduanya diikat oleh
#: `tests/test_marketplaces.py::test_slug_list_matches_model`.
_SLUGS = (
    "tokopedia",
    "shopee",
    "lazada",
    "blibli",
    "bukalapak",
    "google_books",
    "open_library",
)

_SLUG_SQL = ", ".join(f"'{slug}'" for slug in _SLUGS)


def upgrade() -> None:
    """Buat tabel sumber dan hasil harga marketplace, lalu aktifkan RLS."""
    op.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS public.marketplace_sources (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            book_id         uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
            marketplace     varchar(32) NOT NULL,
            product_url     varchar(2048),
            search_keyword  varchar(255),
            is_active       boolean NOT NULL DEFAULT true,
            created_at      timestamptz NOT NULL DEFAULT now(),
            updated_at      timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uq_marketplace_sources_book_marketplace UNIQUE (book_id, marketplace),
            CONSTRAINT ck_marketplace_sources_slug CHECK (marketplace IN ({_SLUG_SQL})),
            CONSTRAINT ck_marketplace_sources_target CHECK (
                product_url IS NOT NULL OR search_keyword IS NOT NULL
            )
        )
    """))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_marketplace_sources_book_id "
        "ON public.marketplace_sources (book_id)"
    ))

    op.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS public.marketplace_prices (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            book_id       uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
            marketplace   varchar(32) NOT NULL,
            price         numeric(12,2) NOT NULL,
            currency      varchar(3) NOT NULL DEFAULT 'IDR',
            product_url   varchar(2048),
            product_title varchar(512),
            seller_name   varchar(255),
            in_stock      boolean,
            match_score   numeric(4,3),
            source        varchar(16) NOT NULL,
            fetched_at    timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT ck_marketplace_prices_price_nonnegative CHECK (price >= 0),
            CONSTRAINT ck_marketplace_prices_slug CHECK (marketplace IN ({_SLUG_SQL})),
            CONSTRAINT ck_marketplace_prices_source CHECK (
                source IN ('admin_url', 'search', 'manual')
            ),
            CONSTRAINT ck_marketplace_prices_match_score CHECK (
                match_score IS NULL OR (match_score >= 0 AND match_score <= 1)
            )
        )
    """))
    # Index ini melayani dua kueri sekaligus: "snapshot terbaru per marketplace"
    # dan "riwayat satu marketplace", keduanya terurut `fetched_at DESC`.
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_marketplace_prices_book_marketplace_fetched "
        "ON public.marketplace_prices (book_id, marketplace, fetched_at DESC)"
    ))

    # `updated_at` sumber diurus trigger, mengikuti pola `set_books_updated_at()`
    # dan `set_promos_updated_at()` yang sudah ada — bukan diserahkan ke aplikasi,
    # supaya tetap benar walau baris diubah dari SQL Editor.
    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION public.set_marketplace_sources_updated_at()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$
    """))
    op.execute(sa.text("DROP TRIGGER IF EXISTS marketplace_sources_updated_at ON public.marketplace_sources"))
    op.execute(sa.text("""
        CREATE TRIGGER marketplace_sources_updated_at
        BEFORE UPDATE ON public.marketplace_sources
        FOR EACH ROW EXECUTE FUNCTION public.set_marketplace_sources_updated_at()
    """))

    # RLS aktif tanpa policy: hanya service role (backend) yang bisa menyentuhnya.
    op.execute(sa.text("ALTER TABLE public.marketplace_sources ENABLE ROW LEVEL SECURITY"))
    op.execute(sa.text("ALTER TABLE public.marketplace_prices ENABLE ROW LEVEL SECURITY"))


def downgrade() -> None:
    """Hapus kedua tabel beserta trigger-nya.

    Menghapus tabel berarti membuang seluruh riwayat harga yang sudah terkumpul,
    jadi downgrade ini hanya untuk lingkungan pengembangan — bukan DB produksi.
    """
    op.execute(sa.text("DROP TRIGGER IF EXISTS marketplace_sources_updated_at ON public.marketplace_sources"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS public.set_marketplace_sources_updated_at()"))
    op.execute(sa.text("DROP INDEX IF EXISTS public.ix_marketplace_prices_book_marketplace_fetched"))
    op.execute(sa.text("DROP TABLE IF EXISTS public.marketplace_prices"))
    op.execute(sa.text("DROP INDEX IF EXISTS public.ix_marketplace_sources_book_id"))
    op.execute(sa.text("DROP TABLE IF EXISTS public.marketplace_sources"))
