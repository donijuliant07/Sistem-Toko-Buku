"""Kontrak adapter marketplace: satu antarmuka untuk semua sumber harga.

Marketplace berbeda-beda, tetapi yang dibutuhkan service orkestrasi selalu sama:
*diberi judul buku, kembalikan satu harga terbaik beserta URL-nya*. Perbedaan
itu karena itu dikurung di dalam adapter, dan yang sama ditulis sekali di induk
ini — inilah *template method*: `fetch` mengatur urutannya (tentukan URL → ambil
halaman → baca harga → pilih kandidat terbaik → nilai kecocokannya), sementara
subclass hanya mengisi bagian yang memang khas marketplace-nya.

Pembacaan harga sengaja memakai **data terstruktur yang disediakan halaman**
(JSON-LD `schema.org/Product` dan meta tag Open Graph), bukan menebak struktur
DOM. Alasannya praktis: struktur DOM berubah setiap kali marketplace mengubah
tampilannya, sedangkan data terstruktur adalah kontrak yang mereka jaga sendiri
untuk mesin pencari.

Batas yang tegas: adapter **tidak** menembus proteksi anti-bot. Bila marketplace
menolak permintaan biasa, itu dilaporkan sebagai `AdapterError` dan marketplace
tersebut hanya muncul di `warnings` — tidak menggagalkan seluruh perbandingan.
"""

from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from difflib import SequenceMatcher
from html.parser import HTMLParser

import httpx

#: Ambang kecocokan judul. Pencarian otomatis tanpa ambang akan dengan senang hati
#: memasangkan "Bumi Manusia" dengan "Bumi Terbelah"; ambang ini yang mencegahnya.
MATCH_THRESHOLD = 0.55

#: Batas waktu satu permintaan HTTP. Marketplace yang lambat lebih baik dilaporkan
#: gagal daripada menahan respons perbandingan sampai timeout default httpx (5 menit).
REQUEST_TIMEOUT = 12.0

#: Identifikasi diri yang jelas. Marketplace berhak tahu siapa yang memanggil.
USER_AGENT = "InforBookPriceCompare/1.0 (+https://inforbook.example; kontak: admin@inforbook.example)"


class AdapterError(RuntimeError):
    """Kegagalan yang wajar terjadi (diblokir, halaman berubah, harga tak ada).

    Dibedakan dari bug pemrograman supaya service orkestrasi bisa menangkapnya
    menjadi `warnings` tanpa ikut menelan kesalahan asli (mis. `TypeError`) yang
    justru perlu terlihat.
    """


@dataclass(slots=True)
class FetchResult:
    """Satu harga dari satu marketplace, dalam bentuk yang seragam."""

    marketplace: str
    label: str
    title: str
    price: Decimal
    url: str | None = None
    seller: str | None = None
    in_stock: bool | None = None
    match_score: float = 0.0
    source: str = "search"

    def as_snapshot(self, book_id: str) -> dict:
        """Bentuk baris `marketplace_prices` untuk disimpan sebagai riwayat."""
        return {
            "book_id": book_id,
            "marketplace": self.marketplace,
            "price": self.price,
            "currency": "IDR",
            "product_url": self.url,
            "product_title": self.title[:512] if self.title else None,
            "seller_name": self.seller[:255] if self.seller else None,
            "in_stock": self.in_stock,
            "match_score": Decimal(str(round(self.match_score, 3))),
            "source": self.source,
            "fetched_at": datetime.now(UTC),
        }


# ---------------------------------------------------------------------------
# Normalisasi harga dan judul
# ---------------------------------------------------------------------------

_NUMBER = re.compile(r"\d[\d.,]*")


