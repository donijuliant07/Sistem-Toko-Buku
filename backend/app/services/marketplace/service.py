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
from app.services.marketplace.registry import get_adapter, marketplace_label

#: Umur cache snapshot. Selama masih lebih muda, klik berikutnya membaca DB saja —
#: inilah yang mencegah fitur ini menyerang marketplace berkali-kali.
DEFAULT_CACHE_TTL = timedelta(hours=6)

#: Jumlah titik riwayat per marketplace yang dikirim ke UI (bahan grafik tren).
HISTORY_LIMIT = 60

#: Batas baris riwayat yang ditarik sekali baca, supaya satu permintaan tidak
#: menarik seluruh tabel.
HISTORY_ROWS_LIMIT = 400


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
    ) -> None:
        self._sources = source_repo
        self._prices = price_repo
        self._cache_ttl = cache_ttl
        self._clock = clock
        self._client_factory = client_factory

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
        snapshots = await self._prices.latest_for_book(book_id)
        latest_by_slug = {row.marketplace: row for row in snapshots}

        now = self._clock()
        warnings: list[str] = []
        quotes: dict[str, FetchResult] = {}
        scraped_slugs: set[str] = set()

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
            fresh, failures = await self._scrape(
                sources=stale, book_title=book_title, keyword=keyword
            )
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
                await self._prices.add_snapshot(result.as_snapshot(str(book_id)))

        if not sources:
            warnings.append("Belum ada sumber marketplace untuk buku ini.")

        ordered = sorted(quotes.values(), key=lambda item: item.price)
        store_price = _to_decimal(book.get("price"))

        return {
            "book_id": book_id,
            "book_title": book_title,
            "store_price": store_price,
            "quotes": [
                _quote_payload(item, latest_by_slug.get(slug), now, scraped=slug in scraped_slugs)
                for slug, item in sorted(quotes.items(), key=lambda pair: pair[1].price)
            ],
            "lowest_price": ordered[0].price if ordered else None,
            "highest_price": ordered[-1].price if ordered else None,
            "savings": (store_price - ordered[0].price) if ordered else None,
            "history": await self._history(book_id),
            "fetched_at": now,
            "from_cache": not stale,
            "warnings": warnings,
        }

    # ------------------------------------------------------------------
    # Bagian internal
    # ------------------------------------------------------------------

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
    ) -> tuple[dict[str, FetchResult], list[str]]:
        """Scrape seluruh sumber basi secara paralel.

        `return_exceptions=True` disengaja: satu marketplace yang memblokir
        permintaan tidak boleh membatalkan perbandingan marketplace lain.
        """
        client = self._client_factory()
        results: dict[str, FetchResult] = {}
        failures: list[str] = []
        try:
            tasks = [self._fetch_one(client, source, book_title, keyword) for source in sources]
            outcomes = await asyncio.gather(*tasks, return_exceptions=True)
        finally:
            await client.aclose()

        for source, outcome in zip(sources, outcomes):
            if isinstance(outcome, FetchResult):
                results[source.marketplace] = outcome
            elif isinstance(outcome, AdapterError):
                failures.append(str(outcome))
            elif isinstance(outcome, BaseException):
                # Bukan kegagalan marketplace yang dikenal — jangan diam-diam
                # disamarkan sebagai peringatan biasa, tapi jangan pula
                # menggagalkan permintaan.
                failures.append(f"{marketplace_label(source.marketplace)} gagal diambil ({type(outcome).__name__}).")
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
