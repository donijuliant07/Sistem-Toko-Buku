"""Pengujian perbandingan harga marketplace — tanpa database, tanpa jaringan.

Yang diuji di sini adalah bagian-bagian yang paling mudah rusak diam-diam:

1. **Pembacaan harga** — `normalize_price` harus membaca `Rp125.000` sebagai
   125000 dan `12.99` sebagai dua belas koma sembilan sembilan. Salah di sini
   berarti seluruh perbandingan salah tanpa terlihat error.
2. **Ambang kecocokan judul** — pencarian otomatis harus menolak hasil yang bukan
   buku yang dimaksud, bukan memasangkannya begitu saja.
3. **Aturan cache** — yang masih segar tidak diambil ulang; yang basi diambil
   ulang dan **ditambahkan** sebagai baris baru (riwayat), bukan ditimpa.
4. **Ketahanan** — satu marketplace yang gagal tidak menggagalkan yang lain.
5. **Otorisasi** — pembanding harga hanya untuk pelanggan login, pengelolaan
   sumber hanya untuk admin.

Repository palsu dipakai alih-alih database, mengikuti gaya `tests/test_books.py`:
endpoint diuji lewat `app.dependency_overrides` sehingga tidak ada satu pun
permintaan keluar ke Supabase.
"""

import asyncio
import json
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

import pytest
from app.api.v1.marketplaces import comparison_service
from app.core.security import UserPayload, get_current_user, require_admin
from app.db.session import get_db
from app.main import app
from app.models.marketplace import (
    MARKETPLACE_SLUGS,
    MOCK_SLUGS,
    MarketplacePrice,
    MarketplaceSource,
)
from app.schemas.book import BookPage
from app.schemas.marketplace import (
    MarketplaceSlug,
    MarketplaceSourceCreate,
    MarketplaceSourceUpdate,
)
from app.services.marketplace import base as marketplace_base
from app.services.marketplace.adapters import demo
from app.services.marketplace.base import (
    AdapterError,
    FetchResult,
    MarketplaceAdapter,
    normalize_price,
    title_similarity,
)
from app.services.marketplace.registry import (
    get_adapter,
    marketplace_label,
    supported_marketplaces,
    supported_slugs,
)
from app.services.marketplace.scraper_client import (
    SCRAPER_SUPPORTED_SLUGS,
    PrefetchOutcome,
)
from app.services.marketplace.service import (
    FULL_ATTEMPT_BACKOFF,
    MarketplaceComparisonService,
)
from httpx import ASGITransport, AsyncClient

NOW =datetime(2026, 10, 15, 12, 0, tzinfo=UTC)

BOOK = {
    "id": "11111111-1111-1111-1111-111111111111",
    "title": "Bumi Manusia",
    "author": "Pramoedya Ananta Toer",
    "isbn": "9789799731234",
    "description": "",
    "price": Decimal("98000.00"),
    "stock": 4,
    "cover_url": None,
    "created_at": NOW,
    "updated_at": NOW,
}


# ---------------------------------------------------------------------------
# Alat bantu pengujian
# ---------------------------------------------------------------------------


class FakeSource:
    """Baris `marketplace_sources` secukupnya untuk service."""

    def __init__(self, marketplace, *, product_url=None, search_keyword=None, active=True):
        # UUID asli, bukan string bebas: respons endpoint memvalidasinya sebagai UUID.
        self.id = UUID(int=abs(hash(marketplace)) % (1 << 128))
        self.book_id = BOOK["id"]
        self.marketplace = marketplace
        self.product_url = product_url
        self.search_keyword = search_keyword
        self.is_active = active
        self.created_at = NOW
        self.updated_at = NOW

class FakePrice:
    """Baris `marketplace_prices` secukupnya untuk service."""

    def __init__(self, marketplace, price, fetched_at, *, source="search", product_title=None):
        self.marketplace = marketplace
        self.price = price
        self.fetched_at = fetched_at
        self.source = source
        self.product_url = f"https://example.test/{marketplace}"
        self.product_title = product_title or BOOK["title"]
        self.seller_name = None
        self.in_stock = True
        self.match_score = Decimal("0.900")
        self.currency = "IDR"


class FakeSourceRepository:
    def __init__(self, sources=()):
        self.rows = list(sources)
        self.created = []
        self.updated = []
        self.deleted = []

    async def list_for_book(self, book_id, *, only_active=False):
        return [row for row in self.rows if not only_active or row.is_active]

    async def get(self, source_id):
        return next((row for row in self.rows if row.id == source_id), None)

    async def create_many_if_absent(self, rows):
        created = []
        for row in rows:
            if any(existing.marketplace == row["marketplace"] for existing in self.rows):
                continue
            source = FakeSource(
                row["marketplace"],
                product_url=row.get("product_url"),
                search_keyword=row.get("search_keyword"),
                active=row.get("is_active", True),
            )
            self.rows.append(source)
            created.append(source)
        self.created.extend(created)
        return created

    async def create(self, payload):
        row = FakeSource(payload.marketplace, product_url=str(payload.product_url or "") or None,
                         search_keyword=payload.search_keyword)
        self.rows.append(row)
        self.created.append(payload)
        return row

    async def update(self, source_id, payload):
        row = await self.get(source_id)
        if row is None:
            return None
        self.updated.append((source_id, payload))
        return row

    async def delete(self, source_id):
        row = await self.get(source_id)
        if row is None:
            return False
        self.rows.remove(row)
        self.deleted.append(source_id)
        return True


class FakePriceRepository:
    def __init__(self, rows=()):
        self.rows = list(rows)
        self.added = []

    async def latest_for_book(self, book_id):
        latest = {}
        for row in sorted(self.rows, key=lambda item: item.fetched_at, reverse=True):
            latest.setdefault(row.marketplace, row)
        return list(latest.values())

    async def history_for_book(self, book_id, *, limit=60):
        return sorted(self.rows, key=lambda item: item.fetched_at, reverse=True)[:limit]

    async def add_snapshot(self, payload):
        self.added.append(payload)
        row = FakePrice(payload["marketplace"], payload["price"], NOW)
        self.rows.append(row)
        return row

    async def add_snapshots(self, payloads):
        return [await self.add_snapshot(payload) for payload in payloads]


class StubAdapter(MarketplaceAdapter):
    """Adapter palsu: mengembalikan harga yang sudah ditentukan, atau melempar."""

    def __init__(self, slug, *, price="100000", error=None, label=None):
        self.slug = slug
        self.label = label or slug.title()
        self._price = Decimal(price)
        self._error = error
        self.calls = 0
        self.last_product_url = "unset"

    def build_search_url(self, keyword: str) -> str:
        return f"https://stub.test/{self.slug}?q={keyword}"

    async def fetch(self, client, *, book_title, keyword, product_url=None):
        self.calls += 1
        self.last_product_url = product_url
        if self._error:
            raise AdapterError(self._error)
        return FetchResult(
            marketplace=self.slug,
            label=self.label,
            title=book_title,
            price=self._price,
            url=f"https://stub.test/{self.slug}/1",
            match_score=0.95,
            source="admin_url" if product_url else "search",
        )


