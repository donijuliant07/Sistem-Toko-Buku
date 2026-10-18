"""Scraper untuk Blibli.

Dua alamat pencarian Blibli, dan hanya satu yang bisa dibuka browser biasa:

- ``/jual/<kata kunci>`` dijawab HTTP 403 + halaman challenge "verifikasi sedang
  berjalan";
- ``/cari/<kata kunci>`` menjawab 200 dan merender kartu produk.

Kata kunci dikirim dengan spasi di-encode sebagai ``%20`` (bukan ``+``); bentuk
``+`` dikembalikan tanpa kartu sama sekali.

Teks satu kartu berbentuk:

    [Ad|Baru?]
    <judul>
    Rp<harga>            (harga setelah diskon)
    <harga coret>?  <diskon>%?
    <estimasi kirim>?
    <rating?>           (mis. "4,9 rating seller", "5")
    Terjual <n>?
    <toko>?
    <kota>

Karena baris rating/kirim/toko tidak selalu ada, judul diambil dari baris-baris
sebelum baris harga pertama, dan toko dari baris tepat sebelum kota (baris
terakhir).

Selector HTML Blibli juga tidak stabil; ekstraksi memakai selector berlapis
dengan fallback ke pencarian via tag ``<a>`` agar tetap berfungsi bila class
berubah.
"""

import logging
import re
from urllib.parse import quote

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

#: Baris harga, mis. "Rp40.000" atau "Rp 1.250.000".
_PRICE_LINE = re.compile(r"^Rp\s?[\d.,]+$")
#: Baris diskon ("20%") — selalu mengikuti harga coret.
_DISCOUNT_LINE = re.compile(r"^\d{1,2}%$")
#: Baris rating penjual, mis. "4,9 rating seller" atau "5".
_RATING_LINE = re.compile(r"^(?:\d(?:[.,]\d)?|[\d.,]+ rating seller|\d[,.]\d rating|5)$")
#: Baris jumlah terjual, mis. "Terjual 1" / "Terjual 1,2 rb".
_SOLD_LINE = re.compile(r"^Terjual\s+[\d.,]+\s*(?:rb|jt)?$", re.IGNORECASE)
#: Label di awal judul yang bukan bagian judul.
_LABEL_LINE = re.compile(r"^(PreOrder|Promo|Ready Stock)$", re.IGNORECASE)

#: Sinyal URL yang menandakan Blibli menolak/challenge.
_BLOCK_SIGNALS = ("/403", "/error", "challenge", "verify", "captcha", "bot-check")

_EXTRACT_SCRIPT = """() => {
    function extract(selector) {
        const cards = document.querySelectorAll(selector);
        const results = [];
        for (const card of cards) {
            const text = (card.innerText || '').trim();
            // Harus ada harga Rp di teks kartu.
            if (!text || !/Rp/i.test(text)) continue;
            const link = card.querySelector('a[href*="/p/"], a[href*="blibli.com"]');
            results.push({ text, url: link ? link.href : null });
            if (results.length >= 20) break;
        }
        return results;
    }

    // Selector primer (class stabil Blibli).
    let r = extract('div.elf-product-card__container');
    if (r.length > 0) return r;

    // Fallback 1 — selector class yang lebih generik.
    r = extract('div[class*="product-card"]');
    if (r.length > 0) return r;

    // Fallback 2 — element article produk.
    r = extract('article[class*="product"]');
    if (r.length > 0) return r;

    // Fallback 3 — ambil via link produk Blibli langsung.
    const links = document.querySelectorAll('a[href*="blibli.com/p/"]');
    const seen = new Set();
    const results = [];
    for (const link of links) {
        const href = link.href;
        if (!href || seen.has(href)) continue;
        seen.add(href);
        // Ambil teks dari parent yang memuat harga.
        let parent = link.parentElement;
        let cardText = '';
        for (let i = 0; i < 5 && parent; i++) {
            if (/Rp[\\s\\d.,]+/.test(parent.textContent)) {
                cardText = (parent.innerText || '').trim();
                break;
            }
            parent = parent.parentElement;
        }
        if (!cardText) continue;
        results.push({ text: cardText, url: href });
        if (results.length >= 20) break;
    }
    return results;
}"""


