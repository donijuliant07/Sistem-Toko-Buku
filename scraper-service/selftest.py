"""Self-check parser scraper tanpa browser/network: `uv run python selftest.py`."""

from decimal import Decimal

from src.scrapers.base import ScrapedItem, calculate_match_score, normalize_price
from src.scrapers.blibli import parse_card_text as parse_blibli_card
from src.scrapers.gramedia import parse_card_text as parse_gramedia_card
from src.scrapers.periplus import parse_card_text as parse_periplus_card
from src.scrapers.base import marketplace_search_query
from src.scrapers.filtering import relevance_score, select_best_offer
from src.scrapers.tokopedia import parse_card_text

# Kartu Tokopedia: label, judul, harga (diskon + coret), rating, terjual, toko, kota.
CARD = """PreOrder
Buku Pramoedya Ananta Toer - Bumi Manusia - Anak Semua Bangsa
Rp224.999
Rp225.000
Hemat s.d 8% Pakai Bonus
5.0
70+ terjual
BumifiksiJakarta
Jakarta Selatan"""

parsed = parse_card_text(CARD)
assert parsed["title"] == "Buku Pramoedya Ananta Toer - Bumi Manusia - Anak Semua Bangsa", parsed
assert parsed["price"] == "Rp224.999", parsed
assert parsed["seller"] == "BumifiksiJakarta", parsed

# Kartu tanpa rating/terjual: toko tetap terbaca dari dua baris terakhir.
assert parse_card_text("Bumi Manusia\nRp85.000\njendelabook\nKab. Klaten")["seller"] == "jendelabook"

# Label iklan modern Tokopedia: "Ad", "Pilihan", "Iklan" di awal kartu.
ad_card = parse_card_text("Ad\nBumi Manusia - Pramoedya Ananta Toer\nRp89.000\nToko Gramedia\nJakarta")
assert ad_card["title"] == "Bumi Manusia - Pramoedya Ananta Toer", ad_card

pilihan_card = parse_card_text("Pilihan\nBumi Manusia\nRp91.000\nToko A\nBandung")
assert pilihan_card["title"] == "Bumi Manusia", pilihan_card

# Label bertumpuk: "Ad Pilihan" → judul bersih.
ad_pilihan = parse_card_text("Ad Pilihan\nAtomic Habits James Clear\nRp110.000\nKitab Store\nSurabaya")
assert ad_pilihan["title"] == "Atomic Habits James Clear", ad_pilihan

gramedia = parse_gramedia_card(
    "5.0\n500+ terjual\nPramoedya Ananta Toer\nBumi Manusia (Lentera Dipantara)\nRp144.000\nRp180.000\n20%"
)
assert gramedia["title"] == "Pramoedya Ananta Toer Bumi Manusia (Lentera Dipantara)"
assert gramedia["price"] == "Rp144.000"

periplus = parse_periplus_card("Atomic Habits Paperback Clear, James Rp 458,000 Buy Now")
assert periplus["title"] == "Atomic Habits"
assert periplus["price"] == "Rp 458,000"

assert marketplace_search_query("Life 3.0: Menjadi Manusia", "Max Tegmark") == "Life 3.0 Tegmark"

# Kartu Blibli: label "Ad"/"Baru", judul, harga, coret, diskon, kirim, rating, toko, kota.
BLIBLI_CARD = """Ad
Novel Bumi Manusia - Pramoedya Ananta Toer
Rp93.000
110.000
15%
4–7 hari
4,8 rating seller
Terjual 12
Toko Buku Nusantara
Kota Yogyakarta"""
blibli = parse_blibli_card(BLIBLI_CARD)
assert blibli["title"] == "Novel Bumi Manusia - Pramoedya Ananta Toer", blibli
assert blibli["price"] == "Rp93.000", blibli
assert blibli["seller"] == "Toko Buku Nusantara", blibli
assert blibli["in_stock"] is True

# Kartu barang habis: awalan "Stok habis" dibuang dan ditandai tidak tersedia.
sold_out = parse_blibli_card(
    "\n".join(["Stok habis", "Bumi Manusia", "Rp55.000", "Toko A", "Kota B"])
)
assert sold_out["title"] == "Bumi Manusia", sold_out
assert sold_out["in_stock"] is False, sold_out

assert normalize_price("Rp 224.999") == Decimal("224999")
assert normalize_price("1.250.000") == Decimal("1250000")
assert normalize_price(None) is None

assert relevance_score("Bumi Manusia", "Bumi Manusia") == 0.95
assert relevance_score("Bumi Manusia", "Bumi Manusia Pramoedya Ananta Toer") == 0.95
assert relevance_score("Bumi Manusia", "Manajemen Sumber Daya Manusia") == 0.0
assert relevance_score("Bumi Manusia", "Tshirt Bumi Manusia Kaos") == 0.0
assert relevance_score("Bumi Manusia", "Tetralogi Bumi Manusia 4 Novel") == 0.0
assert relevance_score("Bumi Manusia", "Kisah di Balik Bumi Manusia") == 0.0


def offer(title: str, price: str, score: float = 0.95) -> ScrapedItem:
    return ScrapedItem(
        marketplace="tokopedia",
        title=title,
        price=Decimal(price),
        match_score=score,
    )


# Pemilihan harga: titik tengah dipegang harga normal, sehingga jebakan
# Rp 4.500 dibuang dan pilihan jatuh ke Rp 90.000.
chosen = select_best_offer(
    [
        offer("Bumi Manusia", "90000"),
        offer("Bumi Manusia", "4500"),
        offer("Bumi Manusia", "120000"),
    ],
    "Bumi Manusia",
)
assert chosen is not None and chosen.price == Decimal("90000"), chosen

# Paket yang jauh lebih mahal dibuang bila ada pembanding lain.
bundle = select_best_offer(
    [
        offer("Bumi Manusia", "120000"),
        offer("Bumi Manusia", "125000"),
        offer("Bumi Manusia", "2000000"),
    ],
    "Bumi Manusia",
)
assert bundle is not None and bundle.price == Decimal("120000"), bundle

# Judul tidak relevan / paket / merchandise tidak pernah dipilih.
assert select_best_offer([offer("Bumi Cinta", "50000", score=0.3)], "Bumi Manusia") is None
assert select_best_offer([offer("Tetralogi Bumi Manusia", "50000")], "Bumi Manusia") is None
assert select_best_offer([offer("Kaos Bumi Manusia", "50000")], "Bumi Manusia") is None

# Skor judul marketplace langsung (dipakai Tokopedia/Lazada).
assert calculate_match_score("Bumi Manusia", "Buku Bumi Manusia Original") > 0.9
assert calculate_match_score("Bumi Manusia", "Atomic Habits") < 0.5

print("selftest OK")
