"""Scraper untuk Shopee Indonesia."""

import logging
from decimal import Decimal
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

_EXTRACT_SCRIPT = """() => {
    const results = [];
    const items = document.querySelectorAll('li[class*="col-xs-2"], div[data-sqe="item"]');

    for (const item of items) {
        const titleEl = item.querySelector('div[class*="whitespace-normal"], div[data-sqe="name"]');
        const priceEl = item.querySelector('span[class*="truncate"], div[class*="text-base"]');
        const linkEl = item.querySelector('a[href*="-i."]');

        if (titleEl && priceEl) {
            results.push({
                title: titleEl.textContent.trim(),
                price: priceEl.textContent.trim(),
                url: linkEl ? linkEl.href : null,
            });
        }
        if (results.length >= 20) break;
    }
    return results;
}"""


class ShopeeScraper(BaseMarketplaceScraper):
    marketplace = "shopee"
    label = "Shopee"

    async def search_offers(
        self,
        page: Page,
        title: str,
        author: str | None = None,
        *,
        match_title: str | None = None,
    ) -> list[ScrapedItem]:
        query = marketplace_search_query(title, author)
        search_url = f"https://shopee.co.id/search?keyword={quote_plus(query)}"
        logger.info(f"[Shopee] Mencari: {query}")

        try:
            response = await page.goto(search_url, wait_until="domcontentloaded")
            if response is not None and response.status >= 400:
                logger.warning(f"[Shopee] HTTP {response.status} untuk '{title}'")
                raise ScraperUnavailable(f"Shopee: server merespons HTTP {response.status}.")
        except PlaywrightTimeoutError as e:
            logger.warning(f"[Shopee] Timeout membuka {search_url}: {e}")
            raise ScraperUnavailable("Shopee tidak bisa diakses (melewati batas waktu).") from e
        except ScraperUnavailable:
            raise
        except Exception as e:
            logger.warning(f"[Shopee] Gagal membuka {search_url}: {e}")
            raise ScraperUnavailable(f"Shopee gagal diakses ({e}).") from e

        if "/verify/" in page.url or "captcha" in page.url or "buyer/login" in page.url:
            logger.warning(
                f"[Shopee] Dialihkan ke halaman verifikasi ({page.url}); "
                "Shopee mewajibkan login untuk pencarian."
            )
            raise ScraperUnavailable("Shopee: pencarian dialihkan ke verifikasi/login.")

        try:
            await page.wait_for_selector('li[class*="col-xs-2"], div[data-sqe="item"]', timeout=3000)
        except PlaywrightTimeoutError:
            pass

        if "/verify/" in page.url or "captcha" in page.url or "buyer/login" in page.url:
            raise ScraperUnavailable("Shopee: pencarian dialihkan ke verifikasi/login.")

        items_data = await page.evaluate(_EXTRACT_SCRIPT)
        logger.info(f"[Shopee] {len(items_data)} kartu ditemukan untuk '{title}'")

        offers: list[ScrapedItem] = []
        for item in items_data:
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
            logger.warning(f"[Shopee] Tidak ada produk relevan untuk '{title}'")
        return offers
