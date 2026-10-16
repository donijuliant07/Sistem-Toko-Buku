"""Longgarkan CHECK constraint marketplace untuk adapter contoh dan `source='mock'`.

Revision ID: 20261015_08
Revises: 20261015_07
Create Date: 2026-10-15

Latar belakang
--------------
`20261015_07` mengunci `marketplace` ke tujuh slug sungguhan dan `source` ke tiga
nilai. Sejak itu ditambahkan adapter **contoh** (`app/services/marketplace/
adapters/demo.py`) yang tidak menghubungi jaringan, sehingga UI pembanding harga
bisa didemokan tanpa kredensial pihak ketiga:

- slug `demo_store_a`, `demo_store_b`, `demo_store_c` — tiga, bukan satu, karena
  `uq_marketplace_sources_book_marketplace` hanya mengizinkan satu sumber per
  slug per buku; dengan satu slug tabel perbandingan hanya berisi satu baris.
- `source = 'mock'` — supaya keaslian sebuah kutipan terbaca dari datanya.
  `admin_url`/`search` tidak dipakai karena keduanya berarti "harga ini dibaca
  dari halaman sungguhan", dan itu tidak benar untuk data contoh.

Perubahan
---------
Hanya tiga CHECK constraint yang diganti dengan versi yang lebih longgar. Tiap
constraint dibuat ulang dengan nama yang sama karena PostgreSQL tidak punya
`ALTER CONSTRAINT` untuk mengubah ekspresi CHECK. Semuanya **aditif**: nilai
lama tetap diterima, jadi tidak ada baris lama yang tiba-tiba melanggar
constraint. Tidak ada tabel, kolom, index, trigger, RLS, atau data yang disentuh.

Catatan: `20261015_07` sengaja **tidak** diubah walau isinya kini tidak lagi
sama dengan model ORM. Migrasi yang sudah pernah dijalankan harus dianggap beku —
mengeditnya membuatnya tidak lagi menggambarkan apa yang benar-benar dijalankan
di DB yang sudah ter-migrasi. Kesamaan daftar slug antara model, skema Pydantic,
dan migrasi terakhir dijaga `tests/test_marketplaces.py`
(`test_every_slug_in_the_schema_has_an_adapter` dan
`test_mock_adapter_declares_itself_as_mock`).
"""

import sqlalchemy as sa
from alembic import op

revision = "20261015_08"
down_revision = "20261015_07"
branch_labels = None
depends_on = None

#: Ditulis ulang di migrasi, bukan diimpor dari `app.models.marketplace`, dengan
#: alasan yang sama seperti `20261015_07`: migrasi harus tetap bisa dijalankan
#: walau kode aplikasi kelak berubah.
_SLUGS = (
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

_SLUG_SQL = ", ".join(f"'{slug}'" for slug in _SLUGS)


def _replace_check(table: str, name: str, expression: str) -> None:
    """Ganti CHECK constraint bernama menjadi `expression`.

    `DROP ... IF EXISTS` lebih dulu supaya migrasi ini bisa dijalankan pada DB
    yang (mis. karena dibuat dari `CREATE TABLE` manual) belum punya constraint
    itu — dan supaya `ADD` tidak gagal karena nama yang sudah terpakai.
    """
    op.execute(sa.text(f"ALTER TABLE public.{table} DROP CONSTRAINT IF EXISTS {name}"))
    op.execute(sa.text(f"ALTER TABLE public.{table} ADD CONSTRAINT {name} CHECK ({expression})"))


def upgrade() -> None:
    """Izinkan tiga slug contoh di kedua tabel, dan `source='mock'`."""
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
    _replace_check(
        "marketplace_prices",
        "ck_marketplace_prices_source",
        "source IN ('admin_url', 'search', 'manual', 'mock')",
    )


def downgrade() -> None:
    """Kembalikan ketiga constraint ke daftar tujuh slug / tiga sumber.

    Akan **gagal** bila sudah ada baris bersumber `mock` atau berslug
    `demo_store_*` — dan itu memang disengaja: memaksakan downgrade berarti
    membuang data contoh diam-diam, atau menolak menjalankan constraint yang
    tidak lagi benar. Hapus baris tersebut lebih dulu bila memang ingin mundur.
    """
    _replace_check(
        "marketplace_sources",
        "ck_marketplace_sources_slug",
        "marketplace IN ('tokopedia', 'shopee', 'lazada', 'blibli', 'bukalapak', "
        "'google_books', 'open_library')",
    )
    _replace_check(
        "marketplace_prices",
        "ck_marketplace_prices_slug",
        "marketplace IN ('tokopedia', 'shopee', 'lazada', 'blibli', 'bukalapak', "
        "'google_books', 'open_library')",
    )
    _replace_check(
        "marketplace_prices",
        "ck_marketplace_prices_source",
        "source IN ('admin_url', 'search', 'manual')",
    )
