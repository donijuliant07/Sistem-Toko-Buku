"""HTTP API scraper: dipakai backend saat pengguna membuka perbandingan harga.

Kenapa HTTP dan bukan backend menjalankan Playwright sendiri: satu permintaan
yang menunggu Chromium menahan worker FastAPI selama 15-25 detik, dan Chromium
membutuhkan ratusan MB memori. Proses ini memisahkan keduanya — backend cukup
memanggil ``POST /scrape`` lalu menyimpan hasilnya sebagai snapshot.

Worker cron (`python -m src.main`) tetap tersedia dan memakai pipeline yang
sama; bedanya, cron menyimpan ke database sendiri.

Jalankan::

    uv run python -m src.api
"""

from __future__ import annotations

import asyncio
import logging
import sys
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Header, HTTPException, status
from pydantic import BaseModel, Field

from src.browser import browser_manager
from src.config import settings
from src.pipeline import scrape_book_offers

logger = logging.getLogger("scraper_api")

@asynccontextmanager
async def lifespan(_: FastAPI):
    """Nyalakan Chromium sekali untuk seluruh umur proses, tutup saat berhenti."""
    await browser_manager.start()
    try:
        yield
    finally:
        await browser_manager.close()

app = FastAPI(title="Scraper Service", version="0.1.0", lifespan=lifespan)

#: Batasi scraping bersamaan: tiap scrape membuka 5 tab Chromium, dan tanpa
#: batas beberapa permintaan bersamaan bisa menghabiskan memori container.
_scrape_slots = asyncio.Semaphore(settings.MAX_CONCURRENT_SCRAPES)

class ScrapeRequest(BaseModel):
    """Satu buku yang hendak dicari harganya."""

    title: str = Field(min_length=1, max_length=512)
    author: str | None = Field(default=None, max_length=255)
    #: Kata kunci per marketplace dari `marketplace_sources.search_keyword`.
    keywords: dict[str, str] = Field(default_factory=dict)

class ScrapeResponse(BaseModel):
    """Penawaran terbaik per marketplace, plus alasan yang tidak dapat penawaran."""

    offers: dict[str, dict]
    failures: dict[str, str]


_CACHE: dict[tuple[str, str, tuple[tuple[str, str], ...]], tuple[float, Any]] = {}
CACHE_TTL_SECONDS = 300.0  # 5 menit

def _cache_key(payload: ScrapeRequest) -> tuple[str, str, tuple[tuple[str, str], ...]]:
    return (
        payload.title.strip().lower(),
        (payload.author or "").strip().lower(),
        tuple(sorted(payload.keywords.items())),
    )

def _format_response(result: Any) -> ScrapeResponse:
    return ScrapeResponse(
        offers={
            slug: {
                "title": item.title,
                "price": str(item.price),
                "product_url": item.product_url,
                "seller_name": item.seller_name,
                "in_stock": item.in_stock,
                "match_score": item.match_score,
            }
            for slug, item in result.offers.items()
        },
        failures=result.failures,
    )

def _check_token(token: str | None) -> None:
    """Tolak permintaan tanpa token bila `SCRAPER_API_TOKEN` diatur."""
    expected = settings.SCRAPER_API_TOKEN
    if expected and token != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token scraper salah.")

@app.get("/health")
async def health() -> dict[str, str]:
    """Penanda hidup untuk Railway healthcheck."""
    return {"status": "ok"}

@app.post("/scrape", response_model=ScrapeResponse)
async def scrape(
    payload: ScrapeRequest,
    x_scraper_token: str | None = Header(default=None),
) -> ScrapeResponse:
    """Scrape satu buku di semua marketplace yang didukung."""
    _check_token(x_scraper_token)
    key = _cache_key(payload)
    now = time.monotonic()
    cached = _CACHE.get(key)
    if cached is not None:
        cached_at, cached_result = cached
        if now - cached_at < CACHE_TTL_SECONDS:
            logger.info(f"Cache hit untuk '{payload.title}'")
            return _format_response(cached_result)

    try:
        await asyncio.wait_for(_scrape_slots.acquire(), timeout=1.0)
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Server scraper sedang sibuk memproses permintaan lain. Silakan coba sesaat lagi.",
            headers={"Retry-After": "5"},
        )

    try:
        result = await scrape_book_offers(payload.title, payload.author, keywords=payload.keywords)
        _CACHE[key] = (time.monotonic(), result)
        if len(_CACHE) > 200:
            current_time = time.monotonic()
            for k, (ts, _) in list(_CACHE.items()):
                if current_time - ts >= CACHE_TTL_SECONDS:
                    _CACHE.pop(k, None)
        return _format_response(result)
    finally:
        _scrape_slots.release()

def run() -> None:
    """Entry point `python -m src.api`."""
    import uvicorn

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        stream=sys.stdout,
    )
    uvicorn.run(app, host="0.0.0.0", port=settings.PORT)

if __name__ == "__main__":
    run()