def parse_card_text(text: str) -> dict[str, str | None]:
    """Pisahkan teks kartu Blibli menjadi judul, harga, dan nama toko."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    prices = [i for i, line in enumerate(lines) if _PRICE_LINE.match(line)]
    if not prices:
        return {"title": None, "price": None, "seller": None, "in_stock": True}

    price_idx = prices[0]
    title_lines = [
        line
        for line in lines[:price_idx]
        if not _LABEL_LINE.match(line) and line.lower() != "ad"
    ]
    seller = None
    if len(lines) > 1:
        candidate = lines[-2]
        if (
            candidate != lines[prices[-1]]
            and not _RATING_LINE.match(candidate)
            and not _SOLD_LINE.match(candidate)
            and not _DISCOUNT_LINE.match(candidate)
        ):
            seller = candidate

    title = " ".join(title_lines) or None
    # Kartu barang habis diawali "Stok habis" sebelum judul.
    in_stock = not any(line.lower().startswith("stok habis") for line in lines)
    if title:
        title = re.sub(r"^Stok habis\s+", "", title, flags=re.IGNORECASE)
    return {
        "title": title,
        "price": lines[price_idx],
        "seller": seller,
        "in_stock": in_stock,
    }


class BlibliScraper(BaseMarketplaceScraper):
    marketplace = "blibli"
    label = "Blibli"

    async def search_offers(
        self,
        page: Page,
        title: str,
        author: str | None = None,
        *,
        match_title: str | None = None,
    ) -> list[ScrapedItem]:
        query = marketplace_search_query(title, author)
        search_url = f"https://www.blibli.com/cari/{quote(query, safe='')}"
        logger.info(f"[Blibli] Mencari: {query}")

        try:
            response = await page.goto(search_url, wait_until="domcontentloaded")
            if response is not None and response.status >= 400:
                logger.warning(f"[Blibli] HTTP {response.status} untuk '{query}'")
                raise ScraperUnavailable(f"Blibli: server merespons HTTP {response.status}.")
        except PlaywrightTimeoutError as e:
            logger.warning(f"[Blibli] Timeout membuka {search_url}: {e}")
            raise ScraperUnavailable("Blibli tidak bisa diakses (melewati batas waktu).") from e
        except ScraperUnavailable:
            raise
        except Exception as e:
            logger.warning(f"[Blibli] Gagal membuka {search_url}: {e}")
            raise ScraperUnavailable(f"Blibli gagal diakses ({e}).") from e

        # Deteksi halaman challenge/block.
        current_url = page.url.lower()
        if any(sig in current_url for sig in _BLOCK_SIGNALS):
            logger.warning(f"[Blibli] Dialihkan ke halaman block: {page.url}")
            raise ScraperUnavailable("Blibli: halaman diblokir atau dialihkan ke verifikasi.")

        # Scroll pendek untuk trigger lazy-load.
        try:
            await page.evaluate("window.scrollBy(0, 300)")
        except Exception:  # noqa: BLE001
            pass

        cards: list[dict] = []
        for attempt in range(2):
            try:
                await page.wait_for_selector(
                    "div.elf-product-card__container, div[class*=\"product-card\"]",
                    timeout=8000 if attempt == 0 else 4000,
                )
            except PlaywrightTimeoutError:
                pass

            if any(sig in page.url.lower() for sig in _BLOCK_SIGNALS):
                raise ScraperUnavailable("Blibli: halaman diblokir atau dialihkan ke verifikasi.")

            cards = await page.evaluate(_EXTRACT_SCRIPT)
            logger.info(f"[Blibli] {len(cards)} kartu untuk '{query}' (percobaan {attempt + 1})")
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
                    in_stock=parsed["in_stock"],
                    match_score=score,
                )
            )

        if not offers:
            logger.warning(f"[Blibli] Tidak ada produk relevan untuk '{title}'")
        return offers