def build(
    stub_slugs=None,
    *,
    sources=None,
    prices=None,
    clock=lambda: NOW,
    adapters=None,
    ttl=timedelta(hours=6),
    scraper=None,
):
    """Susun service dengan repository palsu, registry adapter, dan scraper palsu.

    `scraper` default-nya klien yang **tidak dikonfigurasi**, sehingga pengujian
    yang hanya peduli pada adapter tidak pernah mencoba menjalankan Chromium.
    """
    source_repo = FakeSourceRepository(sources if sources is not None else [])
    price_repo = FakePriceRepository(prices if prices is not None else [])
    registry = adapters if adapters is not None else {
        slug: StubAdapter(slug) for slug in (stub_slugs or [])
    }
    service = MarketplaceComparisonService(
        source_repo, price_repo, cache_ttl=ttl, clock=clock,
        client_factory=_StubClient,
        scraper_client=scraper or _UnconfiguredScraper(),
    )
    return service, source_repo, price_repo, registry


async def _with_registry(registry, coro_factory):
    """Ganti `get_adapter` selama satu pemanggilan, lalu kembalikan."""
    original = marketplace_base_get_adapter = __import__(
        "app.services.marketplace.service", fromlist=["get_adapter"]
    ).get_adapter
    module = __import__("app.services.marketplace.service", fromlist=["get_adapter"])
    module.get_adapter = registry.get
    try:
        return await coro_factory()
    finally:
        module.get_adapter = original
        assert marketplace_base_get_adapter is original


class _StubClient:
    """Klien HTTP palsu: `aclose` saja yang dibutuhkan service."""

    async def aclose(self):
        return None


class _UnconfiguredScraper:
    """Klien scraper yang alamatnya kosong: sumber e-commerce jatuh ke adapter."""

    is_configured = False

    async def search_prices(self, client, **kwargs):
        from app.services.marketplace.base import AdapterError

        raise AdapterError("Service scraper belum dikonfigurasi (SCRAPER_SERVICE_URL kosong).")


class _StubScraper:
    """Klien scraper palsu: mengembalikan penawaran yang ditentukan, atau melempar."""

    is_configured = True

    def __init__(self, offers=None, *, error=None):
        self._offers = offers or {}
        self._error = error
        self.calls = []
        self.last_keywords = None
        self.last_wanted = None

    async def search_prices(self, client, *, book_title, author=None, keywords=None, wanted_slugs=None):
        self.calls.append(book_title)
        self.last_keywords = keywords
        self.last_wanted = wanted_slugs
        if self._error:
            raise self._error
        wanted = set(wanted_slugs or self._offers)
        offers = {slug: item for slug, item in self._offers.items() if slug in wanted}
        failures = [f"{slug.title()}: tidak ada penawaran." for slug in sorted(wanted - set(offers))]
        return PrefetchOutcome(offers=offers, failures=failures)


class _BookRow:
    """Baris `books` palsu: `OrmBookRepository.get` mengubahnya jadi dict."""

    id = BOOK["id"]
    title = BOOK["title"]
    author = BOOK["author"]
    isbn = BOOK["isbn"]
    description = ""
    price = BOOK["price"]
    stock = 4
    cover_url = None
    created_at = NOW
    updated_at = NOW


_BOOK_ROW = _BookRow()


class FakeSession:
    """Sesi database palsu secukupnya untuk endpoint yang menyentuh `get_db`.

    Hanya `get` yang benar-benar dipakai (untuk memeriksa buku ada), sisanya
    disediakan supaya endpoint tidak meledak saat memanggil `commit`/`flush`.
    """

    def __init__(self, book: object | None = _BOOK_ROW):
        self._book = book
        self.commits = 0

    async def get(self, _model, _identity):
        return self._book

    async def commit(self):
        self.commits += 1

    async def flush(self):
        return None

    async def execute(self, _statement):
        raise AssertionError("FakeSession tidak melayani kueri: pakai repository palsu.")

    def add(self, _instance):
        return None

    async def delete(self, _instance):
        return None


# ---------------------------------------------------------------------------
# 1. Pembacaan harga
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Rp125.000", "125000"),
        ("Rp 1.250.000,50", "1250000.50"),
        ("IDR 125000", "125000"),
        ("$12.99", "12.99"),
        ("12.5", "12.5"),
        ("1.500", "1500"),
        ("Rp 12.500", "12500"),
        ("Rp 12.500,75", "12500.75"),
        (125000, "125000"),
        ("gratis", None),
        ("", None),
        (None, None),
        ("Rp0", None),
    ],
)
def test_normalize_price(raw, expected):
    """Semua bentuk harga yang muncul di halaman marketplace terbaca benar.

    Dibandingkan sebagai string, bukan `Decimal(...)`: `Decimal("1500")` dan
    `Decimal("1.500")` adalah nilai yang **sama**, jadi perbandingan angka akan
    meloloskan kesalahan skala seperti `1.500` yang terbaca sebagai seribu lima
    ratus alih-alih satu juta lima ratus ribu.
    """
    assert str(normalize_price(raw)) == (expected or "None")


def test_normalize_price_rejects_non_numeric_text():
    """Teks tanpa angka tidak boleh diam-diam menjadi nol."""
    assert normalize_price("Stok habis") is None


# ---------------------------------------------------------------------------
# 2. Kecocokan judul
# ---------------------------------------------------------------------------


def test_title_similarity_rewards_containment_and_rejects_lookalikes():
    """Judul yang memuat judul buku bernilai penuh; judul lain jatuh di bawah ambang."""
    containing = title_similarity("Bumi Manusia", "BUMI MANUSIA - Pramoedya (Original)")
    lookalike = title_similarity("Bumi Manusia", "Bumi Terbelah")

    assert containing == 1.0
    assert lookalike < marketplace_base.MATCH_THRESHOLD


def test_pick_best_rejects_weak_candidates():
    """Pencarian otomatis menolak kandidat yang judulnya tidak mirip."""
    class Adapter(StubAdapter):
        pass

    adapter = StubAdapter("tokopedia")
    candidates = [marketplace_base._Candidate(title="Bumi Terbelah", price=Decimal(50000))]

    with pytest.raises(AdapterError):
        adapter.pick_best("Bumi Manusia", candidates)


