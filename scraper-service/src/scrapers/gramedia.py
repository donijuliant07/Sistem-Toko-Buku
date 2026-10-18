"""Scraper untuk Gramedia.com (toko buku ritel).

Gramedia adalah toko buku dedicated — halaman hasil pencarian relatif bersih
dari produk non-buku dan tidak punya anti-bot agresif. Namun selectornya bisa
berubah antar deploy karena memakai Next.js.

Strategi ekstraksi:
1. Selector primer: ``a[href*="/products/"]`` yang mengandung harga Rp,
   dengan filter ketat untuk menyaring link navigasi (kategori/brand/author).
2. Fallback: elemen ``[class*="product"]`` atau ``article`` yang mengandung harga.

Scroll pendek setelah load diperlukan karena Gramedia memakai IntersectionObserver
untuk lazy-load kartu produk di bawah fold.
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

_PRICE_LINE = re.compile(r"^Rp\s?[\d.,]+$")

#: Fragmen URL yang menandakan link navigasi bukan produk.
_NAV_FRAGMENTS = ("/categories/", "/brands/", "/author/", "/search", "/tag/", "#")

_EXTRACT_SCRIPT = """() => {
    const results = [];
    const seen = new Set();

    // Selector primer: link langsung ke halaman produk.
    const productLinks = document.querySelectorAll(
        'a[href*="/products/"], [class*="ProductCard"] a, [class*="product-card"] a'
    );
    for (const a of productLinks) {
        const href = a.href || '';
        if (!href || seen.has(href)) continue;
        // Filter link navigasi (kategori, brand, author, dsb).
        if (/\\/(categories|brands|author|tag|search)\\//i.test(href)) continue;
        if (href.includes('#')) continue;
        // Harus mengandung harga Rp.
        const text = (a.innerText || '').trim();
        if (!text || !/Rp[\\s\\d.,]+/.test(text)) continue;
        seen.add(href);
        results.push({ text, url: href });
        if (results.length >= 20) break;
    }
    if (results.length > 0) return results;

    // Fallback: elemen card yang lebih lebar.
    const cards = document.querySelectorAll(
        '[class*="product"], [class*="Product"], article'
    );
    for (const card of cards) {
        const text = (card.innerText || '').trim();
        if (!text || !/Rp[\\s\\d.,]+/.test(text)) continue;
        const link = card.querySelector('a[href*="gramedia.com"]');
        if (!link || seen.has(link.href)) continue;
        if (/\\/(categories|brands|author|tag|search)\\//i.test(link.href)) continue;
        seen.add(link.href);
        results.push({ text, url: link.href });
        if (results.length >= 20) break;
    }
    return results;
}"""


def parse_card_text(text: str) -> dict[str, str | None]:
    """Pisahkan teks kartu Gramedia menjadi judul, harga, dan penjual/penulis."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    price_idx = next((i for i, line in enumerate(lines) if _PRICE_LINE.match(line)), None)
    title_lines: list[str] = []
    if price_idx is not None:
        for line in lines[:price_idx]:
            if re.match(r"^\d+(?:\.\d)?$", line):
                continue
            if re.search(r"terjual", line, re.I):
                continue
            if line.upper() in {"ID", "N/A"}:
                continue
            if re.match(r"^(PreOrder|Promo|Ready Stock)$", line, re.I):
                continue
            title_lines.append(line)
    title = " ".join(title_lines) if title_lines else " ".join(lines[:1])

    price: str | None = None
    if price_idx is not None:
        price = lines[price_idx]

    # Gramedia adalah toko tunggal — tidak ada penjual per kartu. Baris sebelum
    # harga adalah nama *penulis* (mis. "Peter Thiel"), bukan toko, sehingga
    # tidak dipakai sebagai `seller_name`.
    return {"title": title or None, "price": price, "seller": "Gramedia"}


class GramediaScraper(BaseMarketplaceScraper):
    marketplace = "gramedia"
    label = "Gramedia"

    async def search_offers(
        self,
        page: Page,
        title: str,
        author: str | None = None,
        *,
        match_title: str | None = None,
    ) -> list[ScrapedItem]:
        offers: list[ScrapedItem] = []
        for query in self._query_variants(title, author):
            offers = await self._search_once(page, query, match_title or title)
            # Tokopedia butuh variasi karena query panjang; Gramedia cukup satu
            # percobaan yang menghasilkan kartu — variasi berikutnya hanya dipakai
            # bila hasil pertama kosong.
            if offers:
                break
        if not offers:
            logger.warning(f"[Gramedia] Tidak ada produk relevan untuk '{title}'")
        return offers

    @staticmethod
    def _query_variants(title: str, author: str | None) -> list[str]:
        """Kata kunci yang dicoba berurutan.

        Gramedia membalas halaman kosong (yang tampil hanya rekomendasi) untuk
        kata kunci yang memuat ``&`` — mis. hasil penyemaian
        "Judul Penulis & Penulis Lain". Bentuk tanpa ``&`` menghasilkan produk
        yang benar, jadi bentuk itu dicoba bila bentuk aslinya tidak menghasilkan
        kartu. Kata kunci tanpa ``&`` tidak perlu variasi: satu muat halaman
        sudah menghabiskan sebagian besar deadline 18 detik.
        """
        utama = marketplace_search_query(title, author)
        if "&" not in utama:
            return [utama]
        # Potong di "&": "Zero to One Peter Thiel & Blake Masters" dijawab kosong,
        # sedangkan "Zero to One Peter Thiel" mengembalikan produk yang benar.
        sebelum_amp = " ".join(utama.split("&")[0].split())
        return [utama, sebelum_amp] if sebelum_amp and sebelum_amp != utama else [utama]

    async def _search_once(
        self, page: Page, query: str, target_title: str
    ) -> list[ScrapedItem]:
        search_url = f"https://www.gramedia.com/search?q={quote_plus(query)}"
        logger.info(f"[Gramedia] Mencari: {query}")

        try:
            response = await page.goto(search_url, wait_until="domcontentloaded")
            if response is not None and response.status >= 400:
                logger.info(f"[Gramedia] HTTP {response.status} untuk '{query}'")
                return []
        except PlaywrightTimeoutError as exc:
            raise ScraperUnavailable("Gramedia tidak bisa diakses (melewati batas waktu).") from exc
        except Exception as exc:  # noqa: BLE001
            raise ScraperUnavailable(f"Gramedia gagal diakses ({exc}).") from exc

        # Periksa halaman kosong/tidak ada hasil.
        #
        # Jangan mencari "tidak ditemukan" di seluruh HTML: teks itu selalu ada
        # di payload i18n Next.js ("kategori tidak ditemukan", "toko tidak
        # ditemukan") sehingga halaman yang penuh hasil pun ikut dianggap kosong.
        # Yang diperiksa hanya teks tampilan, dengan pola ringkasan hasil.
        try:
            body_text = (await page.evaluate(
                "() => document.body ? document.body.innerText : ''"
            )).lower()
            if re.search(r"hasil pencarian\D{0,40}s?\s*tidak ditemukan|menampilkan 0 dari", body_text):
                logger.info(f"[Gramedia] Tidak ada hasil untuk '{query}'")
                return []
        except Exception:  # noqa: BLE001
            pass

        # Scroll pendek untuk trigger lazy-load kartu produk.
        try:
            await page.evaluate("window.scrollBy(0, 400)")
        except Exception:  # noqa: BLE001
            pass

        cards: list[dict] = []
        for attempt in range(2):
            try:
                await page.wait_for_selector(
                    'a[href*="/products/"], [class*="product-card"], [class*="ProductCard"]',
                    timeout=10000 if attempt == 0 else 5000,
                )
            except PlaywrightTimeoutError:
                pass
            cards = await page.evaluate(_EXTRACT_SCRIPT)
            logger.info(f"[Gramedia] {len(cards)} kartu untuk '{query}' (percobaan {attempt + 1})")
            if cards:
                break
            if attempt == 0:
                await page.wait_for_timeout(1500)

        offers: list[ScrapedItem] = []
        for card in cards:
            parsed = parse_card_text(card.get("text") or "")
            if not parsed["title"]:
                continue
            score = calculate_match_score(target_title, parsed["title"])
            price = normalize_price(parsed["price"])
            if not price or score < 0.45:
                continue
            offers.append(
                ScrapedItem(
                    marketplace=self.marketplace,
                    title=parsed["title"],
                    price=price,
                    product_url=card.get("url"),
                    seller_name=parsed["seller"] or "Gramedia",
                    in_stock=True,
                    match_score=score,
                )
            )
        return offers
