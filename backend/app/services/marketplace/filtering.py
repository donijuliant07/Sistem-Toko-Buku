"""Penyaringan dan pemilihan penawaran hasil pencarian marketplace.

Halaman pencarian tidak pernah hanya berisi buku yang dicari: ada merchandise,
edisi lain dengan judul mirip ("Bumi Cinta" untuk "Bumi Manusia"), paket atau
tetralogi yang lebih murah per buku, buku *tentang* buku lain ("Kisah di Balik
Bumi Manusia"), dan penjual yang memasang harga jebakan. Modul ini mengurung
aturan itu di satu tempat, dan **disalin apa adanya** dari
`scraper-service/src/scrapers/filtering.py`: worker menyeleksi dengan aturan
yang sama, lalu backend memvalidasi ulang hasilnya di sini.

Modul ini tidak bergantung pada adapter maupun HTTP — hanya pada judul,
harga, dan skor yang sudah diekstrak.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from decimal import Decimal
from difflib import SequenceMatcher

#: Ambang relevansi judul: skor terendah yang masih dianggap buku yang dicari.
MIN_MATCH_SCORE = 0.7

#: Penawaran di bawah/atas rasio titik tengah ini dianggap jebakan harga atau
#: edisi yang harganya tidak sebanding.
JUNK_PRICE_RATIO = Decimal("0.3")
OUTLIER_PRICE_RATIO = Decimal(4)

#: Kata yang menandakan barang bukan buku.
NON_BOOK_TOKENS = {
    "casing", "case", "tote", "totebag", "stiker", "sticker", "kaos",
    "tshirt", "gantungan", "keychain", "bookmark", "poster", "mug",
    "pdf", "ebook", "repro", "fotocopy", "fotokopi", "kw",
}

#: Penanda paket/seri. Judul yang menyebutnya bukan satu buku, sehingga
#: harganya tidak bisa dibandingkan dengan harga satu eksemplar.
BUNDLE_TOKENS = {
    "tetralogi", "paket", "set", "seri", "boxset", "box", "lengkap", "omnibus",
}

#: Kata yang menandakan buku *tentang* buku lain, bukan buku itu sendiri.
ABOUT_BOOK_TOKENS = {
    "kisah", "balik", "rahasia", "biografi", "mengenal", "analisis",
    "ringkasan", "resensi", "sinopsis", "catatan", "tentang",
}

_STOPWORDS = {"dan", "the", "of", "and", "for", "dengan", "edisi", "ed", "ori"}

@dataclass(slots=True)
class Offer:
    """Penawaran minimum yang dibutuhkan penyaring (bebas dari tipe adapter)."""

    title: str
    price: Decimal
    in_stock: bool | None = True

def _tokens(text: str) -> list[str]:
    cleaned = "".join(ch.lower() if ch.isalnum() else " " for ch in text)
    return [w for w in cleaned.split() if len(w) > 2 and w not in _STOPWORDS]

def relevance_score(target_title: str, candidate_title: str) -> float:
    """Skor kemiripan judul kandidat dengan buku target (0..1).

    Seluruh kata judul buku harus muncul di kandidat — atau kemiripan teks
    sangat tinggi (>= 0.85) — sehingga "Bumi Manusia" tidak lolos pada
    "Manajemen Sumber Daya Manusia". Judul bertanda paket/seri dan buku
    *tentang* buku lain juga ditolak: keduanya lebih murah dan akan terpilih
    bila lolos.
    """
    wanted = _tokens(target_title)
    candidate_words = _tokens(candidate_title)
    if not wanted or not candidate_words:
        return 0.0

    candidate_set = set(candidate_words)
    if candidate_set & NON_BOOK_TOKENS:
        return 0.0

    wanted_set = set(wanted)
    if (candidate_set & ABOUT_BOOK_TOKENS) - wanted_set:
        return 0.0

    coverage = sum(1 for token in wanted if token in candidate_set) / len(wanted)
    ratio = SequenceMatcher(None, " ".join(wanted), " ".join(candidate_words)).ratio()
    if coverage < 1.0 and ratio < 0.85:
        return 0.0

    if (candidate_set & BUNDLE_TOKENS) - wanted_set:
        return 0.0

    return round(min(0.8 + 0.15 * coverage, 0.95), 3)

def has_non_book_keyword(title: str) -> bool:
    lowered = title.lower()
    return any(re.search(rf"\b{re.escape(token)}\b", lowered) for token in NON_BOOK_TOKENS)

def price_anchor(values: list[Decimal]) -> Decimal:
    """Titik tengah harga yang tahan outlier: rata-rata geometris.

    Rata-rata biasa dan median sama-sama kalah untuk daftar pendek: pada
    ``[Rp 4.500, Rp 90.000]`` keduanya menghasilkan 4.500 atau 47.250,
    sedangkan rata-rata geometris (20.124) berada di antara skala harga dan
    membuat batas 30%-nya membuang Rp 4.500 tanpa membuang Rp 90.000.
    """
    logs = [math.log(float(value)) for value in values if value > 0]
    if not logs:
        return Decimal(0)
    return Decimal(str(math.exp(sum(logs) / len(logs))))

def _cheapest_plausible(offers: list[Offer]) -> Offer:
    """Harga termurah yang masih wajar dibanding harga pasar kandidat."""
    anchor = price_anchor([offer.price for offer in offers])
    if anchor <= 0:
        return min(offers, key=lambda offer: offer.price)
    in_range = [
        offer
        for offer in offers
        if JUNK_PRICE_RATIO * anchor <= offer.price <= OUTLIER_PRICE_RATIO * anchor
    ]
    return min(in_range or offers, key=lambda offer: offer.price)

def select_best_offer(
    offers: list[Offer],
    target_title: str,
    target_author: str | None = None,
) -> Offer | None:
    """Pilih satu penawaran terbaik dari daftar kandidat.

    Langkahnya, berurutan: buang yang tidak relevan/non-buku/paket/tidak
    tersedia, utamakan yang menyebut penulis (bila ada), lalu ambil termurah
    yang harganya wajar dibanding harga pasar kandidat.
    """
    valid = [
        offer
        for offer in offers
        if offer.price
        and offer.title
        and offer.in_stock is not False
        and relevance_score(target_title, offer.title) > 0
    ]
    if not valid:
        return None

    author_tokens = _tokens(target_author or "")
    if author_tokens:
        # Cukup satu kata nama penulis (biasanya nama keluarga) yang disebut.
        matching_author = [
            offer
            for offer in valid
            if set(_tokens(offer.title)) & set(author_tokens)
        ]
        if matching_author:
            return _cheapest_plausible(matching_author)

    return _cheapest_plausible(valid)
