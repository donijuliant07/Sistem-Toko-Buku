"""Scraper untuk Tokopedia.

Halaman hasil pencarian Tokopedia (Next.js) dinamis: selector dan atribut
sering berganti setiap deploy. Strategi yang dipakai:

1. Coba selector utama `a[href*="extParam"]` (parameter pelacakan, stabil
   lintas versi karena dikirim ke analytics).
2. Bila tidak ada, coba selector cadangan berdasarkan struktur data produk
   (`[data-testid*="product"]`, `[class*="pcv3"]`).
3. Ekstrak teks tiap kartu lalu urai baris-per-baris: harga, judul, dan toko.
"""

import logging
import re
import time
from urllib.parse import quote_plus

from playwright.async_api import Page
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from src.scrapers.base import (
    BaseMarketplaceScraper,
    ScrapedItem,
    ScraperUnavailable,
    author_in_keyword,
    calculate_match_score,
    normalize_price,
)

logger = logging.getLogger(__name__)

#: Jatah per variasi query. Satu `goto` ke Tokopedia butuh 4-6 dtk, dan halaman
#: "produk nggak ditemukan" baru terbaca setelah render selesai. Lebih kecil
#: dari ini variasi pasti timeout tanpa sempat membaca apa pun.
VARIANT_TIMEOUT_SECONDS = 8.0
#: Batas total variasi yang dicoba, agar satu scraper tidak menghabiskan
#: deadline seluruh buku.
MAX_VARIANTS_PER_SEARCH = 2

#: Baris teks kartu yang berupa harga, mis. "Rp185.220" atau "Rp 1.250.000".
_PRICE_LINE = re.compile(r"^Rp\s?[\d.,]+$")

#: Label promo/iklan di awal kartu yang bukan bagian judul. Persentase diskon
#: ("34%") ikut dibuang: baris itu muncul sebelum harga dan ikut terbaca
#: sebagai judul.
_PROMO_LABEL = re.compile(
    r"^(\d{1,2}%|(?:(?:PreOrder|Promo|Ready\s*Stock|Ad|Iklan|Pilihan|Resmi|Official|"
    r"Cashback|Hemat|Gratis\s*Ongkir|Terlaris|Best\s*Seller)\b))[\s:]*",
    flags=re.IGNORECASE,
)

# Skrip ekstraksi kartu dengan dua selector fallback:
# 1. `a[href*="extParam"]`  — stabil, berbasis parameter analytics Tokopedia.
# 2. `[data-testid*="product-card"]` / `[class*="pcv3"]` — fallback bila
#    Tokopedia mengubah parameter tracking tapi mempertahankan testid/class.
_EXTRACT_SCRIPT = """() => {
    function extractCards(selector) {
        const cards = document.querySelectorAll(selector);
        const results = [];
        for (const card of cards) {
            const text = (card.innerText || '').trim();
            if (!text) continue;
            // Cari link produk terdekat: card itu sendiri bila <a>, atau
            // turunannya yang href-nya mengarah ke halaman produk.
            let url = '';
            if (card.tagName === 'A' && card.href) {
                url = card.href;
            } else {
                const link = card.querySelector('a[href*="tokopedia.com"]');
                if (link) url = link.href;
            }
            results.push({ text, url });
            if (results.length >= 24) break;
        }
        return results;
    }

    // Selector primer: tautan dengan parameter extParam (stabil lintas versi).
    let results = extractCards('a[href*="extParam"]');
    if (results.length > 0) return results;

    // Fallback 1: data-testid yang mengandung "product-card".
    results = extractCards('[data-testid*="product-card"]');
    if (results.length > 0) return results;

    // Fallback 2: kelas lama pcv3 — masih muncul di beberapa variant A/B.
    results = extractCards('[class*="pcv3__container"]');
    if (results.length > 0) return results;

    // Fallback 3: setiap <article> di area konten utama.
    results = extractCards('main article, [data-testid="lstProductGrid"] article');
    return results;
}"""


