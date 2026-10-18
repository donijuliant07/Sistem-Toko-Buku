"""Scraper untuk Periplus.com (toko buku ritel).

Periplus adalah toko buku ritel internasional di Indonesia — halaman produknya
relatif stabil dan tidak punya anti-bot agresif. Namun beberapa hal perlu
diperhatikan:

- ``wait_until="networkidle"`` sangat lambat (10–15 detik); diganti ke
  ``domcontentloaded`` agar konsisten dengan scraper lain.
- Halaman Periplus sering memuat JS berat untuk search suggestions; scroll
  pendek setelah load memastikan kartu produk di bawah fold sudah muncul.
- ``/p/`` dipakai sebagai penanda URL produk; ``/c/`` adalah kategori.

Filter teks: harus ada judul (minimal beberapa karakter non-angka sebelum
harga) dan harga dalam format Rupiah.
"""

import logging
import re
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
    const seen = new Set();

    // Selector primer: link produk dengan /p/ di URL.
    for (const a of document.querySelectorAll('a[href*="/p/"]')) {
        let href = a.href || '';
        if (!href || seen.has(href)) continue;
        // Filter: bukan link kategori /c/ atau /search.
        if (/\\/(c|search|category)\\//.test(href)) continue;
        const text = (a.innerText || '').replace(/\\s+/g, ' ').trim();
        if (!text || text.includes('Filter Your Search')) continue;
        if (!/Rp[\\s\\d.,]+/.test(text)) continue;
        // Judul harus ada: setidaknya 3 karakter non-angka sebelum harga.
        const beforePrice = text.split(/Rp[\\s\\d.,]/)[0].trim();
        if (beforePrice.replace(/[\\d\\s.,]/g, '').length < 3) continue;
        seen.add(href);
        // Normalise ke https.
        if (href.startsWith('http://')) href = 'https://' + href.slice(7);
        results.push({ text, url: href });
        if (results.length >= 20) break;
    }
    if (results.length > 0) return results;

    // Fallback: elemen card produk yang lebih lebar.
    const cards = document.querySelectorAll(
        '[class*="product-item"], [class*="ProductItem"], ' +
        'li[class*="product"], div[class*="product-card"]'
    );
    for (const card of cards) {
        const text = (card.innerText || '').replace(/\\s+/g, ' ').trim();
        if (!text || !/Rp[\\s\\d.,]+/.test(text)) continue;
        const link = card.querySelector('a[href*="/p/"]');
        if (!link || seen.has(link.href)) continue;
        seen.add(link.href);
        results.push({ text, url: link.href });
        if (results.length >= 20) break;
    }
    return results;
}"""

_FORMAT_SPLIT = re.compile(r"\s+(Paperback|Hardcover|Mass Market Paperbound|Boxed Set)\b", re.I)
_PRICE_RE = re.compile(r"Rp\s?[\d.,]+")

#: Kata kunci yang menandakan halaman tidak ada hasil.
_EMPTY_SIGNALS = ("no product that matches", "not found", "0 product", "tidak tersedia", "no results")


def parse_card_text(text: str) -> dict[str, str | None]:
    """Pisahkan teks kartu Periplus menjadi judul dan harga (ambil harga promo bila ada)."""
    cleaned = re.sub(r"\s*Buy Now\s*", " ", text, flags=re.I)
    cleaned = re.sub(r"^[-\d.%]+\s*", "", cleaned).strip()
    prices = _PRICE_RE.findall(cleaned)
    price_raw = prices[-1] if prices else None

    title_part = _FORMAT_SPLIT.split(cleaned, maxsplit=1)[0]
    title_part = re.split(r"\s+Rp\s?", title_part)[0].strip()
    title = re.sub(r"\s+", " ", title_part).strip(" -") or None
    return {"title": title, "price": price_raw, "seller": "Periplus"}


class PeriplusScraper(BaseMarketplaceScraper):
    marketplace = "periplus"
    label = "Periplus"

    async def search_offers(
        self,
        page: Page,
        title: str,
        author: str | None = None,
        *,
        match_title: str | None = None,
    ) -> list[ScrapedItem]:
        query = marketplace_search_query(title, author)
        search_url = (
            "https://www.periplus.com/product/Search"
            f"?filter_category_id=0&filter_name={quote_plus(query)}"
            "&is_suggestion_click=0&suggestion_doc_id=&suggestion_type="
        )
        logger.info(f"[Periplus] Mencari: {query}")

        try:
            # domcontentloaded jauh lebih cepat dari networkidle (yang bisa
            # menunggu 10+ detik untuk request JS non-esensial selesai).
            response = await page.goto(search_url, wait_until="domcontentloaded")
            if response is not None and response.status >= 400:
                raise ScraperUnavailable(f"Periplus: server merespons HTTP {response.status}.")
        except PlaywrightTimeoutError as exc:
            raise ScraperUnavailable("Periplus tidak bisa diakses (melewati batas waktu).") from exc
        except ScraperUnavailable:
            raise
        except Exception as exc:
            raise ScraperUnavailable(f"Periplus gagal diakses ({exc}).") from exc

        # Periksa halaman kosong.
        try:
            html_lower = (await page.content()).lower()
            if any(kw in html_lower for kw in _EMPTY_SIGNALS):
                logger.info(f"[Periplus] Tidak ada hasil untuk '{query}'")
                return []
        except Exception:  # noqa: BLE001
            pass

        # Scroll pendek untuk trigger lazy-load kartu produk di bawah fold.
        try:
            await page.evaluate("window.scrollBy(0, 400)")
        except Exception:  # noqa: BLE001
            pass

        cards: list[dict] = []
        for attempt in range(2):
            try:
                await page.wait_for_selector(
                    'a[href*="/p/"], [class*="product-item"], [class*="ProductItem"]',
                    timeout=10000 if attempt == 0 else 5000,
                )
            except PlaywrightTimeoutError:
                pass
            cards = await page.evaluate(_EXTRACT_SCRIPT)
            logger.info(f"[Periplus] {len(cards)} kartu untuk '{title}' (percobaan {attempt + 1})")
            if cards:
                break
            if attempt == 0:
                await page.wait_for_timeout(1500)

        offers: list[ScrapedItem] = []
        for card in cards:
            parsed = parse_card_text(card.get("text") or "")
            if not parsed["title"]:
                continue
            score = calculate_match_score(match_title or title, parsed["title"])
            price = normalize_price(parsed["price"])
            if not price or score < 0.45:
                continue
            offers.append(
                ScrapedItem(
                    marketplace=self.marketplace,
                    title=parsed["title"],
                    price=price,
                    product_url=card.get("url"),
                    seller_name=parsed["seller"],
                    in_stock=True,
                    match_score=score,
                )
            )

        if not offers:
            logger.warning(f"[Periplus] Tidak ada produk relevan untuk '{title}'")
        return offers
