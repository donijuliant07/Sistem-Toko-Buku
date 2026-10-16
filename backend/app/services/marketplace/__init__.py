"""Perbandingan harga lintas marketplace: adapter, registry, dan orkestrasinya.

Isi paket ini, dari yang paling umum ke paling khusus:

- `base.py` — `MarketplaceAdapter(ABC)`, `FetchResult`, dan util bersama
  (normalisasi harga, skor kemiripan judul, pembacaan JSON-LD/meta tag).
- `adapters/catalog.py` — satu class per marketplace; masing-masing hanya
  mengisi identitas dan `build_search_url`.
- `registry.py` — daftar adapter yang tersedia, plus pencarian label/slug.
- `service.py` — `MarketplaceComparisonService`, yang menyatukan sumber yang
  dikonfigurasi admin, cache snapshot, dan riwayat harga menjadi satu respons.
"""

from app.services.marketplace.base import (
    AdapterError,
    FetchResult,
    MarketplaceAdapter,
    build_client,
    normalize_price,
    title_similarity,
)
from app.services.marketplace.registry import (
    get_adapter,
    marketplace_label,
    supported_marketplaces,
)
from app.services.marketplace.service import MarketplaceComparisonService, build_service

__all__ = [
    "AdapterError",
    "FetchResult",
    "MarketplaceAdapter",
    "MarketplaceComparisonService",
    "build_client",
    "build_service",
    "get_adapter",
    "marketplace_label",
    "normalize_price",
    "supported_marketplaces",
    "title_similarity",
]
