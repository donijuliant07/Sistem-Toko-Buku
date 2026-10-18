"""Orkestrasi perbandingan harga lintas marketplace.

Alur `compare_book` berbentuk "pakai cache dulu, scrape yang basi saja":

1. baca sumber aktif buku dari `marketplace_sources`;
2. baca snapshot terbaru per marketplace — itulah cache-nya;
3. marketplace yang snapshot-nya belum ada atau sudah lebih tua dari `cache_ttl`
   di-scrape **bersamaan** (`asyncio.gather`), lalu hasilnya disisipkan sebagai
   baris baru (riwayat tumbuh, tidak ada yang ditimpa);
4. susun perbandingan: kutipan terurut menaik, harga terendah/tertinggi, selisih
   terhadap harga toko sendiri, dan riwayat per marketplace.

Empat keputusan yang perlu disebut:

- **Kegagalan satu marketplace bukan kegagalan permintaan.** Adapter yang gagal
  masuk ke `warnings`; marketplace lain tetap tampil, dan harga lama yang sudah
  tersimpan tetap dipakai untuk marketplace yang gagal itu.
- **Harga toko tidak pernah dititipkan klien.** `store_price` dibaca dari baris
  `books` di server, mengikuti aturan di `app/services/__init__.py`.
- **Buku tanpa sumber bukan error.** Hasilnya sukses dengan `quotes` kosong dan
  satu peringatan; bukunya sendiri tetap ada dan tetap bisa dibeli.
- **Waktu disuntikkan.** `clock` bisa diganti pada pengujian, sehingga uji "cache
  basi" tidak perlu menunggu enam jam sungguhan.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

import httpx

from app.services.marketplace.base import AdapterError, FetchResult, build_client
from app.services.marketplace.decision_engine import PriceValidationEngine
from app.services.marketplace.registry import get_adapter, marketplace_label
from app.services.marketplace.scraper_client import (
    SCRAPER_SUPPORTED_SLUGS,
    ScraperServiceClient,
)

#: Umur cache snapshot. Selama masih lebih muda, klik berikutnya membaca DB saja —
#: inilah yang mencegah fitur ini menyerang marketplace berkali-kali.
DEFAULT_CACHE_TTL = timedelta(hours=6)

#: Jumlah titik riwayat per marketplace yang dikirim ke UI (bahan grafik tren).
HISTORY_LIMIT = 60

#: Batas baris riwayat yang ditarik sekali baca, supaya satu permintaan tidak
#: menarik seluruh tabel.
HISTORY_ROWS_LIMIT = 400

#: Batas waktu **total** satu putaran scraping. Adapter HTML sudah punya batas
#: per permintaan, tetapi beberapa marketplace yang lambat bisa menjumlahkan
#: menjadi menit-menit — dan modal perbandingan harga tampak membeku karena
#: tidak ada yang pernah menyerah. Bila batas ini tercapai, marketplace yang
#: belum selesai dianggap gagal (masuk `warnings`), dan harga lama/dari cache
#: tetap ditampilkan. Lebih panjang dari batas panggilan scraper
#: (`SCRAPER_TIMEOUT_SECONDS`, 20 dtk) lebih satu putaran adapter.
SCRAPE_TIMEOUT_SECONDS = 25.0


#: Berapa lama pantangan mencoba ulang diterapkan per buku setelah satu putaran
#: penuh kena batas waktu. Cukup untuk meredakan beban, cukup singkat agar buku
#: itu pulih sendiri walau admin tidak melakukan apa pun.
FULL_ATTEMPT_BACKOFF = timedelta(minutes=10)

#: Pantangan per buku: ``book_id -> {"until": datetime, "signature": str}``.
#: In-memory dan per-proses, seperti `_LAST_FORCE_REFRESH` di layer API: cukup
#: untuk pemakaian satu proses, dan tidak berpura-pura jadi cache terdistribusi.
_FULL_ATTEMPT_COOLDOWN: dict[str, tuple[datetime, tuple[str, ...]]] = {}

def _utcnow() -> datetime:
    """Waktu sekarang UTC, timezone-aware — sama bentuknya dengan kolom `timestamptz`."""
    return datetime.now(UTC)


def _as_aware(value: datetime | None) -> datetime | None:
    """Pastikan waktu dari database selalu timezone-aware.

    `timestamptz` mengembalikan waktu sadar-zona, tetapi fake session pada
    pengujian bisa mengembalikan waktu naif. Tanpa penyetaraan ini, perbandingan
    waktu melempar `TypeError` alih-alih sekadar menganggap cache basi.
    """
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _to_decimal(value: Any) -> Decimal:
    """Nilai apa pun dari DB/ORM menjadi `Decimal` — uang tidak pernah jadi `float`."""
    return value if isinstance(value, Decimal) else Decimal(str(value))


class MarketplaceComparisonService:
    """Bandingkan harga satu buku di seluruh marketplace yang dikonfigurasi.

    Stateless seperti `OrderService`/`CartService`: seluruh ketergantungan masuk
    lewat konstruktor, sehingga bisa diuji dengan repository palsu tanpa database
    dan adapter palsu tanpa jaringan.
    """

    def __init__(
        self,
        source_repo: Any,
        price_repo: Any,
        *,
        cache_ttl: timedelta = DEFAULT_CACHE_TTL,
        clock: Callable[[], datetime] = _utcnow,
        client_factory: Callable[[], httpx.AsyncClient] = build_client,
        scraper_client: ScraperServiceClient | None = None,
        validation_engine: PriceValidationEngine | None = None,
    ) -> None:
        self._sources = source_repo
        self._prices = price_repo
        self._cache_ttl = cache_ttl
        self._clock = clock
        self._client_factory = client_factory
        self._scraper = scraper_client if scraper_client is not None else ScraperServiceClient()
        self._validator = validation_engine if validation_engine is not None else PriceValidationEngine()
        # Dibaca per instance supaya pengujian bisa memperpendeknya tanpa menunggu
        # 25 detik sungguhan.
        self._scrape_timeout = SCRAPE_TIMEOUT_SECONDS

    @property
    def sources(self) -> Any:
        """Repository `marketplace_sources` milik permintaan ini.

        Dipublikasikan sebagai properti (bukan dibiarkan private) karena endpoint
        admin memang mengelola sumber secara langsung — menyembunyikannya hanya
        akan memaksa layer API menembus atribut private, yang lebih buruk.
        """
        return self._sources

    @property
    def prices(self) -> Any:
        """Repository `marketplace_prices` milik permintaan ini."""
        return self._prices

    async def compare_book(
        self,
        book: dict[str, Any],
        *,
        force_refresh: bool = False,
    ) -> dict[str, Any]:
        """Bangun perbandingan harga untuk satu buku (dict berkolom `books`).

        `force_refresh` melewati cache sekali; pemanggilnya di layer API dibatasi
        laju supaya tidak bisa dipakai menekan marketplace berulang kali.
        """
        book_id = UUID(str(book["id"]))
        book_title = str(book.get("title") or "")
        keyword = " ".join(part for part in (book_title, book.get("author") or "") if part).strip()

        sources = await self._sources.list_for_book(book_id, only_active=True)
        sources, backoff_warnings = self._apply_full_attempt_backoff(book_id, sources)
        snapshots = await self._prices.latest_for_book(book_id)
        latest_by_slug = {row.marketplace: row for row in snapshots}
        # Riwayat dijalankan saat sesi database menganggur — yaitu selama
        # `_scrape` menunggu jaringan — lalu ditunggu sebelum penulisan
        # snapshot. `AsyncSession` tidak boleh dipakai dua operasi sekaligus,
        # jadi query ini tidak boleh berjalan bersamaan dengan flush.
        history_task = asyncio.create_task(self._history(book_id))
        try:
            return await self._compare_with_history(
                book_id=book_id,
                book=book,
                book_title=book_title,
                keyword=keyword,
                sources=sources,
                latest_by_slug=latest_by_slug,
                history_task=history_task,
                force_refresh=force_refresh,
                extra_warnings=backoff_warnings,
            )
        except BaseException:
            # Permintaan dibatalkan/error di tengah scraping: jangan tinggalkan
            # query riwayat yang masih berjalan di sesi database bersama.
            history_task.cancel()
            raise

    async def _compare_with_history(
        self,
        *,
        book_id: UUID,
        book: dict[str, Any],
        book_title: str,
        keyword: str,
        sources: list[Any],
        latest_by_slug: dict[str, Any],
        history_task: asyncio.Task[dict[str, list[dict[str, Any]]]],
        force_refresh: bool,
        extra_warnings: list[str] | None = None,
    ) -> dict[str, Any]:
        """Sisa `compare_book` setelah riwayat dijadwalkan (lihat di sana)."""
        now = self._clock()
        warnings: list[str] = list(extra_warnings or [])
        quotes: dict[str, FetchResult] = {}
        scraped_slugs: set[str] = set()
        # Setiap jalur yang keluar dari fungsi ini menunggu/membatalkan task
        # riwayat, supaya tidak ada query yatim di sesi database bersama.
        history: dict[str, list[dict[str, Any]]] = {}
        new_snapshots: list[Any] = []

        try:
            # Snapshot yang masih segar dipakai apa adanya; hanya yang basi di-scrape.
            # Yang basi **tidak** langsung dipakai: kalau pembaruannya gagal, barulah
            # harga lamanya dipakai sebagai cadangan (lihat setelah penulisan).
            stale: list[Any] = []
            for source in sources:
                row = latest_by_slug.get(source.marketplace)
                if row is None or force_refresh or self._is_stale(row, now):
                    stale.append(source)
                else:
                    quotes[source.marketplace] = _result_from_row(row)

            if stale:
                try:
                    fresh, failures = await asyncio.wait_for(
                        self._scrape(
                            sources=stale,
                            book_title=book_title,
                            author=book.get("author"),
                            keyword=keyword,
                        ),
                        timeout=self._scrape_timeout,
                    )
                except TimeoutError:
                    self._mark_full_attempt(book_id, sources)
                    # Satu marketplace yang menggantung tidak boleh menahan seluruh
                    # respons: tampilkan yang ada (cache/riwayat) + peringatan.
                    fresh, failures = {}, [
                        (
                            "Pencarian harga melebihi batas waktu; "
                            "menampilkan harga terakhir yang tersedia."
                        )
                    ]
                warnings.extend(failures)
                for source in stale:
                    result = fresh.get(source.marketplace)
                    if result is None:
                        # Gagal diperbarui: tampilkan harga lama yang masih tersimpan
                        # bila ada, dengan peringatan yang sudah dicatat di atas.
                        row = latest_by_slug.get(source.marketplace)
                        if row is not None and not force_refresh:
                            quotes[source.marketplace] = _result_from_row(row)
                        continue
                    quotes[source.marketplace] = result
                    scraped_slugs.add(source.marketplace)
                    # Baris baru, bukan penimpaan: riwayat harga tumbuh dari sini.
                    # Dikumpulkan dulu supaya satu perbandingan = satu batch insert.
                    new_snapshots.append(result.as_snapshot(str(book_id)))
                history_read_before_insert = history_task.done()
                if new_snapshots:
                    await self._prices.add_snapshots(new_snapshots)
            history = await history_task
            # Bila query riwayat selesai selama scraping, ia belum melihat titik
            # yang baru disimpan; sisipkan di memori daripada query ulang.
            if new_snapshots and history_read_before_insert:
                for snapshot in new_snapshots:
                    points = history.setdefault(snapshot["marketplace"], [])
                    points.append(
                        {
                            "price": _to_decimal(snapshot["price"]),
                            "fetched_at": _as_aware(snapshot["fetched_at"]),
                        }
                    )
                    del points[:-HISTORY_LIMIT]
        except BaseException:
            history_task.cancel()
            raise

        if not sources:
            warnings.append("Belum ada sumber marketplace untuk buku ini.")

        ordered = sorted(quotes.values(), key=lambda item: item.price)
        store_price = _to_decimal(book.get("price"))

        raw_quote_payloads = [
            _quote_payload(item, latest_by_slug.get(slug), now, scraped=slug in scraped_slugs)
            for slug, item in sorted(quotes.items(), key=lambda pair: pair[1].price)
        ]

        # Jalankan validasi harga hybrid (deterministik + analisis AI)
        validation_outcome = await self._validator.validate_comparison(
            book=book,
            raw_quotes=raw_quote_payloads,
        )

        valid_offers = validation_outcome["valid_offers"]
        review_offers = validation_outcome["review_offers"]
        rejected_offers = validation_outcome["rejected_offers"]

        # Prioritaskan harga terbaik dari penawaran yang lolos validasi
        lowest_price = validation_outcome["lowest_price"] if valid_offers else (ordered[0].price if ordered else None)
        highest_price = validation_outcome["highest_price"] if valid_offers else (ordered[-1].price if ordered else None)
        savings = (store_price - lowest_price) if lowest_price is not None else None

        return {
            "book_id": book_id,
            "book_title": book_title,
            "store_price": store_price,
            "quotes": raw_quote_payloads,
            "valid_offers": valid_offers,
            "review_offers": review_offers,
            "rejected_offers": rejected_offers,
            "price_statistics": validation_outcome["price_statistics"],
            "ai_validation_status": validation_outcome["ai_validation_status"],
            "validation_summary": validation_outcome["validation_summary"],
            "lowest_price": lowest_price,
            "highest_price": highest_price,
            "savings": savings,
            "history": history,
            "fetched_at": now,
            "from_cache": not stale,
            "warnings": warnings,
        }

    # ------------------------------------------------------------------
    # Bagian internal
    # ------------------------------------------------------------------

    def _apply_full_attempt_backoff(self, book_id: UUID, sources: list[Any]) -> tuple[list[Any], list[str]]:
        """Singkirkan sementara marketplace yang baru saja membuat putaran gagal total.

        Semua marketplace dicari dalam satu panggilan scraper. Bila panggilan itu
        kehabisan waktu, mencoba lagi saat pengguna berikutnya membuka buku yang
        sama akan menghasilkan kegagalan yang sama — sambil menahan permintaan
        itu juga. Selama masa pantangan, marketplace tersebut tidak diminta;
        harga terakhir (bila ada) tetap tampil.

        Pantangan dilewati begitu daftar marketplace yang diminta berubah
        (admin menambah/menghapus sumber) atau waktu habis, sehingga buku yang
        sebelumnya gagal tetap bisa pulih tanpa intervensi.
        """
        key = str(book_id)
        entry = _FULL_ATTEMPT_COOLDOWN.get(key)
        if entry is None:
            return sources, []
        until, signature = entry
        now = self._clock()
        current = tuple(sorted(source.marketplace for source in sources))
        if now >= until or signature != current:
            _FULL_ATTEMPT_COOLDOWN.pop(key, None)
            return sources, []

        remaining = int((until - now).total_seconds() / 60) + 1
        return [], [
            (
                "Pencarian harga marketplace baru saja gagal seluruhnya; "
                f"mencoba lagi dalam {remaining} menit."
            )
        ]

    def _mark_full_attempt(self, book_id: UUID, sources: list[Any]) -> None:
        """Catat putaran yang gagal total agar tidak diulang segera."""
        _FULL_ATTEMPT_COOLDOWN[str(book_id)] = (
            self._clock() + FULL_ATTEMPT_BACKOFF,
            tuple(sorted(source.marketplace for source in sources)),
        )

    def _is_stale(self, row: Any, now: datetime) -> bool:
        """Apakah snapshot sudah lebih tua dari `cache_ttl`."""
        fetched_at = _as_aware(row.fetched_at)
        if fetched_at is None:
            return True
        return now - fetched_at > self._cache_ttl

    async def _scrape(
        self,
        *,
        sources: list[Any],
        book_title: str,
        keyword: str,
        author: str | None = None,
    ) -> tuple[dict[str, FetchResult], list[str]]:
        """Scrape seluruh sumber basi secara paralel.

        Marketplace e-commerce (Tokopedia, Lazada, Blibli, Gramedia, Periplus, Shopee)
        diambil lewat **service scraper** Playwright dalam **satu panggilan**:
        worker dan backend tidak sama-sama mencari, dan slug-slug itu
        berjalan bersamaan di worker — syarat agar muat dalam batas waktu.
        Sumber dengan `product_url` dari admin melewati scraper dan langsung
        dibuka adapter, karena halaman yang dimaksud sudah pasti benar.

        Adapter bawaan tetap dipakai untuk marketplace yang bukan e-commerce
        (Google Books, Open Library, demo). Bila service scraper belum
        dikonfigurasi, sumber e-commerce jatuh ke adapter bawaan dan
        peringatannya menjelaskan penyebabnya.
        """
        client = self._client_factory()
        results: dict[str, FetchResult] = {}
        failures: list[str] = []
        try:
            remaining_sources = list(sources)
            scraper_sources = [
                s for s in sources
                if s.marketplace in SCRAPER_SUPPORTED_SLUGS and not getattr(s, "product_url", None)
            ]
            if scraper_sources and self._scraper.is_configured:
                wanted = tuple(dict.fromkeys(s.marketplace for s in scraper_sources))
                remaining_sources = [s for s in remaining_sources if s not in scraper_sources]
                try:
                    outcome = await self._scraper.search_prices(
                        client,
                        book_title=book_title,
                        author=author,
                        keywords={
                            s.marketplace: s.search_keyword
                            for s in scraper_sources
                            if getattr(s, "search_keyword", None)
                        },
                        wanted_slugs=wanted,
                    )
                except AdapterError as err:
                    # Seluruh marketplace e-commerce gagal dalam satu panggilan:
                    # satu peringatan, bukan lima.
                    failures.append(str(err))
                else:
                    results.update(outcome.offers)
                    # Kegagalan per-slug hanya dilaporkan untuk marketplace yang
                    # memang diminta buku ini.
                    failures.extend(
                        message
                        for message in outcome.failures
                        if any(
                            marketplace_label(slug) in message
                            for slug in wanted
                        )
                    )

            if remaining_sources:
                tasks = [self._fetch_one(client, source, book_title, keyword) for source in remaining_sources]
                outcomes = await asyncio.gather(*tasks, return_exceptions=True)
                for source, outcome in zip(remaining_sources, outcomes):
                    if isinstance(outcome, FetchResult):
                        results[source.marketplace] = outcome
                    elif isinstance(outcome, AdapterError):
                        failures.append(str(outcome))
                    elif isinstance(outcome, BaseException):
                        failures.append(f"{marketplace_label(source.marketplace)} gagal diambil ({type(outcome).__name__}).")
        finally:
            await client.aclose()

        return results, failures

    async def _fetch_one(
        self,
        client: httpx.AsyncClient,
        source: Any,
        book_title: str,
        keyword: str,
    ) -> FetchResult:
        """Ambil harga satu sumber; link dari admin dipakai bila tersedia."""
        adapter = get_adapter(source.marketplace)
        target_keyword = source.search_keyword or keyword or book_title
        return await adapter.fetch(
            client,
            book_title=book_title,
            keyword=target_keyword,
            product_url=source.product_url or None,
        )

    async def _history(self, book_id: UUID) -> dict[str, list[dict[str, Any]]]:
        """Riwayat harga per marketplace, terlama lebih dulu siap digambar."""
        rows = await self._prices.history_for_book(book_id, limit=HISTORY_ROWS_LIMIT)
        grouped: dict[str, list[dict[str, Any]]] = {}
        for row in rows:  # sudah terbaru-dulu dari repository
            points = grouped.setdefault(row.marketplace, [])
            if len(points) < HISTORY_LIMIT:
                points.append(
                    {"price": _to_decimal(row.price), "fetched_at": _as_aware(row.fetched_at)}
                )
        for points in grouped.values():
            points.reverse()
        return grouped


def _result_from_row(row: Any) -> FetchResult:
    """Ubah snapshot tersimpan menjadi `FetchResult` agar diperlakukan seragam."""
    return FetchResult(
        marketplace=row.marketplace,
        label=marketplace_label(row.marketplace),
        title=row.product_title or "",
        price=_to_decimal(row.price),
        url=row.product_url,
        seller=row.seller_name,
        in_stock=row.in_stock,
        match_score=float(row.match_score) if row.match_score is not None else 0.0,
        source=row.source,
    )


def _quote_payload(
    result: FetchResult,
    stored_row: Any | None,
    now: datetime,
    *,
    scraped: bool,
) -> dict[str, Any]:
    """Bentuk satu kutipan untuk respons API.

    `fetched_at` memakai waktu baris tersimpan untuk data dari cache, dan waktu
    sekarang untuk data yang baru saja di-scrape — supaya UI bisa membedakan
    "harga ini baru diambil" dari "harga ini dari cache".
    """
    stored_time = _as_aware(stored_row.fetched_at) if stored_row is not None else None
    return {
        "marketplace": result.marketplace,
        "label": result.label,
        "price": result.price,
        "currency": "IDR",
        "product_url": result.url,
        "product_title": result.title or None,
        "seller_name": result.seller,
        "in_stock": result.in_stock,
        "match_score": result.match_score,
        "source": result.source,
        "fetched_at": now if scraped or stored_time is None else stored_time,
    }


def build_service(source_repo: Any, price_repo: Any, **kwargs: Any) -> MarketplaceComparisonService:
    """Bangun service untuk satu permintaan — **titik suntik** pengujian."""
    return MarketplaceComparisonService(source_repo, price_repo, **kwargs)