def test_pick_best_allows_titles_only_when_nothing_matches():
    """Halaman tanpa judul sama sekali tetap diterima — harga sah tidak ditolak."""
    adapter = StubAdapter("tokopedia")
    candidate = marketplace_base._Candidate(title="", price=Decimal(50000))

    picked, score = adapter.pick_best("Bumi Manusia", [candidate])

    assert picked is candidate
    assert score == 0.0


# ---------------------------------------------------------------------------
# 3. Aturan cache dan riwayat
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_fresh_cache_is_used_without_scraping():
    """Snapshot yang masih segar dipakai apa adanya; adapter tidak dipanggil."""
    sources = [FakeSource("tokopedia"), FakeSource("shopee")]
    prices = [
        FakePrice("tokopedia", Decimal(95000), NOW - timedelta(hours=1)),
        FakePrice("shopee", Decimal(91000), NOW - timedelta(hours=2)),
    ]
    adapters = {"tokopedia": StubAdapter("tokopedia"), "shopee": StubAdapter("shopee")}
    service, _, price_repo, registry = build(sources=sources, prices=prices, adapters=adapters)

    result = await _with_registry(registry, lambda: service.compare_book(BOOK))

    assert result["from_cache"] is True
    assert [q["marketplace"] for q in result["quotes"]] == ["shopee", "tokopedia"]
    assert result["lowest_price"] == Decimal(91000)
    assert price_repo.added == []
    assert all(adapter.calls == 0 for adapter in adapters.values())


@pytest.mark.asyncio
async def test_stale_cache_is_refreshed_and_appended_to_history():
    """Snapshot basi diambil ulang, hasilnya disimpan sebagai baris baru."""
    sources = [FakeSource("tokopedia")]
    prices = [FakePrice("tokopedia", Decimal(120000), NOW - timedelta(days=2))]
    adapters = {"tokopedia": StubAdapter("tokopedia", price="99000")}
    service, _, price_repo, registry = build(sources=sources, prices=prices, adapters=adapters)

    result = await _with_registry(registry, lambda: service.compare_book(BOOK))

    assert result["from_cache"] is False
    assert result["quotes"][0]["price"] == Decimal(99000)
    assert adapters["tokopedia"].calls == 1
    assert len(price_repo.added) == 1
    assert price_repo.added[0]["source"] == "search"
    # Riwayat: baris lama tetap ada, tidak tertimpa.
    assert len(price_repo.rows) == 2


@pytest.mark.asyncio
async def test_force_refresh_ignores_fresh_cache():
    """`force_refresh` melewati cache walau snapshot masih muda."""
    sources = [FakeSource("tokopedia")]
    prices = [FakePrice("tokopedia", Decimal(120000), NOW - timedelta(minutes=5))]
    adapters = {"tokopedia": StubAdapter("tokopedia", price="88000")}
    service, _, _, registry = build(sources=sources, prices=prices, adapters=adapters)

    result = await _with_registry(registry, lambda: service.compare_book(BOOK, force_refresh=True))

    assert result["quotes"][0]["price"] == Decimal(88000)
    assert adapters["tokopedia"].calls == 1


@pytest.mark.asyncio
async def test_admin_product_url_is_preferred_over_search():
    """Link produk yang diisi admin dipakai apa adanya dan ditandai `admin_url`."""
    sources = [FakeSource("tokopedia", product_url="https://tokopedia.test/p/1")]
    adapters = {"tokopedia": StubAdapter("tokopedia")}
    service, _, price_repo, registry = build(sources=sources, adapters=adapters)

    await _with_registry(registry, lambda: service.compare_book(BOOK))

    assert adapters["tokopedia"].last_product_url == "https://tokopedia.test/p/1"
    assert price_repo.added[0]["source"] == "admin_url"


@pytest.mark.asyncio
async def test_inactive_source_is_never_scraped():
    """Sumber yang dimatikan admin tidak ikut diambil maupun ditampilkan."""
    sources = [FakeSource("tokopedia"), FakeSource("shopee", active=False)]
    adapters = {"tokopedia": StubAdapter("tokopedia"), "shopee": StubAdapter("shopee")}
    service, _, _, registry = build(sources=sources, adapters=adapters)

    result = await _with_registry(registry, lambda: service.compare_book(BOOK))

    assert adapters["shopee"].calls == 0
    assert [q["marketplace"] for q in result["quotes"]] == ["tokopedia"]


# ---------------------------------------------------------------------------
# 3b. Jalur service scraper (Playwright), pengganti SerpApi
# ---------------------------------------------------------------------------

def _scraper_offer(slug, *, price="89000", title=BOOK["title"], url=None):
    return FetchResult(
        marketplace=slug,
        label=marketplace_label(slug),
        title=title,
        price=Decimal(price),
        url=url or f"https://{slug}.test/p/1",
        match_score=0.95,
        source="search",
    )


@pytest.mark.asyncio
async def test_scraper_offer_is_saved_as_snapshot():
    """Harga dari service scraper dipakai langsung: adapter tidak dipanggil lagi."""
    scraped = _scraper_offer("tokopedia", price="87000")
    adapters = {"tokopedia": StubAdapter("tokopedia"), "lazada": StubAdapter("lazada")}
    scraper = _StubScraper({
        "tokopedia": scraped,
        "lazada": _scraper_offer("lazada", price="91000"),
    })
    service, _, price_repo, registry = build(
        sources=[FakeSource("tokopedia"), FakeSource("lazada")],
        adapters=adapters,
        scraper=scraper,
    )

    result = await _with_registry(registry, lambda: service.compare_book(BOOK))

    assert scraper.calls == [BOOK["title"]]
    assert scraper.last_wanted == ("tokopedia", "lazada")
    assert result["lowest_price"] == Decimal(87000)
    assert sorted(row["marketplace"] for row in price_repo.added) == ["lazada", "tokopedia"]
    assert all(row["source"] == "search" for row in price_repo.added)
    assert all(adapter.calls == 0 for adapter in adapters.values())
    assert result["warnings"] == []


@pytest.mark.asyncio
async def test_admin_product_url_bypasses_the_scraper():
    """Link produk dari admin tetap dikerjakan adapter; scraper hanya untuk pencarian."""
    adapters = {"tokopedia": StubAdapter("tokopedia", price="99000")}
    scraper = _StubScraper({})
    service, _, _, registry = build(
        sources=[FakeSource("tokopedia", product_url="https://tokopedia.test/p/1")],
        adapters=adapters,
        scraper=scraper,
    )

    result = await _with_registry(registry, lambda: service.compare_book(BOOK))

    assert scraper.calls == []
    assert adapters["tokopedia"].last_product_url == "https://tokopedia.test/p/1"
    assert result["quotes"][0]["price"] == Decimal(99000)


