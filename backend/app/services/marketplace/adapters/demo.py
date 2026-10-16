"""Adapter **contoh** untuk demo — tidak menghubungi jaringan sama sekali.

Kenapa ini ada: adapter sungguhan semuanya bergantung pada pihak ketiga yang
tidak bisa diandalkan (Google Books menuntut API key; Tokopedia/Shopee/Lazada/
Blibli/Bukalapak memasang anti-bot). Akibatnya UI pembanding harga tidak bisa
diperlihatkan berisi tanpa kredensial atau link admin. Adapter ini menutup celah
itu: seluruh alur — registry, `fetch`, snapshot, cache, riwayat, modal — berjalan
persis seperti produksi, hanya sumber angkanya yang dibuat.

Yang **tidak** dilakukannya: berpura-pura jadi marketplace sungguhan. Tiga
pertahanan, dan ketiganya disengaja:

1. **Slug-nya `demo_store_*`**, bukan nama marketplace nyata. Tidak ada yang bisa
   menyangka "Demo Store B" itu Shopee.
2. **`source="mock"`** pada setiap snapshot, ditegakkan CHECK constraint di
   database. Jadi keaslian sebuah harga terbaca dari datanya, bukan dari daftar
   slug di kode — UI tidak perlu tahu apa pun tentang adapter.
3. **URL-nya domain `.invalid`**, yang menurut RFC 2606 dijamin tidak akan pernah
   resolve. Linknya tidak bisa tanpa sengaja menuju situs nyata.

Harganya **deterministik**: diturunkan dari hash judul buku, bukan acak. Buku
yang sama selalu menghasilkan angka yang sama, sehingga riwayat harga dan uji
otomatis tetap bermakna. `hash()` bawaan Python sengaja tidak dipakai — nilainya
diacak per proses, jadi harga demo akan berubah setiap server dijalankan ulang.

Cara mematikannya: hapus ketiga kelas dari `DEMO_CLASSES` di `registry.py`.
Tidak ada berkas lain yang perlu disentuh, dan tidak ada tabel yang perlu diubah
(baris lama bersumber `mock` tetap terbaca sebagai data contoh).
"""

from __future__ import annotations

from decimal import Decimal
from hashlib import sha256
from urllib.parse import quote_plus

from app.services.marketplace.base import (
    FetchResult,
    MarketplaceAdapter,
    _Candidate,
)

#: Domain yang dijamin tidak resolve (RFC 2606). Dipakai untuk `product_url`,
#: supaya tautan demo tidak pernah menunjuk situs sungguhan.
UNRESOLVABLE_HOST = "demo.invalid"

#: Rentang harga contoh, dalam rupiah. Dipilih agar sebanding dengan harga buku
#: di katalog, sehingga tampilan perbandingannya masuk akal saat didemokan.
PRICE_FLOOR = 65_000
PRICE_CEILING = 125_000


def _digest(book_title: str, salt: str) -> int:
    """Angka stabil dari judul buku — sama di setiap proses dan setiap mesin."""
    raw = f"{salt}|{(book_title or '').strip().lower()}".encode()
    return int.from_bytes(sha256(raw).digest()[:6], "big")


def _price_for(book_title: str, *, salt: str, multiplier: Decimal) -> Decimal:
    """Harga contoh yang stabil, dibulatkan ke ratusan rupiah terdekat."""
    span = PRICE_CEILING - PRICE_FLOOR
    base = PRICE_FLOOR + (_digest(book_title, salt) % span)
    value = Decimal(base) * multiplier
    return (value / 100).quantize(Decimal(1)) * 100


class DemoStoreAdapter(MarketplaceAdapter):
    """Induk adapter contoh. Subclass mengisi `slug`, `label`, dan pengalinya.

    `fetch` di-override seluruhnya: tidak ada `httpx`, tidak ada `build_search_url`
    yang dipanggil, tidak ada `parse`. Yang dihasilkan tetap `FetchResult` biasa,
    sehingga service orkestrasi memperlakukannya sama seperti hasil scrape nyata —
    itulah yang membuat demo ini menguji alur produksi, bukan jalur khusus.
    """

    #: Ditandai supaya `supported_marketplaces()` bisa menyaringnya keluar dari
    #: dropdown admin: marketplace contoh tidak boleh jadi pilihan sungguhan.
    is_mock = True

    #: Pengali harga dasar. Berbeda per toko supaya ketiganya menghasilkan angka
    #: yang berbeda — tanpa itu, tabelnya rata dan tidak mendemokan apa pun.
    #:
    #: **Bukan** penentu urutan. Harga dasar sudah berbeda per toko (hash memakai
    #: slug sebagai salt), jadi toko dengan pengali terkecil belum tentu termurah
    #: untuk judul tertentu. Itu disengaja: badge "Termurah" yang selalu jatuh ke
    #: toko yang sama akan terlihat seperti bug saat didemokan.
    multiplier: Decimal = Decimal("1.00")

    #: Toko contoh yang stoknya habis; dipakai untuk melatih badge "Stok habis".
    out_of_stock = False

    def build_search_url(self, keyword: str) -> str:
        """URL yang dijamin tidak resolve; tidak pernah benar-benar dipanggil.

        Kata kuncinya tetap di-escape seperti adapter sungguhan. Bukan karena ada
        permintaan yang akan dikirim, melainkan karena URL mentah dengan `&` di
        dalamnya adalah kebiasaan buruk yang cepat menular ke adapter berikutnya.
        """
        return f"https://{UNRESOLVABLE_HOST}/{self.slug}?q={quote_plus(keyword or '')}"

    async def fetch(
        self,
        client,
        *,
        book_title: str,
        keyword: str,
        product_url: str | None = None,
    ) -> FetchResult:
        """Hasilkan satu harga contoh tanpa menyentuh jaringan."""
        return FetchResult(
            marketplace=self.slug,
            label=self.label,
            title=f"{book_title} — contoh data",
            price=_price_for(book_title, salt=self.slug, multiplier=self.multiplier),
            # `None`, bukan URL palsu: tidak ada halaman yang bisa dibuka, jadi
            # lebih baik tidak ada tautan sama sekali daripada tautan buntu.
            url=None,
            seller=f"{self.label} (contoh)",
            in_stock=not self.out_of_stock,
            # Nol karena tidak ada judul yang benar-benar dicocokkan — bukan
            # karena pencocokannya gagal. Bedanya penting saat membaca data.
            match_score=0.0,
            source="mock",
        )

    def parse(self, text: str, page_url: str) -> list[_Candidate]:
        """Tidak dipakai: `fetch` tidak pernah membaca halaman."""
        raise NotImplementedError("Adapter contoh tidak membaca halaman.")


class DemoStoreAAdapter(DemoStoreAdapter):
    """Toko contoh termurah."""

    slug = "demo_store_a"
    label = "Demo Store A"
    multiplier = Decimal("0.85")


class DemoStoreBAdapter(DemoStoreAdapter):
    """Toko contoh di tengah."""

    slug = "demo_store_b"
    label = "Demo Store B"
    multiplier = Decimal("1.00")


class DemoStoreCAdapter(DemoStoreAdapter):
    """Toko contoh termahal, dan stoknya habis — melatih kedua keadaan UI."""

    slug = "demo_store_c"
    label = "Demo Store C"
    multiplier = Decimal("1.15")
    out_of_stock = True
