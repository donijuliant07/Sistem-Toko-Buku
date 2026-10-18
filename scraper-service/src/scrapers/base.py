"""Kelas dasar dan utility untuk scraper marketplace."""

import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal
from difflib import SequenceMatcher
from typing import Any

from playwright.async_api import Page


class ScraperUnavailable(Exception):
    """Marketplace tidak dapat diakses (timeout, redirect verifikasi, katalog tidak tersedia)."""


@dataclass
class ScrapedItem:
    """Hasil ekstraksi satu produk dari marketplace."""
    marketplace: str
    title: str
    price: Decimal
    product_url: str | None = None
    seller_name: str | None = None
    in_stock: bool | None = True
    match_score: float = 0.0

    def to_dict(self, book_id: Any) -> dict[str, Any]:
        """Ubah ke dictionary yang cocok dengan kolom public.marketplace_prices."""
        return {
            "book_id": str(book_id),
            "marketplace": self.marketplace,
            "price": self.price,
            "currency": "IDR",
            "product_url": self.product_url[:2048] if self.product_url else None,
            "product_title": self.title[:512] if self.title else None,
            "seller_name": self.seller_name[:255] if self.seller_name else None,
            "in_stock": self.in_stock,
            "match_score": round(Decimal(str(self.match_score)), 3),
            "source": "search",
        }


def normalize_price(raw: Any) -> Decimal | None:
    """Ekstrak angka harga dari string (contoh: 'Rp 95.000', '95.000', 'Rp95000')."""
    if raw is None:
        return None
    if isinstance(raw, (int, float, Decimal)):
        return Decimal(str(raw))

    text = str(raw).strip()
    # Hapus simbol mata uang dan spasi
    cleaned = re.sub(r"[^\d,\.]", "", text)
    if not cleaned:
        return None

    # Tangani format Indonesia: titik sebagai pemisah ribuan (125.000)
    if "." in cleaned and "," in cleaned:
        # 125.000,50 -> 125000.50
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif "." in cleaned:
        # Jika ada beberapa titik (1.250.000) atau titik 3 digit terakhir (125.000)
        parts = cleaned.split(".")
        if len(parts) > 2 or (len(parts) == 2 and len(parts[1]) == 3):
            cleaned = cleaned.replace(".", "")
    elif "," in cleaned:
        # Jika koma 3 digit (125,000)
        parts = cleaned.split(",")
        if len(parts) > 2 or (len(parts) == 2 and len(parts[1]) == 3):
            cleaned = cleaned.replace(",", "")
        else:
            cleaned = cleaned.replace(",", ".")

    try:
        val = Decimal(cleaned)
        return val if val > 0 else None
    except Exception:
        return None


def calculate_match_score(target_title: str, candidate_title: str) -> float:
    """Hitung skor kemiripan judul target terhadap judul produk di marketplace (0.0 - 1.0)."""
    if not target_title or not candidate_title:
        return 0.0

    def clean(s: str) -> str:
        s = s.lower()
        s = re.sub(r"[\(\[\{].*?[\)\]\}]", "", s)  # hapus teks dalam kurung seperti (Original)
        s = re.sub(r"[^a-z0-9\s]", "", s)
        return " ".join(s.split())

    c_target = clean(target_title)
    c_cand = clean(candidate_title)

    # Cek apakah seluruh kata target ada di kandidat
    target_words = set(c_target.split())
    cand_words = set(c_cand.split())
    if target_words and target_words.issubset(cand_words):
        return 0.95

    return SequenceMatcher(None, c_target, c_cand).ratio()


def _cari_kata(kata: str, teks: str) -> bool:
    """True bila ``kata`` muncul sebagai kata utuh di ``teks`` (tanpa peduli huruf besar/kecil)."""
    return re.search(rf"(?<!\w){re.escape(kata)}(?!\w)", teks, flags=re.IGNORECASE) is not None


def author_in_keyword(kata_kunci: str | None, author: str | None) -> bool:
    """True bila nama penulis sudah termuat di kata kunci.

    Backend mengirim ``search_keyword = judul + penulis``, dan pipeline lebih dulu
    menambal kata kunci itu dengan judul buku; menambahkan penulis sekali lagi
    menghasilkan query seperti "Judul Neil deGrasse Tyson Neil deGrasse Tyson"
    yang dijawab "tidak ada hasil" oleh marketplace.
    """
    if not kata_kunci or not author:
        return False
    parts = author.split()
    return bool(parts) and all(_cari_kata(part, kata_kunci) for part in parts)


def marketplace_search_query(title: str, author: str | None = None) -> str:
    """Kata kunci tanpa subtitle setelah ``:``, ditambah nama belakang penulis bila belum ada."""
    judul = (title or "").strip()
    short_title = judul.split(":")[0].strip() if ":" in judul else judul
    if author and not author_in_keyword(judul, author):
        parts = author.split()
        if parts:
            last_name = parts[-1]
            if not _cari_kata(last_name, short_title):
                return f"{short_title} {last_name}".strip()
    return short_title


class BaseMarketplaceScraper(ABC):
    """Interface dasar untuk scraper tiap marketplace."""

    marketplace: str
    label: str

    @abstractmethod
    async def search_offers(
        self,
        page: Page,
        title: str,
        author: str | None = None,
        *,
        match_title: str | None = None,
    ) -> list[ScrapedItem]:
        """Ambil **semua** kartu yang lolos ambang judul, bukan hanya satu.

        `title` adalah kata kunci pencarian (bisa berisi nama penulis), sedangkan
        `match_title` adalah judul buku apa adanya dari database. Skor kecocokan
        kartu dihitung terhadap `match_title` bila ada: kata kunci mengandung
        nama penulis yang tidak muncul di judul kartu ("Peter Thiel Zero To One"
        vs "Zero to One Peter Thiel & Blake Masters"), sehingga menilai kartu
        dengan kata kunci akan membuang hasil yang sebenarnya benar.

        Pemilihan satu penawaran dilakukan setelahnya oleh
        `filtering.select_best_offer`, yang tahu membuang paket dan harga
        jebakan. Scraper yang memilih sendiri cenderung mengambil skor judul
        tertinggi — yaitu edisi termahal — bukan harga yang masuk akal.
        """
        pass

    async def search_book(
        self,
        page: Page,
        title: str,
        author: str | None = None,
        *,
        match_title: str | None = None,
    ) -> ScrapedItem | None:
        """Cari dan kembalikan satu penawaran terbaik (termurah yang wajar)."""
        from src.scrapers.filtering import select_best_offer

        offers = await self.search_offers(page, title, author, match_title=match_title)
        return select_best_offer(offers, match_title or title, author)