@pytest.mark.asyncio
async def test_scraper_failure_reports_warning_without_adapter_fallback():
    """Scraper yang dikonfigurasi gagal: satu peringatan, dan tidak jatuh ke adapter bawaan."""
    adapters = {"tokopedia": StubAdapter("tokopedia", price="95000")}
    scraper = _StubScraper(error=AdapterError("Service scraper tidak bisa dihubungi."))
    service, _, price_repo, registry = build(
        sources=[FakeSource("tokopedia")],
        adapters=adapters,
        scraper=scraper,
    )

    result = await _with_registry(registry, lambda: service.compare_book(BOOK))

    assert adapters["tokopedia"].calls == 0
    assert result["quotes"] == []
    assert result["warnings"] == ["Service scraper tidak bisa dihubungi."]
    assert len(price_repo.added) == 0





def test_parse_scrape_response_creates_search_source_and_deduplicates_failures():
    from app.services.marketplace.scraper_client import parse_scrape_response

    payload = {
        "offers": {
            "tokopedia": {
                "title": BOOK["title"],
                "price": "75000",
                "product_url": "https://tokopedia.test/p/1",
                "seller_name": "Official Store",
                "in_stock": True,
                "match_score": 0.95,
            }
        },
        "failures": {
            "shopee": "Shopee: pencarian dialihkan ke verifikasi/login.",
        },
    }
    outcome = parse_scrape_response(
        payload,
        book_title=BOOK["title"],
        wanted_slugs=("tokopedia", "shopee", "lazada"),
    )
    assert outcome.offers["tokopedia"].source == "search"
    assert outcome.offers["tokopedia"].price == Decimal(75000)
    assert outcome.failures == [
        "Shopee: pencarian dialihkan ke verifikasi/login.",
        "Lazada: tidak ada penawaran.",
    ]


@pytest.mark.asyncio
async def test_repeated_total_failure_is_backed_off():
    """Setelah batas waktu semua marketplace, percobaan berikutnya tidak menunggu lagi."""
    from app.services.marketplace.service import _FULL_ATTEMPT_COOLDOWN

    _FULL_ATTEMPT_COOLDOWN.clear()

    class HangingScraper:
        is_configured = True
        calls = 0

        async def search_prices(self, client, **_kwargs):
            HangingScraper.calls += 1
            await asyncio.sleep(3600)

    adapters = {"tokopedia": StubAdapter("tokopedia")}
    hanging = HangingScraper()
    service, _, _, registry = build(
        sources=[FakeSource("tokopedia")], adapters=adapters, scraper=hanging
    )
    service._scrape_timeout = 0.05
    try:
        first = await _with_registry(registry, lambda: service.compare_book(BOOK))
        second = await _with_registry(registry, lambda: service.compare_book(BOOK))
    finally:
        _FULL_ATTEMPT_COOLDOWN.clear()

    assert hanging.calls == 1
    assert adapters["tokopedia"].calls == 0
    assert first["quotes"] == [] and second["quotes"] == []
    assert "batas waktu" in first["warnings"][0]
    assert "mencoba lagi" in second["warnings"][0]
    assert FULL_ATTEMPT_BACKOFF == timedelta(minutes=10)


# ---------------------------------------------------------------------------
# 4. Ketahanan
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_one_failing_marketplace_does_not_break_the_comparison():
    """Marketplace yang gagal masuk `warnings`; yang berhasil tetap tampil."""
    sources = [FakeSource("tokopedia"), FakeSource("shopee")]
    adapters = {
        "tokopedia": StubAdapter("tokopedia"),
        "shopee": StubAdapter("shopee", error="Shopee menolak permintaan (HTTP 403)."),
    }
    service, _, _, registry = build(sources=sources, adapters=adapters)

    result = await _with_registry(registry, lambda: service.compare_book(BOOK))

    assert [q["marketplace"] for q in result["quotes"]] == ["tokopedia"]
    # Service scraper tidak dikonfigurasi pada pengujian ini; kegagalan Shopee
    # tetap dilaporkan oleh adapter cadangan.
    assert "Shopee menolak permintaan (HTTP 403)." in result["warnings"]


@pytest.mark.asyncio
async def test_stale_snapshot_still_shown_when_refresh_fails():
    """Harga lama tetap ditampilkan bila pembaruan gagal — lebih baik daripada kosong."""
    sources = [FakeSource("tokopedia")]
    prices = [FakePrice("tokopedia", Decimal(105000), NOW - timedelta(days=3))]
    adapters = {"tokopedia": StubAdapter("tokopedia", error="Tokopedia menolak permintaan (HTTP 403).")}
    service, _, price_repo, registry = build(sources=sources, prices=prices, adapters=adapters)

    result = await _with_registry(registry, lambda: service.compare_book(BOOK))

    assert result["quotes"][0]["price"] == Decimal(105000)
    assert result["warnings"]
    assert price_repo.added == []


@pytest.mark.asyncio
async def test_book_without_sources_is_success_with_warning():
    """Buku tanpa sumber bukan error: hasilnya kosong dengan satu peringatan."""
    service, _, _, registry = build(sources=[], adapters={})

    result = await _with_registry(registry, lambda: service.compare_book(BOOK))

    assert result["quotes"] == []
    assert result["from_cache"] is True
    assert result["warnings"] == ["Belum ada sumber marketplace untuk buku ini."]


@pytest.mark.asyncio
async def test_store_price_and_savings_come_from_server_side_book_row():
    """Selisih dihitung dari harga toko di server, bukan dari apa pun dari klien."""
    sources = [FakeSource("tokopedia")]
    adapters = {"tokopedia": StubAdapter("tokopedia", price="90000")}
    service, _, _, registry = build(sources=sources, adapters=adapters)

    result = await _with_registry(registry, lambda: service.compare_book(BOOK))

    assert result["store_price"] == Decimal(98000)
    assert result["savings"] == Decimal(8000)


@pytest.mark.asyncio
async def test_history_includes_the_point_just_fetched():
    """Riwayat memuat titik yang baru diambil, terlama lebih dulu untuk digambar.

    Titik baru sengaja **ikut** ada di riwayat: grafik tren tanpa titik terbaru
    akan selalu tertinggal satu pengambilan dari harga yang ditampilkan di
    atasnya, dan itu terlihat seperti data basi.
    """
    sources = [FakeSource("tokopedia")]
    prices = [
        FakePrice("tokopedia", Decimal(120000), NOW - timedelta(hours=20)),
        FakePrice("tokopedia", Decimal(110000), NOW - timedelta(hours=8)),
    ]
    adapters = {"tokopedia": StubAdapter("tokopedia", price="100000")}
    service, _, price_repo, registry = build(sources=sources, prices=prices, adapters=adapters)

    result = await _with_registry(registry, lambda: service.compare_book(BOOK))

    history = result["history"]["tokopedia"]
    assert [point["price"] for point in history] == [
        Decimal(120000),
        Decimal(110000),
        Decimal(100000),
    ]
    assert len(price_repo.added) == 1


