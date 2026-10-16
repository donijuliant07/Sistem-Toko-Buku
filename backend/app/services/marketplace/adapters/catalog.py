"""Satu adapter per marketplace; yang berbeda cukup dua hal.

Semua class di sini hanya mengisi identitas (`slug`, `label`) dan
`build_search_url`, lalu mewarisi alur `fetch`/`parse` dari `MarketplaceAdapter`.
Menambah marketplace ke-7 berarti menambah satu class kecil di sini dan satu
baris di `registry.py` — tanpa menyentuh service maupun layer API.

Cara harga dibaca: JSON-LD `schema.org/Product` (dipilih lebih dulu) lalu meta
tag Open Graph. Keduanya adalah data yang halaman sediakan **untuk dibaca
mesin**, sehingga pembacaan tidak ikut rusak setiap kali marketplace merombak
tampilannya — berbeda dengan menebak selector CSS.

Batas yang diakui: keempat marketplace besar (Tokopedia, Shopee, Lazada,
Blibli) memasang proteksi anti-bot, dan adapter di sini **tidak** berusaha
menembusnya. Bila permintaan ditolak, marketplace itu muncul sebagai `warnings`
di respons. Jalan yang andal adalah `product_url` yang diisi admin lewat
endpoint `/marketplace-sources`: URL itu langsung dibuka, tanpa pencarian dan
tanpa ambang kecocokan. `GoogleBooksAdapter` adalah pengecualian menyenangkan —
ia memakai API publik berformat JSON, jadi bisa dipercaya tanpa link admin;
`OpenLibraryAdapter` memakai API publik juga, tetapi hanya untuk *metadata*
(lihat catatan di kelasnya).
"""

from __future__ import annotations

import os
from urllib.parse import quote_plus

from app.core.config import settings
from app.services.marketplace.base import (
    AdapterError,
    MarketplaceAdapter,
    _Candidate,
    normalize_price,
)


def _quote(value: str) -> str:
    """Kata kunci siap tempel di URL: spasi jadi `+`, sisanya di-escape."""
    return quote_plus(" ".join((value or "").split()) or "buku")


class TokopediaAdapter(MarketplaceAdapter):
    """Tokopedia — `/search?q=`."""

    slug = "tokopedia"
    label = "Tokopedia"

    def build_search_url(self, keyword: str) -> str:
        return f"https://www.tokopedia.com/search?q={_quote(keyword)}&st=product"


class ShopeeAdapter(MarketplaceAdapter):
    """Shopee Indonesia — `/search?keyword=`."""

    slug = "shopee"
    label = "Shopee"

    def build_search_url(self, keyword: str) -> str:
        return f"https://shopee.co.id/search?keyword={_quote(keyword)}"


class LazadaAdapter(MarketplaceAdapter):
    """Lazada Indonesia — `/catalog/?q=`."""

    slug = "lazada"
    label = "Lazada"

    def build_search_url(self, keyword: str) -> str:
        return f"https://www.lazada.co.id/catalog/?q={_quote(keyword)}"


class BlibliAdapter(MarketplaceAdapter):
    """Blibli — `/jual/<kata-kunci>`."""

    slug = "blibli"
    label = "Blibli"

    def build_search_url(self, keyword: str) -> str:
        return f"https://www.blibli.com/jual/{_quote(keyword)}"


class BukalapakAdapter(MarketplaceAdapter):
    """Bukalapak — `/products?search[keywords]=`.

    Ambang kecocokan dinaikkan: judul lapak di Bukalapak panjang dan penuh
    embel-embel ("ORI - Buku X Bonus Pembatas"), sehingga buku yang sama selalu
    mendapat skor lebih rendah daripada di marketplace lain.
    """

    slug = "bukalapak"
    label = "Bukalapak"
    match_threshold = 0.6

    def build_search_url(self, keyword: str) -> str:
        return f"https://www.bukalapak.com/products?search%5Bkeywords%5D={_quote(keyword)}"


