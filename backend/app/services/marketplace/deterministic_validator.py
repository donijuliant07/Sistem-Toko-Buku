"""Modul validasi deterministik dan analisis statistik harga buku.

Menjalankan aturan deterministik Python tanpa ketergantungan pada model AI:
1. Validasi integritas data dasar (harga positif, mata uang, skema URL, judul).
2. Normalisasi dan deteksi atribut (ISBN, bundel, ebook, preorder, buku bekas).
3. Analisis kecocokan produk terhadap target buku (judul, penulis, ISBN).
4. Analisis statistik harga (median, rentang, deviasi persentase, outlier).
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from difflib import SequenceMatcher
from typing import Any
from urllib.parse import urlparse

from app.schemas.book import normalize_isbn
from app.schemas.price_validation import (
    DetectedProductAttributes,
    DeterministicEvaluation,
    PriceAssessment,
    PriceStatistics,
    ProductMatchStatus,
)

# ---------------------------------------------------------------------------
# Konfigurasi Threshold Terpusat
# ---------------------------------------------------------------------------

#: Ambang deviasi persentase terhadap median harga pasar
SUSPICIOUS_LOW_THRESHOLD = -60.0   # <= -60% dari median dicurigai harga jebakan/aksesoris
SUSPICIOUS_HIGH_THRESHOLD = 150.0  # >= +150% dari median dicurigai edisi spesial/outlier
EXTREME_LOW_THRESHOLD = -85.0      # <= -85% dari median hampir pasti bukan buku utuh
EXTREME_HIGH_THRESHOLD = 300.0     # >= +300% dari median

#: Jumlah minimum kandidat agar kesimpulan statistik dianggap cukup meyakinkan
MIN_SAMPLES_FOR_CONFIDENT_STATS = 3

#: Slug marketplace yang dikenal sistem
KNOWN_MARKETPLACE_SLUGS = {
    "tokopedia",
    "shopee",
    "lazada",
    "blibli",
    "gramedia",
    "periplus",
    "google_books",
    "open_library",
    "demo_store_a",
    "demo_store_b",
    "demo_store_c",
}

#: Kata/token barang bukan buku (aksesoris, digital bajakan, merchandise)
NON_BOOK_PATTERNS = [
    r"\b(casing|case|tote|totebag|stiker|sticker|kaos|tshirt|t-shirt)\b",
    r"\b(gantungan|keychain|bookmark|poster|mug|pin|merchandise)\b",
    r"\b(pdf|ebook|e-book|epub|repro|fotocopy|fotokopi|kw)\b",
]

#: Penanda produk bundel / beberapa buku sekaligus
BUNDLE_PATTERNS = [
    r"\b(tetralogi|trilogi|duologi|paket|set|seri|boxset|box-set|box\s*set)\b",
    r"\b(lengkap|omnibus|bundle|bundling|komplit)\b",
    r"\b(vol\s*\d+\s*[-–]\s*\d+|jilid\s*\d+\s*[-–]\s*\d+)\b",
    r"\b(\d+\s*buku\s*sekaligus)\b",
]

#: Penanda preorder
PREORDER_PATTERNS = [
    r"\b(preorder|pre-order|pre\s*order)\b",
    r"(^|[\s\[(])po([\s\]):-]|$)",
]

#: Penanda buku bekas / second
USED_BOOK_PATTERNS = [
    r"\b(bekas|second|seken|preloved|kolpri|ex-rental|ex\s*rental)\b",
]

#: Penanda buku *tentang* buku lain, bukan karya asli itu sendiri
ABOUT_BOOK_PATTERNS = [
    r"\b(kisah\s*di\s*balik|rahasia\s*di\s*balik|mengenal|analisis)\b",
    r"\b(ringkasan|resensi|sinopsis|catatan\s*tentang|bedah\s*buku)\b",
]

_STOPWORDS = {
    "dan", "the", "of", "and", "for", "dengan", "edisi", "ed", "ori",
    "original", "asli", "buku", "novel", "komik", "terbaru", "promo",
}


def clean_tokens(text: str) -> list[str]:
    """Ekstrak token kata bersih berhuruf kecil tanpa tanda baca dan stopwords."""
    cleaned = "".join(ch.lower() if ch.isalnum() else " " for ch in text)
    return [w for w in cleaned.split() if len(w) > 1 and w not in _STOPWORDS]


def extract_isbns(text: str) -> list[str]:
    """Temukan kemungkinan nomor ISBN-10 atau ISBN-13 dalam teks."""
    candidates = re.findall(r"\b(?:97[89][-\s]?)?[0-9]{1,5}[-\s]?[0-9]+[-\s]?[0-9]+[-\s]?[0-9X]\b", text, re.I)
    valid_isbns = []
    for raw in candidates:
        digits = re.sub(r"[-\s]", "", raw).upper()
        if len(digits) in (10, 13):
            valid_isbns.append(digits)
    return valid_isbns


def is_valid_http_url(url: str | None) -> bool:
    """Periksa apakah URL menggunakan skema http atau https yang valid."""
    if not url:
        return True  # URL opsional
    try:
        parsed = urlparse(str(url))
        return parsed.scheme in ("http", "https") and bool(parsed.netloc)
    except Exception:
        return False


def detect_attributes(title: str, raw_url: str | None = None) -> DetectedProductAttributes:
    """Deteksi atribut khusus dari judul produk dan URL."""
    lowered = title.lower()
    combined = f"{lowered} {raw_url or ''}".lower()

    is_non_book = any(bool(re.search(p, combined)) for p in NON_BOOK_PATTERNS)
    is_bundle = any(bool(re.search(p, combined)) for p in BUNDLE_PATTERNS)
    is_preorder = any(bool(re.search(p, combined)) for p in PREORDER_PATTERNS)
    is_used = any(bool(re.search(p, combined)) for p in USED_BOOK_PATTERNS)

    is_ebook = bool(re.search(r"\b(pdf|ebook|e-book|epub)\b", combined))

    isbns = extract_isbns(title)
    detected_isbn = isbns[0] if isbns else None

    condition_note = None
    if is_used:
        condition_note = "Buku bekas / preloved"
    elif is_preorder:
        condition_note = "Preorder"

    return DetectedProductAttributes(
        is_bundle=is_bundle,
        is_ebook=is_ebook,
        is_preorder=is_preorder,
        is_used=is_used,
        is_non_book=is_non_book,
        condition_note=condition_note,
        detected_isbn=detected_isbn,
    )


def validate_basic_data(
    quote: dict[str, Any] | Any,
) -> tuple[bool, Decimal | None, list[str]]:
    """Validasi format dasar data penawaran: harga, judul, marketplace, URL."""
    reasons: list[str] = []

    # Ambil nilai baik dari dict maupun object
    if isinstance(quote, dict):
        raw_price = quote.get("price")
        title = quote.get("product_title") or quote.get("title")
        marketplace = quote.get("marketplace")
        url = quote.get("product_url") or quote.get("url")
    else:
        raw_price = getattr(quote, "price", None)
        title = getattr(quote, "product_title", None) or getattr(quote, "title", None)
        marketplace = getattr(quote, "marketplace", None)
        url = getattr(quote, "product_url", None) or getattr(quote, "url", None)

    # 1. Parsing harga numerik
    parsed_price: Decimal | None = None
    if raw_price is None:
        reasons.append("Harga tidak tersedia.")
    else:
        try:
            parsed_price = Decimal(str(raw_price))
            if parsed_price <= 0:
                reasons.append(f"Harga harus lebih besar dari nol (didapat: {parsed_price}).")
                parsed_price = None
        except (InvalidOperation, ValueError, TypeError):
            reasons.append(f"Format harga tidak dapat diparsing: {raw_price}")
            parsed_price = None

    # 2. Judul produk tidak boleh kosong
    clean_title = str(title or "").strip()
    if not clean_title:
        reasons.append("Judul produk kosong.")

    # 3. Marketplace dikenali
    if marketplace and str(marketplace) not in KNOWN_MARKETPLACE_SLUGS:
        reasons.append(f"Marketplace '{marketplace}' tidak dikenali.")

    # 4. Validasi skema URL
    if url and not is_valid_http_url(str(url)):
        reasons.append(f"URL produk memiliki skema tidak valid: {url}")

    is_valid = len(reasons) == 0 and parsed_price is not None
    return is_valid, parsed_price, reasons


def compute_match(
    target_title: str,
    target_author: str | None,
    target_isbn: str | None,
    candidate_title: str,
    attributes: DetectedProductAttributes,
) -> tuple[ProductMatchStatus, float, list[str]]:
    """Evaluasi kecocokan produk antara target dan kandidat penawaran."""
    notes: list[str] = []

    # 1. Jika barang bukan buku fisik (misal merchandise atau fotocopy/ebook), otomatis mismatch
    if attributes.is_non_book:
        notes.append("Terdeteksi sebagai barang non-buku atau produk bajakan/digital.")
        return "mismatch", 0.0, notes

    # 2. Cek apakah buku *tentang* buku lain
    lowered_candidate = candidate_title.lower()
    if any(re.search(p, lowered_candidate) for p in ABOUT_BOOK_PATTERNS):
        notes.append("Terdeteksi sebagai ulasan/ringkasan tentang buku, bukan buku asli.")
        return "mismatch", 0.1, notes

    # 3. Cek ISBN jika keduanya memiliki ISBN
    if target_isbn and attributes.detected_isbn:
        try:
            norm_target = normalize_isbn(target_isbn)
            norm_cand = normalize_isbn(attributes.detected_isbn)
            if norm_target == norm_cand:
                notes.append(f"Nomor ISBN cocok persis ({norm_target}).")
                return "match", 1.0, notes
            # Jika ada ISBN tapi beda, potensi beda edisi/buku
            notes.append(f"Nomor ISBN berbeda (target: {norm_target}, kandidat: {norm_cand}).")
            return "uncertain", 0.4, notes
        except Exception:
            pass

    # 4. Pencocokan berbasis token judul & difflib
    wanted_tokens = clean_tokens(target_title)
    cand_tokens = clean_tokens(candidate_title)

    if not wanted_tokens or not cand_tokens:
        notes.append("Informasi judul tidak memadai untuk mencocokkan produk.")
        return "uncertain", 0.0, notes

    wanted_set = set(wanted_tokens)
    cand_set = set(cand_tokens)

    # Rasio kemunculan kata target di judul kandidat
    overlap_count = sum(1 for token in wanted_tokens if token in cand_set)
    coverage = overlap_count / len(wanted_tokens)

    # Sequence similarity
    ratio = SequenceMatcher(
        None, " ".join(wanted_tokens), " ".join(cand_tokens)
    ).ratio()

    # Cek penulis jika ada
    author_match = False
    if target_author:
        author_tokens = clean_tokens(target_author)
        if author_tokens and any(t in cand_set for t in author_tokens):
            author_match = True
            notes.append(f"Nama penulis terkonfirmasi ({target_author}).")

    # Hitung match score (0..1)
    base_score = 0.6 * coverage + 0.4 * ratio
    if author_match:
        base_score = min(1.0, base_score + 0.15)

    final_score = round(base_score, 3)

    # Logika status kecocokan
    if coverage >= 1.0 and (author_match or ratio >= 0.7):
        match_status: ProductMatchStatus = "match"
        notes.append("Judul dan atribut cocok dengan buku yang dicari.")
    elif coverage >= 0.8 and ratio >= 0.6:
        match_status = "likely_match"
        notes.append("Kemungkinan besar buku yang sama dengan variasi penulisan judul.")
    elif coverage >= 0.75 or (coverage >= 0.5 and ratio >= 0.65):
        match_status = "uncertain"
        notes.append("Kecocokan judul belum meyakinkan, perlu verifikasi.")
    else:
        match_status = "mismatch"
        notes.append("Judul tidak cocok dengan buku target.")

    return match_status, final_score, notes


def calculate_price_statistics(
    prices: list[Decimal],
) -> PriceStatistics:
    """Hitung metrik statistik harga (median, rentang, min, max) dari harga sebanding."""
    valid_prices = sorted([p for p in prices if p is not None and p > 0])
    sample_size = len(valid_prices)

    if sample_size == 0:
        return PriceStatistics(
            sample_size=0,
            median_price=None,
            min_price=None,
            max_price=None,
            price_spread=None,
            is_reliable=False,
        )

    min_p = valid_prices[0]
    max_p = valid_prices[-1]
    spread = max_p - min_p

    # Median calculation
    mid = sample_size // 2
    if sample_size % 2 == 1:
        median_p = valid_prices[mid]
    else:
        median_p = (valid_prices[mid - 1] + valid_prices[mid]) / Decimal(2)

    is_reliable = sample_size >= MIN_SAMPLES_FOR_CONFIDENT_STATS

    return PriceStatistics(
        sample_size=sample_size,
        median_price=median_p,
        min_price=min_p,
        max_price=max_p,
        price_spread=spread,
        is_reliable=is_reliable,
    )


def evaluate_price_deviation(
    price: Decimal,
    stats: PriceStatistics,
) -> tuple[float | None, PriceAssessment, bool, list[str]]:
    """Hitung persentase deviasi terhadap median dan tentukan indikasi anomali/outlier."""
    reasons: list[str] = []

    if stats.median_price is None or stats.median_price <= 0 or stats.sample_size < 2:
        return None, "insufficient_data", False, ["Data pembanding tidak cukup untuk analisis statistik."]

    median = float(stats.median_price)
    current_p = float(price)

    # deviation_percent = ((price - median_price) / median_price) * 100
    deviation = ((current_p - median) / median) * 100.0
    rounded_dev = round(deviation, 2)

    if rounded_dev <= EXTREME_LOW_THRESHOLD:
        assessment: PriceAssessment = "extreme_low"
        is_outlier = True
        reasons.append(
            f"Harga ekstrem murah ({rounded_dev:+.1f}% dari median Rp {int(median):,}). Indikasi kuat jebakan harga / non-buku."
        )
    elif rounded_dev <= SUSPICIOUS_LOW_THRESHOLD:
        assessment = "potential_outlier"
        is_outlier = True
        reasons.append(
            f"Harga jauh di bawah median pasar ({rounded_dev:+.1f}%). Perlu verifikasi kondisi buku atau stok."
        )
    elif rounded_dev >= EXTREME_HIGH_THRESHOLD:
        assessment = "extreme_high"
        is_outlier = True
        reasons.append(
            f"Harga ekstrem tinggi ({rounded_dev:+.1f}% dari median). Indikasi edisi kolektor langka atau kesalahan input seller."
        )
    elif rounded_dev >= SUSPICIOUS_HIGH_THRESHOLD:
        assessment = "potential_outlier"
        is_outlier = True
        reasons.append(
            f"Harga jauh di atas median pasar ({rounded_dev:+.1f}%). Kemungkinan paket atau harga non-standar."
        )
    else:
        assessment = "fair"
        is_outlier = False
        reasons.append(f"Harga wajar ({rounded_dev:+.1f}% dari median pasar).")

    return rounded_dev, assessment, is_outlier, reasons


def evaluate_candidate_deterministically(
    quote: dict[str, Any] | Any,
    target_title: str,
    target_author: str | None = None,
    target_isbn: str | None = None,
    stats: PriceStatistics | None = None,
) -> DeterministicEvaluation:
    """Jalankan seluruh rangkaian validasi deterministik untuk satu penawaran."""
    is_valid_data, price, data_errors = validate_basic_data(quote)

    if isinstance(quote, dict):
        title = str(quote.get("product_title") or quote.get("title") or "")
        url = quote.get("product_url") or quote.get("url")
    else:
        title = str(getattr(quote, "product_title", "") or getattr(quote, "title", "") or "")
        url = getattr(quote, "product_url", None) or getattr(quote, "url", None)

    attributes = detect_attributes(title, str(url) if url else None)

    rejection_reasons: list[str] = list(data_errors)
    review_reasons: list[str] = []

    # Jika data dasar tidak valid, langsung kembalikan evaluasi gagal
    if not is_valid_data or price is None:
        return DeterministicEvaluation(
            is_data_valid=False,
            rejection_reasons=rejection_reasons,
            review_reasons=[],
            match_status="mismatch",
            match_score=0.0,
            attributes=attributes,
            deviation_percent=None,
            price_assessment="insufficient_data",
            is_outlier=False,
        )

    # Cek bundel
    if attributes.is_bundle:
        rejection_reasons.append("Produk terdeteksi sebagai paket/bundel beberapa buku, tidak sebanding dengan satu eksemplar.")

    # Cek ebook
    if attributes.is_ebook:
        rejection_reasons.append("Produk terdeteksi sebagai ebook/digital, tidak sebanding dengan buku fisik.")

    # Cek non-buku
    if attributes.is_non_book:
        rejection_reasons.append("Produk terdeteksi sebagai barang non-buku (aksesoris/merchandise).")

    # Cek preorder atau bekas -> masuk ke review_reasons, bukan otomatis ditolak
    if attributes.is_preorder:
        review_reasons.append("Produk berstatus preorder (PO), pengiriman mungkin memerlukan waktu lebih lama.")
    if attributes.is_used:
        review_reasons.append("Produk adalah buku bekas/second, kondisi fisik mungkin berbeda.")

    # Evaluasi kecocokan produk
    match_status, match_score, match_notes = compute_match(
        target_title=target_title,
        target_author=target_author,
        target_isbn=target_isbn,
        candidate_title=title,
        attributes=attributes,
    )

    if match_status == "mismatch":
        rejection_reasons.extend(match_notes)
    elif match_status == "uncertain":
        review_reasons.extend(match_notes)

    # Analisis statistik harga jika tersedia
    dev_pct: float | None = None
    price_assessment: PriceAssessment = "insufficient_data"
    is_outlier = False

    if stats is not None and stats.median_price is not None:
        dev_pct, price_assessment, is_outlier, stat_reasons = evaluate_price_deviation(price, stats)
        if is_outlier:
            review_reasons.extend(stat_reasons)

    return DeterministicEvaluation(
        is_data_valid=True,
        rejection_reasons=rejection_reasons,
        review_reasons=review_reasons,
        match_status=match_status,
        match_score=match_score,
        attributes=attributes,
        deviation_percent=dev_pct,
        price_assessment=price_assessment,
        is_outlier=is_outlier,
    )