# ---------------------------------------------------------------------------
# 5. Registry, adapter nyata, dan URL pencarian
# ---------------------------------------------------------------------------


def test_every_slug_in_the_schema_has_an_adapter():
    """Setiap slug yang boleh disimpan ke database harus punya adapter.

    Ini penjaga ketidaksinkronan: tanpa tes ini, sebuah slug bisa lolos validasi
    API dan tersimpan, lalu baru gagal saat scrape dijalankan — di hadapan user.
    """
    schema_slugs = set(MarketplaceSlug.__args__)
    adapter_slugs = set(supported_slugs())

    assert schema_slugs == adapter_slugs, (
        f"Tanpa adapter: {sorted(schema_slugs - adapter_slugs)}; "
        f"tidak ada di skema: {sorted(adapter_slugs - schema_slugs)}"
    )
    # Slug di model harus sama pula dengan yang tersimpan di DB (CHECK constraint).
    assert set(MARKETPLACE_SLUGS) == schema_slugs


def test_registry_lookup_returns_an_adapter_and_reports_unknown_slugs():
    """`get_adapter` mengembalikan adapter untuk slug dikenal, `AdapterError` untuk sisanya."""
    adapter = get_adapter("google_books")
    assert adapter.slug == "google_books"
    assert adapter.label == "Google Books"

    with pytest.raises(AdapterError):
        get_adapter("marketplace-yang-tidak-ada")

    # Label untuk slug tak dikenal tidak boleh meledak: riwayat lama tetap terbaca.
    assert marketplace_label("slug-lama") == "slug-lama"


@pytest.mark.parametrize("slug", sorted(supported_slugs()))
def test_every_adapter_builds_an_absolute_https_url_and_escapes_the_keyword(slug):
    """Setiap adapter menghasilkan URL absolut dengan kata kunci ter-escape."""
    adapter = get_adapter(slug)
    url = adapter.build_search_url("bumi manusia & kisahnya")

    assert url.startswith("https://"), url
    # Spasi dan `&` tidak boleh lolos mentah: satu `&` mentah memecah query string
    # dan mengirim parameter palsu ke marketplace.
    assert " " not in url, url
    assert "bumi" in url


def test_bookstore_adapters_use_default_match_threshold():
    """Gramedia & Periplus memakai ambang bawaan adapter katalog."""
    default = get_adapter("tokopedia").match_threshold

    assert get_adapter("gramedia").match_threshold == default
    assert get_adapter("periplus").match_threshold == default


def test_google_books_appends_the_api_key_only_when_configured(monkeypatch):
    """Kunci API ikut di URL bila ada, dan tidak ada jejak `key=` bila kosong.

    `api_key` adalah properti (dibaca dari env saat dipanggil), jadi yang diganti
    adalah sumbernya — variabel lingkungannya — bukan atributnya.
    """
    adapter = get_adapter("google_books")

    monkeypatch.delenv("GOOGLE_BOOKS_API_KEY", raising=False)
    monkeypatch.setattr(
        "app.services.marketplace.adapters.catalog.settings.GOOGLE_BOOKS_API_KEY", ""
    )
    without_key = adapter.build_search_url("bumi manusia")
    assert "key=" not in without_key
    # `country=ID` wajib: tanpa itu harga yang keluar bukan harga untuk Indonesia.
    assert "country=ID" in without_key

    monkeypatch.setenv("GOOGLE_BOOKS_API_KEY", "rahasia-123")
    assert "key=rahasia-123" in adapter.build_search_url("bumi manusia")


def test_google_books_parser_reads_retail_price_in_idr_and_skips_other_currencies():
    """`retailPrice` menang atas `listPrice`, dan mata uang asing tidak dipaksakan."""
    payload = json.dumps(
        {
            "items": [
                {
                    "volumeInfo": {"title": "Bumi Manusia"},
                    "saleInfo": {
                        "saleability": "FOR_SALE",
                        "listPrice": {"amount": 120000.0, "currencyCode": "IDR"},
                        "retailPrice": {"amount": 98000.0, "currencyCode": "IDR"},
                    },
                },
                {
                    "volumeInfo": {"title": "Buku Dolar"},
                    "saleInfo": {
                        "saleability": "FOR_SALE",
                        "listPrice": {"amount": 12.99, "currencyCode": "USD"},
                    },
                },
                {
                    "volumeInfo": {"title": "Buku Metadata Saja"},
                    "saleInfo": {"saleability": "NOT_FOR_SALE"},
                },
            ]
        }
    )

    candidates = get_adapter("google_books").parse(payload, "https://example.test")

    assert len(candidates) == 1, "hanya item IDR yang FOR_SALE yang boleh jadi kandidat"
    assert candidates[0].title == "Bumi Manusia"
    assert candidates[0].price == Decimal(98000)
    assert candidates[0].in_stock is True


def test_open_library_refuses_to_invent_a_price():
    """Open Library tidak punya harga jual — dan itu dilaporkan, bukan dikarang."""
    adapter = get_adapter("open_library")

    with pytest.raises(AdapterError) as caught:
        adapter.parse('{"docs": [{"title": "Bumi Manusia"}]}', "https://openlibrary.org")

    # Pesannya harus menjelaskan sebabnya, bukan "harga tidak ditemukan".
    assert "metadata" in str(caught.value).lower()


@pytest.mark.asyncio
async def test_open_library_failure_becomes_a_warning_not_a_broken_comparison():
    """Kegagalan Open Library muncul sebagai peringatan; marketplace lain tetap ada.

    Ini juga pemeriksaan integrasi untuk kelas asli: `OpenLibraryAdapter.parse`
    memang menolak memberi harga, dan service harus menanganinya sebagai
    kegagalan wajar — bukan error yang menjatuhkan seluruh perbandingan.
    """
    sources = [
        FakeSource("open_library", search_keyword="bumi manusia"),
        FakeSource("tokopedia", search_keyword="bumi manusia"),
    ]
    # Tokopedia diganti stub: adapter nyatanya akan benar-benar menghubungi internet.
    # Service scraper tidak dikonfigurasi, jadi peringatannya juga ikut dihitung.
    service, _, price_repo, registry = build(
        sources=sources,
        adapters={
            "open_library": get_adapter("open_library"),
            "tokopedia": StubAdapter("tokopedia", price="88000"),
        },
    )

    result = await _with_registry(registry, lambda: service.compare_book(BOOK))

    assert [quote["marketplace"] for quote in result["quotes"]] == ["tokopedia"]
    assert "Open Library" in " ".join(result["warnings"])
    assert len(price_repo.added) == 1, "yang gagal tidak boleh menulis snapshot"