def parse_card_text(text: str) -> dict[str, str | None]:
    """Pisahkan teks kartu Tokopedia menjadi judul, harga, dan nama toko.

    Kartu biasanya diawali label "PreOrder"/"Promo"/"Ad"; harga pertama
    adalah harga setelah diskon, harga kedua (bila ada) harga coret.

    Pola baris setelah harga adalah
    ``[rating?, terjual?, "Hemat ...?", toko, kabupaten]``: dua baris terakhir
    selalu toko dan lokasi, sedangkan baris rating/terjual di depannya tidak
    selalu ada. Karena itu toko diambil dari posisi -2, bukan posisi tetap dari
    atas.
    """
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    price_idx = next((i for i, line in enumerate(lines) if _PRICE_LINE.match(line)), None)

    if price_idx is not None:
        # Gabung baris sebelum harga sebagai kandidat judul, lalu bersihkan label.
        raw_title = " ".join(lines[:price_idx])
    else:
        # Tidak ada harga sama sekali: ambil baris pertama saja.
        raw_title = " ".join(lines[:1])

    # Buang semua label promo/iklan di awal judul (bisa bertumpuk, mis. "Ad Pilihan").
    title = raw_title
    for _ in range(5):  # maks 5 label bertumpuk
        cleaned = _PROMO_LABEL.sub("", title).strip()
        if cleaned == title:
            break
        title = cleaned

    price: str | None = None
    seller: str | None = None
    if price_idx is not None:
        for line in lines[price_idx:]:
            if _PRICE_LINE.match(line):
                price = line
                break
        # Dua baris terakhir: nama toko dan lokasi. Baris toko harus berada
        # setelah harga agar label di atas judul tidak ikut terbaca.
        if price_idx < len(lines) - 2:
            seller = lines[-2]
    return {"title": title or None, "price": price, "seller": seller}


async def _is_empty_result(page: Page) -> bool:
    """True bila halaman menampilkan pesan "produk nggak ditemukan"."""
    try:
        text = await page.evaluate("() => document.body.innerText")
    except Exception:  # noqa: BLE001 - gagal baca DOM bukan alasan menggagalkan scraper
        return False
    return "produk nggak ditemukan" in (text or "").lower()


def _query_variants(title: str, author: str | None) -> list[str]:
    """Kata kunci Tokopedia yang dicoba berurutan, dari yang paling luas.

    Tokopedia menjawab HTTP 200 berisi "Oops, produk nggak ditemukan" — tanpa
    satu kartu pun — untuk kata kunci yang terlalu panjang, dan mencoba bentuk
    yang gagal tetap menghabiskan satu kali muat halaman penuh. Karena itu urutannya
    dibalik: kata kunci pendek (hampir selalu berisi) dicoba lebih dulu, dan
    bentuk panjang hanya dipakai bila yang pendek tidak menghasilkan apa pun.

    ``title`` di sini bisa berupa kata kunci dari backend ("judul penulis").
    Penulis hanya ditambahkan bila belum termuat di judul; bentuk panjang
    "judul + penulis penuh" hanya dipakai kalau berbeda dari kata kunci itu.
    """
    head = title.split(":")[0].strip()
    variants: list[str] = []
    if head and head != title:
        variants.append(head)
    # Penulis sudah dikirim pipeline hanya jika belum ada di kata kunci.
    if author and head:
        nama_depan = author.split()[0]
        if not author_in_keyword(title, author):
            variants.append(f"{head} {nama_depan}")
    if author and title:
        variants.append(f"{title} {author}")
    variants.append(title)
    seen: list[str] = []
    for variant in variants:
        variant = variant.strip()
        if variant and variant not in seen:
            seen.append(variant)
    return seen[:3]