def normalize_price(raw: object) -> Decimal | None:
    """Ubah teks harga apa pun menjadi `Decimal`, atau `None` bila tak terbaca.

    Menangani bentuk yang benar-benar muncul di halaman Indonesia (`Rp125.000`,
    `Rp 1.250.000,50`, `IDR 125000`) maupun format asing (`$12.99`).

    Aturan yang dipakai, berurutan:

    1. Angka asli dari JSON (`125000`, `125000.5`) dibaca langsung — tidak ada
       teks untuk ditafsirkan, jadi tidak ada ruang salah tebak.
    2. Kalau `.` dan `,` sama-sama ada, yang **terakhir** adalah desimal
       (`1.250.000,50` → 1250000,50; `1,234.50` → 1234,50) dan yang lain
       pemisah ribuan.
    3. Kalau hanya ada satu jenis pemisah dan muncul lebih dari sekali, semuanya
       pemisah ribuan (`1.250.000`).
    4. Kalau muncul sekali: diikuti tepat tiga digit → pemisah ribuan
       (`125.000` → 125000); selain itu → desimal (`12.99`).

    Batas yang diakui: aturan 4 membuat harga berdesimal tiga angka (`12.500`
    sebagai dua belas koma lima) terbaca 12500. Untuk harga buku berdenominasi
    rupiah bentuk itu tidak muncul, dan tidak ada cara membedakannya tanpa
    konteks lokal.
    """
    if isinstance(raw, Decimal):
        return raw if raw > 0 else None
    if isinstance(raw, (int, float)):
        value = Decimal(str(raw))
        return value if value > 0 else None
    if raw is None:
        return None

    match = _NUMBER.search(str(raw).strip())
    if not match:
        return None
    digits = match.group(0)

    if "." in digits and "," in digits:
        decimal_sep = "." if digits.rfind(".") > digits.rfind(",") else ","
        thousands_sep = "," if decimal_sep == "." else "."
        digits = digits.replace(thousands_sep, "").replace(decimal_sep, ".")
    elif digits.count(",") + digits.count(".") > 1:
        digits = digits.replace(",", "").replace(".", "")
    elif "," in digits or "." in digits:
        sep = "," if "," in digits else "."
        head, _, tail = digits.partition(sep)
        # Tiga digit di belakang pemisah = ribuan, bukan desimal.
        digits = digits.replace(sep, "") if len(tail) == 3 else f"{head}.{tail}"

    try:
        value = Decimal(digits)
    except InvalidOperation:
        return None
    return value if value > 0 else None


def title_similarity(book_title: str, candidate: str) -> float:
    """Skor kemiripan 0..1 antara judul buku dan judul hasil pencarian.

    Perbandingan dilakukan pada bentuk yang sudah dinormalkan (huruf kecil, tanpa
    tanda baca, spasi dirapikan) supaya perbedaan format seperti `"Bumi Manusia"`
    vs `"BUMI MANUSIA - Pramoedya"` tidak dihukum. Judul yang saling memuat
    diberi skor tinggi karena pola itu justru yang paling sering benar.
    """
    left, right = _normalize_title(book_title), _normalize_title(candidate)
    if not left or not right:
        return 0.0
    if left in right or right in left:
        return 1.0
    return SequenceMatcher(None, left, right).ratio()