@pytest.mark.asyncio
async def test_google_books_429_is_reported_as_a_warning():
    """Diblokir kuota bukan crash: perbandingan tetap kembali dengan peringatan."""

    class QuotaExceededAdapter(StubAdapter):
        """Adapter yang selalu menolak, seperti Google Books tanpa API key."""

        def __init__(self):
            super().__init__("google_books", error="Google Books menolak permintaan (HTTP 429).")

    sources = [FakeSource("google_books", search_keyword="bumi manusia")]
    service, _, price_repo, registry = build(
        sources=sources, adapters={"google_books": QuotaExceededAdapter()}
    )

    result = await _with_registry(registry, lambda: service.compare_book(BOOK, force_refresh=True))

    assert result["quotes"] == []
    assert result["warnings"] == ["Google Books menolak permintaan (HTTP 429)."]
    assert price_repo.added == [], "tidak ada harga berarti tidak ada snapshot"


# ---------------------------------------------------------------------------
# 6. Skema dan otorisasi endpoint
# ---------------------------------------------------------------------------


def test_source_schema_requires_a_target():
    """Sumber tanpa link maupun kata kunci ditolak sebelum sampai ke database."""
    with pytest.raises(ValueError):
        MarketplaceSourceCreate(book_id=BOOK["id"], marketplace="tokopedia")

    assert MarketplaceSourceCreate(
        book_id=BOOK["id"], marketplace="tokopedia", search_keyword="bumi manusia"
    ).search_keyword == "bumi manusia"


def test_source_update_requires_at_least_one_field():
    """Patch kosong ditolak supaya tidak ada permintaan tanpa efek."""
    with pytest.raises(ValueError):
        MarketplaceSourceUpdate()


def test_paginated_book_shape_is_untouched_by_this_feature():
    """Jaring pengaman: fitur baru tidak mengubah kontrak `GET /books`."""
    assert set(BookPage.model_fields) == {"items", "total", "page", "page_size"}


@pytest.fixture(autouse=True)
def clear_overrides():
    """Bersihkan override dependency antar-tes (pola yang sama dengan test_books)."""
    yield
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_anonymous_caller_cannot_compare_prices(client):
    """Tanpa login, endpoint pembanding menolak (401/403), bukan membocorkan data."""
    response = await client.get(f"/api/v1/books/{BOOK['id']}/marketplace-prices")

    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_admin_cannot_use_customer_price_comparison(client):
    """Endpoint pembanding memakai `require_user`: admin ditolak, seperti keranjang.

    Yang di-override adalah `get_current_user`, **bukan** `require_user` — kalau
    `require_user` yang di-override, pemeriksaan perannya ikut hilang dan tes ini
    tidak lagi menguji apa pun.
    """
    app.dependency_overrides[get_current_user] = lambda: UserPayload(
        id="admin-1", email="admin@example.test", role="admin"
    )

    response = await client.get(f"/api/v1/books/{BOOK['id']}/marketplace-prices")

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_source_endpoint_requires_admin(client):
    """Pengelolaan sumber menolak pelanggan biasa."""
    app.dependency_overrides[get_current_user] = lambda: UserPayload(
        id="user-1", email="user@example.test", role="user"
    )

    response = await client.get(f"/api/v1/marketplace-sources?book_id={BOOK['id']}")

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_create_source_and_duplicate_is_rejected(client):
    """Admin bisa menambah sumber; marketplace yang sama dua kali ditolak 409."""
    source_repo = FakeSourceRepository()
    price_repo = FakePriceRepository()
    service = MarketplaceComparisonService(source_repo, price_repo, clock=lambda: NOW)
    app.dependency_overrides[require_admin] = lambda: UserPayload(
        id="admin-1", email="admin@example.test", role="admin"
    )
    app.dependency_overrides[comparison_service] = lambda: service
    app.dependency_overrides[get_db] = lambda: FakeSession()

    payload = {
        "book_id": BOOK["id"],
        "marketplace": "tokopedia",
        "product_url": "https://www.tokopedia.com/buku/bumi-manusia",
    }
    first = await client.post("/api/v1/marketplace-sources", json=payload)
    second = await client.post("/api/v1/marketplace-sources", json=payload)

    assert first.status_code == 201
    assert first.json()["data"]["label"] == "Tokopedia"
    assert second.status_code == 409