class TokopediaScraper(BaseMarketplaceScraper):
    marketplace = "tokopedia"
    label = "Tokopedia"

    async def search_offers(
        self,
        page: Page,
        title: str,
        author: str | None = None,
        *,
        match_title: str | None = None,
    ) -> list[ScrapedItem]:
        cards: list[dict] = []
        variants = _query_variants(title, author)[:MAX_VARIANTS_PER_SEARCH]
        for query in variants:
            logger.info(f"[Tokopedia] Mencari: {query}")
            # Spasi harus `+` (bentuk `quote_plus`). Bentuk `%20` dijawab halaman
            # 200 tetapi **tanpa satu kartu pun**.
            search_url = f"https://www.tokopedia.com/search?q={quote_plus(query)}&st=product"
            try:
                cards = await self._load_cards(page, search_url, title)
            except ScraperUnavailable as exc:
                # Satu variasi gagal (timeout/HTTP error) bukan alasan
                # menggagalkan seluruh pencarian: variasi berikutnya dicoba.
                logger.warning(f"[Tokopedia] Variasi '{query}' gagal: {exc}")
                continue
            if cards:
                break

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
            logger.warning(f"[Tokopedia] Tidak ada produk relevan untuk '{title}'")
        return offers

    async def _load_cards(
        self, page: Page, search_url: str, title: str
    ) -> list[dict]:
        """Buka satu URL pencarian dan kembalikan kartu yang terbaca.

        Semua tunggu dibatasi `VARIANT_TIMEOUT_SECONDS` supaya satu variasi
        query tidak menghabiskan deadline seluruh buku.
        """
        deadline = time.monotonic() + VARIANT_TIMEOUT_SECONDS

        def remaining() -> float:
            return deadline - time.monotonic()

        goto_timed_out = False
        try:
            response = await page.goto(
                search_url,
                wait_until="domcontentloaded",
                timeout=int(VARIANT_TIMEOUT_SECONDS * 1000),
            )
            if response is not None and response.status >= 400:
                logger.warning(f"[Tokopedia] HTTP {response.status} untuk '{title}'")
                raise ScraperUnavailable(f"Tokopedia: server merespons HTTP {response.status}.")
        except PlaywrightTimeoutError as e:
            # Timeout pada page.goto sendiri: halaman mungkin sebagian termuat.
            # Tandai agar retry tidak diulang (hanya buang waktu), tapi tetap
            # coba ekstrak kartu yang sudah dimuat sebelum batas waktu.
            logger.warning(f"[Tokopedia] Timeout goto {search_url}: {e}")
            goto_timed_out = True
        except ScraperUnavailable:
            raise
        except Exception as e:
            logger.warning(f"[Tokopedia] Gagal membuka {search_url}: {e}")
            raise ScraperUnavailable(f"Tokopedia gagal diakses ({e}).") from e

        if goto_timed_out:
            # Tidak ada gunanya retry bila navigasi sendiri sudah timeout: kita
            # hanya membuang deadline yang sudah hampir habis. Ekstrak apa yang ada.
            cards = await page.evaluate(_EXTRACT_SCRIPT)
            logger.info(
                f"[Tokopedia] {len(cards)} kartu ditemukan setelah timeout goto untuk '{title}'"
            )
            if not cards:
                raise ScraperUnavailable("Tokopedia: halaman tidak terbaca (timeout).")
            return cards

        # Cek segera apakah halaman menyatakan hasil kosong. Pesan itu muncul
        # bersama DOM awal, jadi `wait_for_selector` di bawah tinggal akan
        # menunggu 8 dtk untuk kartu yang tidak pernah datang. Tanpa cek ini,
        # variasi berikutnya kehabisan anggaran.
        try:
            await page.wait_for_function(
                """() => document.body && (
                    document.querySelector('a[href*="extParam"]')
                    || document.querySelector('[data-testid*="product-card"]')
                    || /produk nggak ditemukan/i.test(document.body.innerText || '')
                )""",
                timeout=int(min(6000, max(0.5, remaining()) * 1000)),
            )
        except PlaywrightTimeoutError:
            pass
        if await _is_empty_result(page):
            logger.info(f"[Tokopedia] Produk nggak ditemukan untuk '{title}'")
            return []

        # Navigasi berhasil: tunggu kartu muncul, lalu ekstrak. Retry sekali
        # bila halaman belum selesai render (0 kartu) — bukan untuk timeout goto.
        cards: list[dict] = []
        for attempt in range(2):
            left = remaining()
            if left <= 0:
                break
            try:
                # Coba selector primer dulu; bila tidak ada, biarkan timeout
                # agar fallback JS (_EXTRACT_SCRIPT) yang menentukan.
                await page.wait_for_selector(
                    'a[href*="extParam"], [data-testid*="product-card"]',
                    timeout=int(min(8000 if attempt == 0 else 4000, left * 1000)),
                )
            except PlaywrightTimeoutError:
                pass
            cards = await page.evaluate(_EXTRACT_SCRIPT)
            logger.info(
                f"[Tokopedia] {len(cards)} kartu ditemukan untuk '{title}' "
                f"(percobaan {attempt + 1})"
            )
            if cards:
                break
            if attempt == 0 and remaining() > 2.0:
                # Jeda pendek: halaman mungkin masih merender konten dinamis.
                await page.wait_for_timeout(1500)
        return cards
