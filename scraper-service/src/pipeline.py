"""Pipeline orkestrasi scraping harga buku secara berkala.

Dipakai dalam dua bentuk:

- **Worker cron** (`python -m src.main`): ambil buku dari database, scrape semua
  marketplace, simpan ke `marketplace_prices`.
- **Server API** (`python -m src.api`): dipanggil backend saat pengguna membuka
  perbandingan harga. Hasilnya dikembalikan lewat HTTP, *tidak* disimpan ke
  database — backend yang menyimpan.

Keduanya memakai jalur yang sama: tiap marketplace dicoba langsung dengan
Playwright; yang tidak menghasilkan apa pun tidak dicoba ulang dengan cara lain.
"""

import asyncio
import logging
import random
import time
from dataclasses import dataclass
from typing import Any

from src.browser import browser_manager
from src.config import settings
from src.db import fetch_books_to_scrape, get_db_session, save_marketplace_price
from src.scrapers.base import (
    BaseMarketplaceScraper,
    ScrapedItem,
    ScraperUnavailable,
    author_in_keyword,
)
from src.scrapers.blibli import BlibliScraper
from src.scrapers.filtering import select_best_offer
from src.scrapers.gramedia import GramediaScraper
from src.scrapers.periplus import PeriplusScraper
from src.scrapers.lazada import LazadaScraper
from src.scrapers.shopee import ShopeeScraper
from src.scrapers.tokopedia import TokopediaScraper

logger = logging.getLogger(__name__)

#: Marketplace yang di-scrape, dalam urutan percobaan. Semuanya lewat browser:
#: Shopee sering dialihkan ke verifikasi; tetap dicoba agar kegagalan tercatat di UI.
SCRAPERS: tuple[BaseMarketplaceScraper, ...] = (
    TokopediaScraper(),
    LazadaScraper(),
    BlibliScraper(),
    GramediaScraper(),
    PeriplusScraper(),
    ShopeeScraper(),
)

MARKETPLACE_SLUGS: tuple[str, ...] = tuple(scraper.marketplace for scraper in SCRAPERS)


@dataclass
class BookScrapeResult:
    """Hasil satu buku: penawaran terbaik per marketplace dan alasannya."""

    offers: dict[str, ScrapedItem]
    #: Slug marketplace yang gagal/kosong beserta alasan singkat untuk UI.
    failures: dict[str, str]


async def scrape_book_offers(
    title: str,
    author: str | None = None,
    *,
    keywords: dict[str, str] | None = None,
    deadline_seconds: float = 18.0,
) -> BookScrapeResult:
    """Scrape satu buku di semua marketplace, berjalan **bersamaan**.

    Berurutan, lima marketplace butuh 60-90 detik; berjalan bersamaan cukup
    selama marketplace terlambat (12-16 detik). Itu syarat agar prefetch dari
    backend tidak melewati batas waktu permintaan HTTP.

    `keywords` memungkinkan backend mengirim kata kunci berbeda per marketplace
    (kolom `search_keyword` di `marketplace_sources`); tanpa itu dipakai
    judul + penulis.
    """
    semaphore = asyncio.Semaphore(settings.CONCURRENCY)
    start_time = time.monotonic()

    async def run(scraper: BaseMarketplaceScraper) -> tuple[str, ScrapedItem | None, str | None]:
        query = (keywords or {}).get(scraper.marketplace) or title
        # `search_keyword` dari backend sudah berisi judul + penulis. Bila kata
        # kunci itu ditambal dengan judul (mis. keyword lama hanya berisi judul),
        # penulis tetap terkirim; bila sudah memuat penulis, jangan dikirim lagi
        # karena setiap scraper akan menambahkannya sekali lagi ke query.
        scraper_author = None if author_in_keyword(query, author) else author

        async def _no_slot() -> tuple[str, ScrapedItem | None, str | None]:
            async with browser_manager.new_page() as page:
                candidates = await scraper.search_offers(
                    page, query, scraper_author, match_title=title
                )
            if not candidates:
                return (
                    scraper.marketplace,
                    None,
                    f"{scraper.label}: tidak ada penawaran.",
                )
            best = select_best_offer(candidates, title, author)
            if best is not None:
                return scraper.marketplace, best, None
            return (
                scraper.marketplace,
                None,
                f"{scraper.label}: tidak ada penawaran yang cocok dengan judul.",
            )

        # Sisa waktu dihitung **setelah** slot didapat: scraper yang mengantre
        # lama sudah kehilangan waktu itu. Batas atas `deadline_seconds` tetap
        # berlaku untuk seluruh run agar satu scraper tidak menahan yang lain.
        async def _bounded() -> tuple[str, ScrapedItem | None, str | None]:
            async with semaphore:
                remaining = max(1.0, deadline_seconds - (time.monotonic() - start_time))
                return await asyncio.wait_for(_no_slot(), timeout=remaining)

        try:
            return await asyncio.wait_for(
                _bounded(), timeout=deadline_seconds + 1.0
            )
        except asyncio.TimeoutError:
            logger.warning(f"  -> Timeout pada {scraper.label} untuk '{title}' (>{deadline_seconds:.0f}s)")
            return scraper.marketplace, None, f"{scraper.label} tidak bisa diakses (melewati batas waktu)."
        except ScraperUnavailable as exc:
            logger.warning(f"  -> Tidak tersedia {scraper.label} untuk '{title}': {exc}")
            return scraper.marketplace, None, str(exc)
        except Exception as exc:  # noqa: BLE001 - satu marketplace gagal bukan fatal
            logger.error(f"  -> Gagal pada {scraper.label} untuk '{title}': {exc}")
            return scraper.marketplace, None, f"{scraper.label} gagal diakses."

    offers: dict[str, ScrapedItem] = {}
    failures: dict[str, str] = {}
    outcomes = await asyncio.gather(*(run(scraper) for scraper in SCRAPERS))
    for slug, item, failure in outcomes:
        if item is not None:
            offers[slug] = item
        elif failure is not None:
            failures[slug] = failure

    return BookScrapeResult(offers=offers, failures=failures)


