"""Model tabel perbandingan harga marketplace.

Dua tabel, dan pembagiannya sengaja:

- `marketplace_sources` — **konfigurasi** (jarang berubah): di mana harga sebuah
  buku dicari di tiap marketplace. Satu baris per `(book_id, marketplace)`.
- `marketplace_prices` — **data hasil** (terus bertambah): satu baris per
  pengambilan harga. Baris terbaru per `(book_id, marketplace)` berperan sebagai
  *cache*, sedangkan seluruh barisnya adalah *riwayat harga*. Karena itu tidak
  ada kolom `is_current`: "terbaru" ditentukan `fetched_at DESC`, sehingga
  penulisan selalu berupa `INSERT` (append-only) dan tidak ada baris yang
  ditimpa — riwayatnya utuh.

Keduanya diakses lewat sesi ORM seperti `books`, bukan PostgREST: ini data
internal backend, bukan katalog publik.
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

#: Cerminan CHECK `ck_marketplace_*_slug` di migrasi `20261015_07`. Ditulis
#: sekali sebagai konstanta supaya model dan migrasi tidak bisa berbeda diam-diam.
MARKETPLACE_SLUGS = (
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

#: Slug yang harganya **bukan harga nyata**. Tiga, bukan satu, karena
#: `uq_marketplace_sources_book_marketplace` hanya mengizinkan satu sumber per
#: slug per buku — dengan satu slug, tabel perbandingan hanya akan berisi satu
#: baris dan tidak mendemokan apa pun. Nama "demo_store_*" sengaja tidak memakai
#: nama marketplace sungguhan supaya tidak ada yang menyangka angkanya berasal
#: dari sana.
MOCK_SLUGS = ("demo_store_a", "demo_store_b", "demo_store_c")

_SLUG_SQL = ", ".join(f"'{slug}'" for slug in MARKETPLACE_SLUGS)


class MarketplaceSource(Base):
    """Konfigurasi sumber harga satu buku di satu marketplace.

    `product_url` boleh kosong: saat itu harga dicari lewat pencarian otomatis
    memakai `search_keyword` (atau judul buku bila kolom itu pun kosong).
    Keduanya tidak boleh kosong bersamaan — kalau tidak, sumber itu tidak punya
    cara menemukan halamannya sama sekali.
    """

    __tablename__ = "marketplace_sources"
    __table_args__ = (
        CheckConstraint(f"marketplace IN ({_SLUG_SQL})", name="ck_marketplace_sources_slug"),
        CheckConstraint(
            "product_url IS NOT NULL OR search_keyword IS NOT NULL",
            name="ck_marketplace_sources_target",
        ),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.books.id", ondelete="CASCADE"),
        nullable=False,
    )
    marketplace: Mapped[str] = mapped_column(String(32), nullable=False)
    product_url: Mapped[str | None] = mapped_column(String(2048))
    search_keyword: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    #: `timezone=True` supaya pemetaannya cocok dengan `timestamptz` di DB. Tanpa
    #: itu SQLAlchemy memetakannya ke `TIMESTAMP WITHOUT TIME ZONE`, dan nilai
    #: sadar-zona dari `datetime.now(UTC)` ditolak asyncpg (lihat `fetched_at`).
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
        server_onupdate=text("now()"),
    )


class MarketplacePrice(Base):
    """Satu hasil pengambilan harga dari satu marketplace (append-only).

    `source` mencatat *bagaimana* harga itu didapat, `match_score` mencatat
    seberapa yakin judul hasil cocok dengan judul buku (0..1). Keduanya untuk
    audit: pencarian otomatis bisa salah cocok, dan tanpa dua kolom ini kesalahan
    itu tak bisa ditelusuri setelah kejadian.
    """

    __tablename__ = "marketplace_prices"
    __table_args__ = (
        CheckConstraint("price >= 0", name="ck_marketplace_prices_price_nonnegative"),
        CheckConstraint(f"marketplace IN ({_SLUG_SQL})", name="ck_marketplace_prices_slug"),
        CheckConstraint(
            "source IN ('admin_url', 'search', 'manual', 'mock')",
            name="ck_marketplace_prices_source",
        ),
        CheckConstraint(
            "match_score IS NULL OR (match_score >= 0 AND match_score <= 1)",
            name="ck_marketplace_prices_match_score",
        ),
        Index(
            "ix_marketplace_prices_book_marketplace_fetched",
            "book_id",
            "marketplace",
            text("fetched_at DESC"),
        ),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.books.id", ondelete="CASCADE"),
        nullable=False,
    )
    marketplace: Mapped[str] = mapped_column(String(32), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default=text("'IDR'"))
    product_url: Mapped[str | None] = mapped_column(String(2048))
    product_title: Mapped[str | None] = mapped_column(String(512))
    seller_name: Mapped[str | None] = mapped_column(String(255))
    #: `None` = status stok tidak diketahui, yang berbeda dari "tidak ada stok".
    in_stock: Mapped[bool | None] = mapped_column(Boolean)
    match_score: Mapped[Decimal | None] = mapped_column(Numeric(4, 3))
    source: Mapped[str] = mapped_column(String(16), nullable=False)
    #: `timezone=True` wajib: DB-nya `timestamptz`, dan nilai yang ditulis selalu
    #: sadar-zona (`datetime.now(UTC)`). Tanpa ini SQLAlchemy memetakan `datetime`
    #: ke `TIMESTAMP WITHOUT TIME ZONE`, dan asyncpg menolak menulis nilai
    #: sadar-zona ke kolom naif — `TypeError: can't subtract offset-naive and
    #: offset-aware datetimes`, sebelum barisnya pernah sampai ke database.
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