@pytest.mark.asyncio
async def test_source_without_target_is_rejected_before_any_write(client):
    """Sumber tanpa link maupun kata kunci gagal validasi (422), bukan tersimpan."""
    app.dependency_overrides[require_admin] = lambda: UserPayload(
        id="admin-1", email="admin@example.test", role="admin"
    )
    app.dependency_overrides[get_db] = lambda: FakeSession()

    response = await client.post(
        "/api/v1/marketplace-sources",
        json={"book_id": BOOK["id"], "marketplace": "tokopedia"},
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_creating_source_for_unknown_book_is_404(client):
    """Sumber tidak boleh menunjuk buku yang tidak ada."""
    app.dependency_overrides[require_admin] = lambda: UserPayload(
        id="admin-1", email="admin@example.test", role="admin"
    )
    app.dependency_overrides[comparison_service] = lambda: MarketplaceComparisonService(
        FakeSourceRepository(), FakePriceRepository(), clock=lambda: NOW
    )
    app.dependency_overrides[get_db] = lambda: FakeSession(book=None)

    response = await client.post(
        "/api/v1/marketplace-sources",
        json={
            "book_id": BOOK["id"],
            "marketplace": "tokopedia",
            "search_keyword": "bumi manusia",
        },
    )

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# 7. Adapter contoh untuk demo
# ---------------------------------------------------------------------------


def _fetch(adapter, title: str) -> FetchResult:
    """Panggil `fetch` adapter contoh persis seperti service memanggilnya.

    `client=None` memang benar: adapter contoh tidak menyentuh jaringan. Kalau
    suatu saat ia mulai menyentuh, tes ini gagal — dan itu justru yang diinginkan.
    """
    return asyncio.run(adapter.fetch(None, book_title=title, keyword="bumi manusia"))


def _price_of(adapter, title: str) -> Decimal:
    """Harga contoh untuk `title`, dibaca lewat jalur yang sama dengan produksi."""
    return _fetch(adapter, title).price


def test_mock_adapter_declares_itself_as_mock():
    """Setiap adapter demo menandai dirinya `is_mock`, dan tidak ada yang asli ikut tertandai."""
    for slug in MOCK_SLUGS:
        assert get_adapter(slug).is_mock is True, slug

    for slug in supported_slugs():
        if slug not in MOCK_SLUGS:
            assert not getattr(get_adapter(slug), "is_mock", False), slug


def test_mock_adapters_are_kept_out_of_the_admin_dropdown():
    """Adapter contoh terdaftar (bisa dipanggil) tetapi tidak ditawarkan sebagai pilihan admin.

    Dua sisi yang diperiksa bersamaan — inilah keseluruhan alasan `is_mock` ada:
    `supported_marketplaces()` mengisi dropdown "pakai marketplace mana" di halaman
    admin, dan menawarkan "Demo Store A" di sana akan mengundang admin sungguhan
    memilihnya.
    """
    offered = [adapter.slug for adapter in supported_marketplaces()]

    assert not set(offered) & set(MOCK_SLUGS), offered
    # Lewat `get_adapter` tetap bisa dipanggil: menghapusnya dari sini akan membuat
    # sumber demo yang tersimpan gagal di-scrape, bukan sekadar tak terlihat.
    for slug in MOCK_SLUGS:
        assert get_adapter(slug).slug == slug


@pytest.mark.parametrize("slug", MOCK_SLUGS)
def test_mock_adapter_price_is_deterministic_and_free_of_randomness(slug):
    """Harga contoh stabil: diturunkan dari judul lewat sha256, bukan `hash()` bawaan.

    Penting bukan hanya supaya rapi: `hash()` Python diacak per proses, sehingga
    harga demo akan berubah setiap kali server dijalankan ulang — riwayat harga di
    DB jadi derau, dan tes otomatis kehilangan maknanya.
    """
    adapter = get_adapter(slug)

    assert _price_of(adapter, "Bumi Manusia") == _price_of(adapter, "Bumi Manusia")
    # Judul berbeda harus menghasilkan angka berbeda; kalau tidak, semua buku
    # tampak berharga sama dan tabel perbandingannya tidak mendemokan apa pun.
    assert _price_of(adapter, "Bumi Manusia") != _price_of(adapter, "Laskar Pelangi")
    # Nilainya harus persis sama dengan perhitungan langsung dari hash — inilah
    # yang membuat hasilnya bisa diprediksi, bukan sekadar "stabil entah bagaimana".
    assert _price_of(adapter, "Bumi Manusia") == demo._price_for(
        "Bumi Manusia", salt=slug, multiplier=adapter.multiplier
    )


@pytest.mark.parametrize("slug", MOCK_SLUGS)
def test_mock_price_lands_in_the_advertised_range(slug):
    """Harga contoh masuk rentang yang masuk akal untuk harga buku di katalog."""
    adapter = get_adapter(slug)
    price = _price_of(adapter, "Bumi Manusia")

    assert demo.PRICE_FLOOR <= price <= demo.PRICE_CEILING * Decimal(2), price
    # Dibulatkan ke ratusan terdekat supaya terlihat seperti harga sungguhan.
    assert price % 100 == 0, price


def test_mock_stores_are_priced_apart_so_the_table_says_something():
    """Ketiga toko contoh saling berbeda harga — kalau seragam, tabelnya kosong makna.

    Yang **tidak** bisa dijamin adalah urutannya. Harga dasar diturunkan dari hash
    `(slug, judul)`, jadi pengali 0.85/1.00/1.15 hanya menggeser rentang, bukan
    menentukan peringkat: untuk judul tertentu toko "murah" bisa saja kebetulan
    berada di ujung atas rentang dasarnya. Rentangnya pun karena itu dibuat lebar
    (65rb–125rb) supaya penggeseran ini biasanya cukup untuk menghasilkan urutan
    yang berbeda-beda.

    Konsekuensinya perlu disadari: **toko termurah bisa berbeda antar buku.** Untuk
    demo, itu justru lebih baik daripada badge "Termurah" yang selalu jatuh ke toko
    yang sama sehingga tampak seperti bug.
    """
    prices = {slug: _price_of(get_adapter(slug), "Bumi Manusia") for slug in MOCK_SLUGS}

    assert len(set(prices.values())) == len(MOCK_SLUGS), prices
    # Semuanya di rentang yang masuk akal untuk harga buku di katalog.
    for slug, price in prices.items():
        assert demo.PRICE_FLOOR <= price <= demo.PRICE_CEILING * Decimal(2), (slug, price)


def test_mock_adapter_never_invents_a_link_or_a_match_score():
    """Tautan `None`, skor 0.0, dan `source="mock"`: data contoh terbaca sebagai data contoh.

    `url=None` disengaja: tidak ada halaman yang bisa dibuka, jadi lebih baik tidak
    ada tautan sama sekali daripada tautan buntu. `match_score=0.0` berarti "tidak
    ada judul yang dicocokkan", bukan "pencocokan gagal" — dan itu harus terlihat.
    """
    result = _fetch(get_adapter("demo_store_a"), "Bumi Manusia")

    assert result.url is None
    assert result.match_score == 0.0
    assert result.source == "mock"
    assert result.marketplace == "demo_store_a"
    assert result.label == "Demo Store A"
    assert result.price is not None
    # Semua harga di sistem ini rupiah; `FetchResult` tidak menyimpan mata uang,
    # melainkan `as_snapshot()` yang menetapkannya saat menulis riwayat.
    assert result.as_snapshot(str(BOOK["id"]))["currency"] == "IDR"


def test_demo_store_c_is_the_one_that_teaches_the_out_of_stock_badge():
    """Tepat satu toko contoh berstok habis, sehingga kedua keadaan UI bisa dilihat."""
    stock = {slug: _fetch(get_adapter(slug), "Bumi Manusia").in_stock for slug in MOCK_SLUGS}

    assert stock["demo_store_c"] is False
    assert stock["demo_store_a"] is True
    assert stock["demo_store_b"] is True


def test_mock_adapter_writes_no_page_requests_at_all():
    """Jaring pengaman: `fetch` adapter contoh tidak pernah menyentuh jaringan.

    Diuji dengan klien yang meledak saat dipakai. Adapter sungguhan memang harus
    menghubungi internet; yang ini tidak boleh — itulah satu-satunya alasan
    keberadaannya, dan tanpa tes ini ia bisa diam-diam mulai memanggil jaringan.
    """

    class ExplodingClient:
        """Klien yang gagal pada setiap atribut — termasuk yang belum ada."""

        def __getattr__(self, name):
            raise AssertionError(f"Adapter contoh menyentuh jaringan lewat `{name}`.")

    for slug in MOCK_SLUGS:
        result = asyncio.run(
            get_adapter(slug).fetch(
                ExplodingClient(), book_title="Bumi Manusia", keyword="bumi manusia"
            )
        )
        assert result.price > 0, slug


def test_mock_adapter_parses_nothing_and_says_so():
    """`parse` melempar, bukan mengembalikan daftar kosong.

    Daftar kosong akan terbaca sebagai "halaman dibaca, tidak ada harga" — padahal
    memang tidak ada halaman yang dibaca. Melempar membuat salah paham itu mustahil.
    """
    with pytest.raises(NotImplementedError):
        get_adapter("demo_store_a").parse("<html></html>", "https://demo.invalid/x")


def test_mock_search_url_can_never_point_at_a_real_site():
    """Tautan pencarian demo memakai domain `.invalid` (RFC 2606) — dijamin tak resolve.

    Bahkan kalau suatu saat `build_search_url` dipanggil, tidak ada permintaan yang
    bisa tanpa sengaja menuju situs marketplace sungguhan.
    """
    for slug in MOCK_SLUGS:
        url = get_adapter(slug).build_search_url("bumi manusia")

        assert url.startswith(f"https://{demo.UNRESOLVABLE_HOST}/"), url


@pytest.mark.asyncio
async def test_a_demo_source_flows_through_the_real_service():
    """Yang sungguh diuji: sumber `demo_store_a` melewati service produksi, bukan jalur khusus.

    Adapter demo tidak di-stub di sini — service memanggilnya apa adanya, lewat
    `get_adapter` yang sama dengan marketplace sungguhan. Kalau suatu saat ada
    `if slug.startswith("demo")` yang menyusup ke service, tes ini akan lolos
    diam-diam; karena itu pemeriksaan `source` dan `match_score` ada di bawah.
    """
    sources = [FakeSource("demo_store_a", search_keyword="bumi manusia")]
    service, _, price_repo, registry = build(
        sources=sources, adapters={"demo_store_a": get_adapter("demo_store_a")}
    )

    result = await _with_registry(registry, lambda: service.compare_book(BOOK))

    assert len(result["quotes"]) == 1
    quote = result["quotes"][0]
    assert quote["marketplace"] == "demo_store_a"
    assert quote["label"] == "Demo Store A"
    assert quote["source"] == "mock"
    assert quote["product_url"] is None
    assert result["warnings"] == []
    # Snapshot tetap ditulis seperti harga sungguhan — justru itu tujuannya:
    # seluruh alur cache dan riwayat ikut terlatih.
    assert len(price_repo.added) == 1
    assert price_repo.added[0]["source"] == "mock"


def test_demo_slugs_are_accepted_by_the_source_schema():
    """Admin boleh menyimpan sumber berslug demo; skema Pydantic tidak menolaknya.

    Ini yang membuat demo bisa disiapkan lewat API yang sama dengan produksi —
    tanpa itu, satu-satunya cara memasang sumber demo adalah menyentuh DB langsung.
    """
    source = MarketplaceSourceCreate(
        book_id=BOOK["id"], marketplace="demo_store_a", search_keyword="bumi manusia"
    )

    assert source.marketplace == "demo_store_a"


# ---------------------------------------------------------------------------
# 8. Tipe kolom waktu ORM vs `timestamptz`
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("model", "column"),
    [
        (MarketplaceSource, "created_at"),
        (MarketplaceSource, "updated_at"),
        (MarketplacePrice, "fetched_at"),
    ],
)
def test_timestamp_columns_are_timezone_aware(model, column):
    """Kolom waktu wajib `timezone=True`, karena DB-nya `timestamptz`.

    Ini mengunci bug yang lolos dari seluruh pengujian lain di berkas ini: dengan
    `Mapped[datetime]` polos, SQLAlchemy memetakan kolom ke
    `TIMESTAMP WITHOUT TIME ZONE`. Menulis nilai `datetime.now(UTC)` ke kolom
    seperti itu **bukan** sekadar salah tipe — asyncpg menolaknya sebelum barisnya
    sampai ke database:

        TypeError: can't subtract offset-naive and offset-aware datetimes

    Repository palsu tidak pernah menyentuh driver, jadi tidak satu pun tes lain
    di sini bisa menangkapnya; yang ini memeriksa definisi kolomnya langsung,
    tanpa perlu database.
    """
    col = model.__table__.c[column]

    assert col.type.timezone is True, (
        f"{model.__name__}.{column} dipetakan tanpa zona waktu. "
        "Tambahkan `DateTime(timezone=True)`."
    )