async def process_single_book(book: dict[str, Any]) -> int:
    """Scrape satu buku lalu simpan tiap penawaran sebagai snapshot baru."""
    book_id = book["id"]
    title = book["title"]

    logger.info(f"=== [Mulai] Scraping buku: '{title}' (ID: {book_id}) ===")
    result = await scrape_book_offers(title, book.get("author"))
    for message in result.failures.values():
        logger.warning(f"  -> {message}")

    saved_slugs: set[str] = set()
    for slug, item in result.offers.items():
        if await _save_item(book_id, item):
            saved_slugs.add(slug)

    missing = sorted(set(MARKETPLACE_SLUGS) - saved_slugs)
    logger.info(
        f"=== [Selesai] '{title}': {len(saved_slugs)}/{len(MARKETPLACE_SLUGS)} "
        f"penawaran tersimpan ({', '.join(sorted(saved_slugs)) or '-'})"
        + (f"; tanpa penawaran: {', '.join(missing)}" if missing else "")
        + " ===\n"
    )
    return len(saved_slugs)


async def _save_item(book_id: Any, item: ScrapedItem) -> bool:
    """Simpan satu penawaran ke DB; kembalikan True bila tersimpan.

    Kegagalan satu penawaran (mis. constraint DB) hanya menggugurkan penawaran
    itu, bukan seluruh run — sebelumnya satu baris ditolak membatalkan semua.
    """
    try:
        async with get_db_session() as session:
            await save_marketplace_price(session, item.to_dict(book_id))
    except Exception as exc:  # noqa: BLE001 - satu baris gagal bukan fatal
        logger.error(f"  -> Gagal simpan {item.marketplace.title()} ke DB: {exc}")
        return False
    logger.info(
        f"  -> Disimpan ke DB: {item.marketplace.title()} - "
        f"Rp {item.price:,.0f} ({item.title[:60]}, score {item.match_score:.2f})"
    )
    return True


async def run_scrape_pipeline() -> dict[str, Any]:
    """Jalankan siklus lengkap scraping untuk seluruh buku."""
    start_time = time.monotonic()
    logger.info("Memulai pipeline cron scraping harga buku...")

    # Nyalakan browser Playwright
    await browser_manager.start()

    total_quotes = 0
    books_processed = 0

    try:
        async with get_db_session() as session:
            books = await fetch_books_to_scrape(session, limit=settings.MAX_BOOKS_PER_RUN)

        if not books:
            logger.warning("Tidak ada buku yang ditemukan di database untuk di-scrape.")
            return {"books": 0, "quotes": 0, "duration": 0}

        logger.info(f"Ditemukan {len(books)} buku untuk diproses.")

        for book in books:
            saved = await process_single_book(book)
            total_quotes += saved
            books_processed += 1

            # Jeda antar buku
            inter_book_delay = random.uniform(settings.DELAY_MIN_SECONDS * 1.5, settings.DELAY_MAX_SECONDS * 2)
            await asyncio.sleep(inter_book_delay)

    finally:
        # Selalu tutup browser setelah pipeline selesai
        await browser_manager.close()

    elapsed = round(time.monotonic() - start_time, 2)
    logger.info(
        f"Pipeline selesai dalam {elapsed}s: "
        f"{books_processed} buku diproses, {total_quotes} snapshot harga baru disimpan ke Supabase."
    )

    return {
        "books_processed": books_processed,
        "quotes_saved": total_quotes,
        "duration_seconds": elapsed,
    }
