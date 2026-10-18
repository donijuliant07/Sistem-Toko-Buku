"""Klien scraper: harga dari service Playwright (`scraper-service`).

Chromium tidak dijalankan di proses backend: satu permintaan yang menunggu
Chromium menahan worker FastAPI 15-25 detik dan memakai ratusan MB memori.
Sebagai gantinya backend memanggil service scraper lewat HTTP
(`POST {SCRAPER_SERVICE_URL}/scrape`) dan menyimpan hasilnya sebagai snapshot.

Dua pengaman yang penting:

- **Batas waktu** (`SCRAPER_TIMEOUT_SECONDS`) selalu lebih kecil dari batas
  total perbandingan (`SCRAPE_TIMEOUT_SECONDS`), sehingga backend sempat
  melaporkan "scraper lambat" alih-alih kehabisan waktu tanpa pesan.
- **Hasil divalidasi ulang** dengan `filtering.select_best_offer`. Service
  scraper dan backend bisa berbeda versi; yang menentukan harga yang tampil
  tetap aturan backend.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx

from app.core.config import settings
from app.services.marketplace.base import AdapterError, FetchResult
from app.services.marketplace.filtering import Offer, select_best_offer
from app.services.marketplace.registry import marketplace_label

logger = logging.getLogger(__name__)

#: Slug yang bisa diisi service scraper (marketplace e-commerce di worker).
SCRAPER_SUPPORTED_SLUGS = (
    "tokopedia",
    "lazada",
    "blibli",
    "gramedia",
    "periplus",
    "shopee",
)

@dataclass(slots=True)
class PrefetchOutcome:
    """Hasil satu panggilan scraper: penawaran per slug dan alasan yang gagal."""

    offers: dict[str, FetchResult]
    failures: list[str]

def _parse_price(raw: Any) -> Decimal | None:
    try:
        value = Decimal(str(raw))
    except (InvalidOperation, ValueError):
        return None
    return value if value > 0 else None

def _to_fetch_result(marketplace: str, raw: dict[str, Any], *, book_title: str) -> FetchResult | None:
    """Ubah satu penawaran dari service scraper menjadi `FetchResult`, setelah disaring ulang."""
    title = str(raw.get("title") or "").strip()
    price = _parse_price(raw.get("price"))
    if not title or price is None:
        return None

    offer = Offer(title=title, price=price, in_stock=raw.get("in_stock"))
    if select_best_offer([offer], book_title) is None:
        return None

    try:
        match_score = float(raw.get("match_score") or 0.0)
    except (TypeError, ValueError):
        match_score = 0.0

    url = raw.get("product_url")
    return FetchResult(
        marketplace=marketplace,
        label=marketplace_label(marketplace),
        title=title,
        price=price,
        url=str(url)[:2048] if url else None,
        seller=str(raw["seller_name"])[:255] if raw.get("seller_name") else None,
        in_stock=raw.get("in_stock"),
        match_score=match_score,
        source="search",
    )

def parse_scrape_response(
    payload: dict[str, Any],
    *,
    book_title: str,
    wanted_slugs: tuple[str, ...] | None = None,
) -> PrefetchOutcome:
    """Baca respons `POST /scrape` milik service scraper."""
    offers: dict[str, FetchResult] = {}
    for marketplace, raw in (payload.get("offers") or {}).items():
        if marketplace not in SCRAPER_SUPPORTED_SLUGS or not isinstance(raw, dict):
            continue
        result = _to_fetch_result(marketplace, raw, book_title=book_title)
        if result is not None:
            offers[marketplace] = result

    raw_failures: dict[str, Any] = payload.get("failures") or {}
    failures = [
        str(message)
        for message in raw_failures.values()
        if message
    ]

    if wanted_slugs:
        failures.extend(
            f"{marketplace_label(slug)}: tidak ada penawaran."
            for slug in wanted_slugs
            if slug not in offers and slug not in raw_failures
        )

    return PrefetchOutcome(offers=offers, failures=failures)

class ScraperServiceClient:
    """Memanggil service scraper Playwright lewat HTTP."""

    def __init__(
        self,
        *,
        url: str | None = None,
        token: str | None = None,
        timeout_seconds: float | None = None,
    ) -> None:
        self._url = (url if url is not None else settings.SCRAPER_SERVICE_URL).rstrip("/")
        self._token = token if token is not None else settings.SCRAPER_API_TOKEN
        self._timeout = timeout_seconds or settings.SCRAPER_TIMEOUT_SECONDS

    @property
    def is_configured(self) -> bool:
        """Apakah alamat service scraper diatur."""
        return bool(self._url)

    async def search_prices(
        self,
        client: httpx.AsyncClient,
        *,
        book_title: str,
        author: str | None = None,
        keywords: dict[str, str] | None = None,
        wanted_slugs: tuple[str, ...] = SCRAPER_SUPPORTED_SLUGS,
    ) -> PrefetchOutcome:
        """Scrape satu buku di service scraper; kembalikan penawaran yang lolos saringan."""
        if not self.is_configured:
            raise AdapterError("Service scraper belum dikonfigurasi (SCRAPER_SERVICE_URL kosong).")

        wanted = tuple(slug for slug in wanted_slugs if slug in SCRAPER_SUPPORTED_SLUGS)
        if not wanted:
            return PrefetchOutcome(offers={}, failures=[])

        body = {
            "title": book_title,
            "author": author,
            "keywords": {
                slug: keywords[slug] for slug in wanted if keywords and slug in keywords
            },
        }
        headers = {"X-Scraper-Token": self._token} if self._token else {}

        try:
            response = await client.post(
                f"{self._url}/scrape",
                json=body,
                headers=headers,
                timeout=self._timeout,
            )
        except httpx.TimeoutException as exc:
            raise AdapterError(
                f"Scraper melewati batas waktu {self._timeout:.0f} detik."
            ) from exc
        except httpx.RequestError as exc:
            raise AdapterError("Service scraper tidak bisa dihubungi.") from exc

        if response.status_code == 429:
            raise AdapterError("Service scraper sedang sibuk; mencoba lagi nanti.")
        if response.status_code >= 400:
            raise AdapterError(f"Service scraper menolak permintaan (HTTP {response.status_code}).")

        try:
            payload = response.json()
        except ValueError as exc:
            raise AdapterError("Respons service scraper tidak bisa dibaca.") from exc

        return parse_scrape_response(payload, book_title=book_title, wanted_slugs=wanted)
