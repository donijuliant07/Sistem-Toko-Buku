"""Aplikasi backend Sistem Toko Buku.

Paket ini berisi seluruh kode server FastAPI:

- `app.main` — titik masuk aplikasi (pembuatan `FastAPI`, CORS, pemasangan router).
- `app.api.v1` — endpoint HTTP; hanya menangani request/response dan dependency.
- `app.services` — business logic dan aturan bisnis.
- `app.schemas` — validasi dan bentuk data request/response (Pydantic).
- `app.models` — model SQLAlchemy (dipakai terbatas oleh endpoint buku).
- `app.core` — konfigurasi, keamanan/otorisasi, klien Supabase, tarif ongkir.
- `app.db` — engine, sesi, dan base class SQLAlchemy.
"""