def test_source_timestamp_columns_are_distinct_objects():
    """Jaring pengaman kecil: `created_at` dan `updated_at` bukan kolom yang sama."""
    table = MarketplaceSource.__table__

    assert table.c.created_at is not table.c.updated_at


# ---------------------------------------------------------------------------
# 9. Sumber marketplace bawaan
# ---------------------------------------------------------------------------

from app.services.marketplace.seeding import build_default_source_rows, default_keyword


def test_default_source_rows_cover_scraper_marketplaces_only():
    """Penyemaian membuat sumber untuk lima marketplace scraper, tanpa slug demo."""
    rows = build_default_source_rows("book-1", title="Bumi Manusia", author="Pramoedya")

    assert [row["marketplace"] for row in rows] == list(SCRAPER_SUPPORTED_SLUGS)
    assert {row["marketplace"] for row in rows} <= {item.slug for item in supported_marketplaces()}
    assert all(row["product_url"] is None for row in rows)
    assert all(row["search_keyword"] == "Bumi Manusia Pramoedya" for row in rows)


def test_default_keyword_is_collapsed_trimmed_and_capped():
    """Spasi berlebih dirapikan; kata kunci panjang dipotong ke batas kolom."""
    assert default_keyword("  Bumi   Manusia ", None) == "Bumi Manusia"
    assert len(default_keyword("A" * 400, "B" * 100)) == 255
    assert build_default_source_rows("book-1", title="   ", author=None) == []



@pytest.mark.asyncio
async def test_seed_endpoint_creates_sources_and_is_idempotent():
    """Endpoint isi ulang menambah lima sumber sekali; panggilan kedua tanpa hasil."""
    service, source_repo, _, _ = build()

    app.dependency_overrides[require_admin] = lambda: {"role": "admin", "sub": "admin-1"}
    app.dependency_overrides[comparison_service] = lambda: service
    app.dependency_overrides[get_db] = lambda: FakeSession()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http:
        first = await http.post(f"/api/v1/books/{BOOK['id']}/marketplace-sources/seed")
        second = await http.post(f"/api/v1/books/{BOOK['id']}/marketplace-sources/seed")

    assert first.status_code == 200
    assert [item["marketplace"] for item in first.json()["data"]] == list(SCRAPER_SUPPORTED_SLUGS)
    assert second.status_code == 200
    assert second.json()["data"] == []
    assert len(source_repo.rows) == len(SCRAPER_SUPPORTED_SLUGS)
