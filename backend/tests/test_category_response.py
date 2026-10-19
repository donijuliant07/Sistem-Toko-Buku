"""Kontrak respons kategori terhadap skema Supabase yang diverge.

Tabel `categories` di DB live hanya punya `id`, `name`, `slug`; kolom
`type`, `description`, dan `created_at` tidak ada. Respons harus tetap 200
dengan nilai default, bukan 500 ResponseValidationError.
"""

import asyncio
from unittest.mock import patch

import httpx

from app.main import app

ROWS = [
    {"id": "58013a07-c229-4793-adc8-60c2c2f59013", "name": "Agama & Spiritualitas", "slug": "agama-spiritualitas"},
    {"id": "9c25ee92-9212-4443-8a55-7e7343e51a5d", "name": "Biografi & Memoar", "slug": "biografi-memoar", "type": "Non-Buku"},
]


def test_categories_without_optional_columns_return_defaults():
    async def run():
        transport = httpx.ASGITransport(app=app, raise_app_exceptions=True)
        with patch("app.services.category_service.category_service.get_all", return_value=ROWS):
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                return await client.get("/api/v1/categories")

    response = asyncio.run(run())

    assert response.status_code == 200
    data = response.json()["data"]
    assert data[0]["type"] == "Buku"
    assert data[0]["description"] is None
    assert data[0]["created_at"] is None
    assert data[1]["type"] == "Non-Buku"