class GoogleBooksAdapter(MarketplaceAdapter):
    """Google Books — API publik, satu-satunya sumber yang andal tanpa link admin.

    Respons `parse` menangani JSON `volumeInfo` lebih dulu karena bentuknya
    berbeda dari `schema.org/Product`: harga ada di `saleInfo.listPrice`, dan
    buku tanpa harga jual (hanya metadata) dilewati — bukan dikarang.

    Dua hal yang menentukan apakah harga benar-benar muncul:

    - **`country=ID`** wajib. `saleInfo` bersifat per negara: buku bisa
      `FOR_SALE` di US tapi `NOT_FOR_SALE` di Indonesia. Tanpa parameter itu,
      harga yang keluar bukan harga yang berlaku di sini — dan membandingkannya
      dengan harga toko justru menyesatkan.
    - **API key** hampir selalu wajib. Kuota harian untuk permintaan tanpa key
      terukur `0`, sehingga tanpa key respons yang datang selalu HTTP 429.
      Key dibaca dari `GOOGLE_BOOKS_API_KEY`; bila kosong, permintaan tetap
      dikirim (mungkin berhasil di lingkungan yang punya jatah anonim) dan
      kegagalannya muncul sebagai `warnings`, bukan sebagai crash.
    """

    slug = "google_books"
    label = "Google Books"

    #: Batas hasil yang diminta. Lebih dari ini tidak menambah akurasi, hanya
    #: memperbesar respons.
    max_results = 5

    @property
    def api_key(self) -> str:
        """Kunci API, dibaca saat dipanggil supaya bisa diubah tanpa restart."""
        return os.getenv("GOOGLE_BOOKS_API_KEY") or settings.GOOGLE_BOOKS_API_KEY

    def build_search_url(self, keyword: str) -> str:
        url = (
            "https://www.googleapis.com/books/v1/volumes"
            f"?q={_quote(keyword)}&country=ID&maxResults={self.max_results}"
        )
        key = self.api_key
        return f"{url}&key={key}" if key else url

    def parse(self, text: str, page_url: str) -> list[_Candidate]:
        """Baca `saleInfo.listPrice` dari JSON; jatuh ke jalur induk bila bukan JSON."""
        payload = _json_object(text)
        if payload is None:
            return super().parse(text, page_url)

        default_seller = str((payload.get("saleInfo") or {}).get("seller") or "Google Books")
        candidates: list[_Candidate] = []
        for item in payload.get("items") or []:
            if not isinstance(item, dict):
                continue
            volume = item.get("volumeInfo") or {}
            sale = item.get("saleInfo") or {}
            # Hanya buku yang benar-benar dijual yang punya harga. `FREE` dan
            # `NOT_FOR_SALE` bukan harga jual, jadi tidak diikutkan.
            if str(sale.get("saleability") or "").upper() != "FOR_SALE":
                continue
            # `retailPrice` adalah harga jual sebenarnya (sudah termasuk diskon);
            # `listPrice` harga rak. Pakai yang pertama bila ada.
            listed = sale.get("retailPrice") or sale.get("listPrice") or {}
            # Hanya IDR yang sebanding dengan harga toko; mata uang lain dilewati.
            if listed.get("currencyCode") and str(listed["currencyCode"]) != "IDR":
                continue
            price = normalize_price(listed.get("amount"))
            if price is None:
                continue
            candidates.append(
                _Candidate(
                    title=str(volume.get("title") or ""),
                    price=price,
                    url=volume.get("infoLink") or volume.get("canonicalVolumeLink") or None,
                    seller=str(sale.get("seller") or default_seller),
                    in_stock=True,
                )
            )
        return candidates


class OpenLibraryAdapter(MarketplaceAdapter):
    """Open Library — metadata terbuka, **tanpa harga jual**.

    Adapter ini ada untuk melengkapi daftar slug yang sudah dipesan di CHECK
    constraint database, dan supaya `get_adapter("open_library")` mengembalikan
    adapter yang jelas, bukan melempar "belum didukung". Kegunaannya nyata tapi
    sempit: memverifikasi bahwa buku yang dicari itu **ada** dan mendapatkan
    ISBN/halaman resminya.

    Yang tidak dilakukannya: memberi harga. Open Library menyediakan tautan baca
    dan pinjam, bukan angka jual. Jadi `parse` di sini sengaja **tidak** mencari
    harga sama sekali, dan hasilnya selalu `AdapterError` dengan pesan yang
    menjelaskan sebabnya. Itu perilaku yang benar: lebih baik marketplace ini
    absen dari perbandingan daripada muncul dengan harga yang dikarang, dan
    pesannya masuk ke `warnings` sehingga UI bisa menerangkannya.

    Kalau nanti Open Library menambah data harga, cukup lengkapi `parse`.
    """

    slug = "open_library"
    label = "Open Library"

    def build_search_url(self, keyword: str) -> str:
        fields = "title,author_name,key,isbn,first_publish_year"
        return f"https://openlibrary.org/search.json?q={_quote(keyword)}&limit=3&fields={fields}"

    def parse(self, text: str, page_url: str) -> list[_Candidate]:
        """Selalu kosong, dengan alasan yang eksplisit di pesan kesalahan.

        Mengembalikan `[]` akan menghasilkan pesan generik "Harga tidak
        ditemukan di halaman Open Library" — yang menyiratkan harga ada tapi
        gagal dibaca. Padahal tidak ada harga sejak awal, dan itu beda.
        """
        raise AdapterError(
            "Open Library tidak menyediakan harga jual, hanya metadata buku."
        )


def _json_object(text: str) -> dict | None:
    """`text` sebagai dict JSON, atau `None` bila bukan JSON objek."""
    import json

    try:
        payload = json.loads(text)
    except (ValueError, TypeError):
        return None
    return payload if isinstance(payload, dict) else None
