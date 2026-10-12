"""Endpoint versi 1 (`/api/v1`).

Setiap modul mewakili satu kelompok resource:

- `auth` — login, registrasi, dan profil pengguna yang sedang masuk.
- `books` — katalog buku (publik) dan CRUD admin; satu-satunya pemakai SQLAlchemy.
- `categories` — kategori produk.
- `cart` — keranjang pelanggan.
- `orders` — pesanan dan layanan pengiriman.
- `inventory` — penyesuaian stok dan riwayat pergerakan.
- `dashboard` — KPI, grafik, dan laporan admin.
- `promos` — voucher/diskon.
- `uploads` — unggah gambar ke Supabase Storage.

Modul-modul ini dirangkai menjadi satu aplikasi di `app.main`.
"""
