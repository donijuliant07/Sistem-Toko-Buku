"""Scraper untuk Lazada Indonesia.

Lazada sering mengganti nama class CSS-nya, sehingga selector berbasis class
tidak stabil. Strategi ekstraksi yang dipakai berlapis tiga:

1. Selector data-qa-locator (paling stabil, berbasis QA attribute).
2. Selector class-fragment umum yang jarang berubah.
3. Fallback via tautan produk: setiap ``<a href*="lazada.co.id/products/">``
   dicari harga di parent-tree-nya.

Lazada juga kadang menampilkan CAPTCHA atau halaman verifikasi — kondisi ini
dideteksi dari URL dan dilempar sebagai ``ScraperUnavailable`` segera.
"""

import logging
from urllib.parse import quote_plus

from playwright.async_api import Page
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from src.scrapers.base import (
    BaseMarketplaceScraper,
    ScrapedItem,
    ScraperUnavailable,
    calculate_match_score,
    marketplace_search_query,
    normalize_price,
)

logger = logging.getLogger(__name__)

#: Penanda URL yang berarti Lazada menyuruh kita verifikasi / CAPTCHA.
_BLOCK_SIGNALS = ("captcha", "/verify", "/blocked", "/challenge", "bot-check")

_EXTRACT_SCRIPT = """() => {
    function tryExtract(selector) {
        const cards = document.querySelectorAll(selector);
        const results = [];
        for (const card of cards) {
            // Cari harga — coba beberapa variasi class harga Lazada.
            let price = '';
            const priceEls = card.querySelectorAll(
                '[class*="ooOxS"], [class*="price"], [class*="Price"], ' +
                '[data-qa-locator="product-price"] span, span[class*="currency"]'
            );
            for (const el of priceEls) {
                const t = el.textContent.trim();
                if (/^Rp[\\s\\d.,]+/.test(t) && t.length < 25) { price = t; break; }
            }
            if (!price) continue;

            // Cari judul.
            const titleEl = card.querySelector(
                '[class*="RfADt"] a, a[title], [class*="title"] a, ' +
                '[data-qa-locator="product-name"] a, [class*="name"] a'
            );
            if (!titleEl) continue;
            const title = (titleEl.getAttribute('title') || titleEl.textContent).trim();
            if (!title || title.length < 3) continue;

            // Cari URL produk.
            const linkEl = card.querySelector('a[href*="lazada"]');
            const url = linkEl ? linkEl.href : '';

            // Cari nama toko.
            const sellerEl = card.querySelector(
                '[class*="seller"], [class*="shop"], [class*="store"], ' +
                '[data-qa-locator="seller-name"]'
            );
            const seller = sellerEl ? sellerEl.textContent.trim() : null;

            results.push({ title, price, url, seller });
            if (results.length >= 20) break;
        }
        return results;
    }

    // Selector primer (paling stabil).
    let r = tryExtract('div[data-qa-locator="product-item"]');
    if (r.length > 0) return r;

    // Fallback 1 — class container umum.
    r = tryExtract('div[class*="Bm3ON"]');
    if (r.length > 0) return r;

    r = tryExtract('div[class*="_17mcb"]');
    if (r.length > 0) return r;

    // Fallback 2 — via tautan produk langsung.
    const links = document.querySelectorAll('a[href*="lazada.co.id/products/"]');
    const seen = new Set();
    const results = [];
    for (const link of links) {
        const href = link.href;
        if (!href || seen.has(href)) continue;
        seen.add(href);
        const rawTitle = (link.getAttribute('title') || link.textContent).trim();
        if (!rawTitle || rawTitle.length < 3) continue;

        // Cari harga di parent-tree (maks 6 level).
        let parent = link.parentElement;
        let price = '';
        for (let i = 0; i < 6 && parent; i++) {
            const m = parent.textContent.match(/Rp[\\s\\d.,]+/);
            if (m && m[0].length < 25) { price = m[0].trim(); break; }
            parent = parent.parentElement;
        }
        if (!price) continue;

        results.push({ title: rawTitle, price, url: href, seller: null });
        if (results.length >= 20) break;
    }
    return results;
}"""


class LazadaScraper(BaseMarketplaceScraper):
    marketplace = "lazada"
    label = "Lazada"

    async def search_offers(
        self,
        page: Page,
        title: str,
        author: str | None = None,
        *,
        match_title: str | None = None,
    ) -> list[ScrapedItem]:
        query = marketplace_search_query(title, author)
        search_url = f"https://www.lazada.co.id/catalog/?q={quote_plus(query)}&page=1"
        logger.info(f"[Lazada] Mencari: {query}")

        try:
            response = await page.goto(search_url, wait_until="domcontentloaded")
            if response is not None and response.status >= 400:
                logger.warning(f"[Lazada] HTTP {response.status} untuk '{title}'")
                raise ScraperUnavailable(f"Lazada: server merespons HTTP {response.status}.")
        except PlaywrightTimeoutError as e:
            logger.warning(f"[Lazada] Timeout membuka {search_url}: {e}")
            raise ScraperUnavailable("Lazada tidak bisa diakses (melewati batas waktu).") from e
        except ScraperUnavailable:
            raise
        except Exception as e:
            logger.warning(f"[Lazada] Gagal membuka {search_url}: {e}")
            raise ScraperUnavailable(f"Lazada gagal diakses ({e}).") from e

        # Deteksi dini CAPTCHA / halaman verifikasi.
        current_url = page.url.lower()
        if any(sig in current_url for sig in _BLOCK_SIGNALS):
            logger.warning(f"[Lazada] Dialihkan ke halaman challenge: {page.url}")
            raise ScraperUnavailable("Lazada: pencarian dialihkan ke halaman verifikasi/CAPTCHA.")

        # Scroll pendek untuk trigger lazy-load produk yang mungkin belum muncul.
        try:
            await page.evaluate("window.scrollBy(0, 300)")
        except Exception:  # noqa: BLE001
            pass

        cards: list[dict] = []
        for attempt in range(2):
            try:
                await page.wait_for_selector(
                    'div[data-qa-locator="product-item"], div[class*="Bm3ON"], div[class*="_17mcb"]',
                    timeout=8000 if attempt == 0 else 4000,
                )
            except PlaywrightTimeoutError:
                pass

            # Periksa ulang CAPTCHA setelah tunggu (bisa muncul setelah JS jalan).
            if any(sig in page.url.lower() for sig in _BLOCK_SIGNALS):
                raise ScraperUnavailable("Lazada: pencarian dialihkan ke halaman verifikasi/CAPTCHA.")

            cards = await page.evaluate(_EXTRACT_SCRIPT)
            logger.info(
                f"[Lazada] {len(cards)} kartu ditemukan untuk '{title}' "
                f"(percobaan {attempt + 1})"
            )
            if cards:
                break
            if attempt == 0:
                await page.wait_for_timeout(2000)

        offers: list[ScrapedItem] = []
        for item in cards:
            score = calculate_match_score(match_title or title, item.get("title") or "")
            price = normalize_price(item.get("price"))
            if not price or score < 0.45:
                continue
            offers.append(
                ScrapedItem(
                    marketplace=self.marketplace,
                    title=item["title"],
                    price=price,
                    product_url=item.get("url"),
                    seller_name=item.get("seller"),
                    in_stock=True,
                    match_score=score,
                )
            )

        if not offers:
            logger.warning(f"[Lazada] Tidak ada produk relevan untuk '{title}'")
        return offers
