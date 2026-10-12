"""Validasi dan bentuk data request/response (Pydantic).

Setiap modul di sini memetakan satu kelompok resource dan dipakai oleh layer API
untuk memvalidasi payload masuk serta membentuk respons keluar. Schema di sini
**bukan** model database: model SQLAlchemy ada di `app.models`, sedangkan tabel
yang dibaca lewat PostgREST tidak memiliki model dan direpresentasikan sebagai
dict oleh service.
"""

from app.schemas.book import BookCreate, BookPage, BookRead, BookUpdate

__all__ = ["BookCreate", "BookPage", "BookRead", "BookUpdate"]