def _normalize_title(value: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", " ", (value or "").lower()).strip()


# ---------------------------------------------------------------------------
# Pembacaan halaman
# ---------------------------------------------------------------------------


class _HeadParser(HTMLParser):
    """Kumpulkan `title`, meta tag, dan blok JSON-LD dari sebuah halaman.

    Memakai `html.parser` dari pustaka standar: yang dibutuhkan hanya tiga hal
    itu, dan menambah dependensi parser HTML penuh untuk tiga hal tidak sepadan.
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.meta: dict[str, str] = {}
        self.json_ld: list[str] = []
        self._in_title = False
        self._in_json_ld = False
        self._buffer: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key.lower(): (value or "") for key, value in attrs}
        if tag == "meta":
            key = (attributes.get("property") or attributes.get("name") or "").lower()
            content = attributes.get("content")
            if key and content and key not in self.meta:
                self.meta[key] = content
        elif tag == "title":
            self._in_title = True
        elif tag == "script" and "ld+json" in attributes.get("type", "").lower():
            self._in_json_ld = True
            self._buffer = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        elif tag == "script" and self._in_json_ld:
            self._in_json_ld = False
            self.json_ld.append("".join(self._buffer))

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data
        elif self._in_json_ld:
            self._buffer.append(data)


@dataclass(slots=True)
class _Candidate:
    """Kandidat mentah sebelum dinilai: harga wajib, sisanya boleh kosong."""

    title: str = ""
    price: Decimal | None = None
    url: str | None = None
    seller: str | None = None
    in_stock: bool | None = None
    extra: dict = field(default_factory=dict)


_PRICE_META_KEYS = (
    "product:price:amount",
    "og:price:amount",
    "twitter:data1",
    "price",
)
_TITLE_META_KEYS = ("og:title", "twitter:title")


def _candidates_from_meta(parser: _HeadParser, page_url: str) -> list[_Candidate]:
    """Kandidat dari meta tag Open Graph; jalur cadangan yang hampir selalu ada."""
    price = None
    for key in _PRICE_META_KEYS:
        price = normalize_price(parser.meta.get(key))
        if price is not None:
            break
    if price is None:
        return []

    title = ""
    for key in _TITLE_META_KEYS:
        if parser.meta.get(key):
            title = parser.meta[key]
            break
    title = title or parser.title.strip()
    return [
        _Candidate(
            title=title,
            price=price,
            url=parser.meta.get("og:url") or page_url,
            seller=parser.meta.get("og:site_name") or None,
        )
    ]


def _candidates_from_json_ld(blocks: list[str]) -> list[_Candidate]:
    """Kandidat dari JSON-LD `schema.org/Product` — sumber paling akurat."""
    candidates: list[_Candidate] = []
    for block in blocks:
        try:
            payload = json.loads(block.strip())
        except (json.JSONDecodeError, ValueError):
            continue
        for node in _walk_json_ld(payload):
            if str(node.get("@type", "")).lower() != "product":
                continue
            price = _price_from_offers(node)
            if price is None:
                continue
            candidates.append(
                _Candidate(
                    title=str(node.get("name") or ""),
                    price=price,
                    url=node.get("url") or None,
                    seller=_seller_from_offers(node),
                    in_stock=_availability_from_offers(node),
                )
            )
    return candidates


def _walk_json_ld(payload: object) -> list[dict]:
    """Ratakan JSON-LD menjadi daftar dict, termasuk di dalam `@graph` dan list."""
    if isinstance(payload, list):
        return [node for item in payload for node in _walk_json_ld(item)]
    if isinstance(payload, dict):
        nodes = [payload]
        graph = payload.get("@graph")
        if graph is not None:
            nodes.extend(_walk_json_ld(graph))
        return nodes
    return []


def _offers_of(node: dict) -> list[dict]:
    return _walk_json_ld(node.get("offers"))


def _price_from_offers(node: dict) -> Decimal | None:
    """Harga dari `offers`, yang bisa dict tunggal, list, atau `AggregateOffer`."""
    for offer in _offers_of(node):
        for key in ("price", "lowPrice", "highPrice"):
            price = normalize_price(offer.get(key))
            if price is not None:
                return price
    return normalize_price(node.get("price"))


def _seller_from_offers(node: dict) -> str | None:
    for offer in _offers_of(node):
        seller = offer.get("seller")
        if isinstance(seller, dict) and seller.get("name"):
            return str(seller["name"])
        if isinstance(seller, str) and seller:
            return seller
    return None


def _availability_from_offers(node: dict) -> bool | None:
    """`None` berarti tidak diketahui, yang berbeda dari `False` (habis)."""
    for offer in _offers_of(node):
        value = str(offer.get("availability") or "").lower()
        if not value:
            continue
        if "outofstock" in value or "soldout" in value:
            return False
        if "instock" in value or "limitedavailability" in value:
            return True
    return None


# ---------------------------------------------------------------------------
# Kontrak adapter
# ---------------------------------------------------------------------------


class MarketplaceAdapter(ABC):
    """Satu marketplace. Subclass mengisi identitas dan cara mencari halamannya.

    `fetch` sengaja **konkret**: alur tentukan-URL → ambil → baca → pilih terbaik
    sama untuk semua marketplace. Adapter yang responsnya bukan HTML (mis. API
    JSON) cukup meng-override `parse`, dan yang punya aturan kecocokan berbeda
    cukup menaikkan `match_threshold`.
    """

    #: Slug unik; harus cocok dengan CHECK constraint di tabel.
    slug: str = ""
    #: Nama tampilan untuk UI berbahasa Indonesia.
    label: str = ""
    #: Ambang kecocokan judul; marketplace berjudul berantakan boleh menaikkannya.
    match_threshold: float = MATCH_THRESHOLD

    @abstractmethod
    def build_search_url(self, keyword: str) -> str:
        """URL halaman pencarian untuk `keyword`."""
        raise NotImplementedError

    def parse(self, text: str, page_url: str) -> list[_Candidate]:
        """Baca kandidat harga dari respons.

        Default: JSON-LD dulu (paling akurat — memuat harga, ketersediaan, dan
        penjual sekaligus), lalu meta tag Open Graph sebagai cadangan.
        """
        parser = _HeadParser()
        parser.feed(text)
        candidates = _candidates_from_json_ld(parser.json_ld)
        return candidates or _candidates_from_meta(parser, page_url)

    def pick_best(self, book_title: str, candidates: list[_Candidate]) -> tuple[_Candidate, float]:
        """Pilih kandidat dengan kecocokan judul terbaik, beserta skornya.

        Kalau **tidak satu pun** kandidat punya judul, ambang kecocokan dilewati:
        halaman produk yang dituju admin tidak selalu menyertakan `og:title`, dan
        menolaknya berarti menolak harga yang sebenarnya sah.

        Selain kasus itu, kandidat terbaik wajib melewati ambang. Inilah yang
        menjaga pencarian otomatis dari salah cocok.
        """
        if not candidates:
            raise AdapterError(f"Harga tidak ditemukan di halaman {self.label}.")

        scored = [
            (candidate, title_similarity(book_title, candidate.title)) for candidate in candidates
        ]
        candidate, score = max(scored, key=lambda pair: pair[1])
        if score < self.match_threshold and any(item.title for item, _ in scored):
            raise AdapterError(
                f"Hasil {self.label} tidak cocok dengan judul buku (skor {score:.2f})."
            )
        return candidate, score

    async def fetch(
        self,
        client: httpx.AsyncClient,
        *,
        book_title: str,
        keyword: str,
        product_url: str | None = None,
    ) -> FetchResult:
        """Ambil harga terbaik untuk satu buku.

        `product_url` (diisi admin) menang atas pencarian: link produk sudah pasti
        menunjuk buku yang benar, jadi hasilnya diambil tanpa pencarian sama
        sekali. Sebaliknya, pencarian otomatis wajib lolos ambang kecocokan.
        """
        target = product_url or self.build_search_url(keyword)
        source = "admin_url" if product_url else "search"
        try:
            response = await client.get(target, timeout=REQUEST_TIMEOUT)
        except httpx.HTTPError as exc:
            raise AdapterError(f"{self.label} tidak bisa dihubungi ({exc.__class__.__name__}).") from exc

        if response.status_code >= 400:
            raise AdapterError(f"{self.label} menolak permintaan (HTTP {response.status_code}).")

        candidate, score = self.pick_best(book_title, self.parse(response.text, str(response.url)))
        if candidate.price is None:
            raise AdapterError(f"Harga tidak terbaca dari halaman {self.label}.")

        return FetchResult(
            marketplace=self.slug,
            label=self.label,
            title=candidate.title or book_title,
            price=candidate.price,
            url=candidate.url or target,
            seller=candidate.seller,
            in_stock=candidate.in_stock,
            match_score=score,
            source=source,
        )


def build_client() -> httpx.AsyncClient:
    """Klien HTTP bersama untuk satu kali perbandingan.

    Dibuat sekali per permintaan (bukan per marketplace) supaya koneksi dipakai
    ulang, dan ditutup oleh pemanggilnya sehingga tidak ada klien yang menggantung.
    """
    return httpx.AsyncClient(
        follow_redirects=True,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
            "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
        },
    )
