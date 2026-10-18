"""Sumber marketplace bawaan untuk sebuah buku.

Kenapa ada: `compare_book` hanya membandingkan marketplace yang punya baris di
`marketplace_sources`. Tanpa baris, service scraper — yang bisa mencari di lima
marketplace sekaligus — tidak pernah dipanggil, dan pembanding harga selalu
kosong. Modul ini membuat baris sumber awal itu secara seragam.

Aturannya sengaja sederhana dan terdokumentasi:

- Hanya marketplace yang didukung scraper (`SCRAPER_SUPPORTED_SLUGS`); slug
  demo tidak pernah ikut, karena harga contoh bukan pembanding sungguhan.
- `product_url` kosong (belum ada link produk saat buku dibuat), sehingga
  `search_keyword` wajib terisi — itulah CHECK `ck_marketplace_sources_target`.
- Kata kunci = judul + penulis. Penulis ikut supaya pencarian tidak terjebak
  pada buku kembar dengan judul sama.

Admin tetap pemegang kendali: baris yang diedit (link produk diisi, atau
dimatikan) tidak ditimpa oleh penyemaian ulang — lihat
`MarketplaceSourceRepository.create_many_if_absent`.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.services.marketplace.scraper_client import SCRAPER_SUPPORTED_SLUGS

#: Batas kolom `search_keyword` (varchar(255)); dipotong di sini supaya tidak
#: berakhir sebagai galat database untuk judul buku yang sangat panjang.
KEYWORD_MAX_LENGTH = 255


def default_keyword(title: str, author: str | None = None) -> str:
    """Kata kunci pencarian awal: judul + penulis, spasi dirapikan dan dipotong."""
    keyword = " ".join(f"{title or ''} {author or ''}".split())
    return keyword[:KEYWORD_MAX_LENGTH]


def build_default_source_rows(
    book_id: UUID | str,
    *,
    title: str,
    author: str | None = None,
) -> list[dict[str, Any]]:
    """Baris `marketplace_sources` awal untuk satu buku, siap disisipkan.

    Bentuknya dict (bukan model ORM) karena repository yang menyisipkan:
    layer ini tidak tahu apa pun tentang sesi database.
    """
    keyword = default_keyword(title, author)
    if not keyword:
        return []
    return [
        {
            "book_id": book_id,
            "marketplace": slug,
            "product_url": None,
            "search_keyword": keyword,
            "is_active": True,
        }
        for slug in SCRAPER_SUPPORTED_SLUGS
    ]
