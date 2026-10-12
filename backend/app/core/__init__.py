"""Konfigurasi, keamanan, dan utilitas bersama.

- `config` — `Settings` yang membaca variabel lingkungan/`.env`.
- `security` — verifikasi token Supabase dan dependency otorisasi
  (`get_current_user`, `require_admin`, `require_user`).
- `supabase` — klien service-role dan anon untuk PostgREST/Storage/Auth.
- `shipping` — tarif ongkir sisi server; sumber kebenaran biaya pengiriman.
"""
