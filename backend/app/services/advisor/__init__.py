"""Penasihat Buku bertenaga AI — sebagai paket, bukan satu modul besar.

Pembagian tanggung jawab (masing-masing bisa diuji sendiri):

- `preferences` — aturan penggabungan preferensi kumulatif dan kesiapan
  rekomendasi. Murni, tanpa I/O.
- `ranking` — filter berbobot atas sinyal yang datanya tersedia. Murni.
- `catalog` — satu-satunya jalan membaca katalog (`books` + `categories`).
- `session` — state percakapan per pengguna (in-memory, ber-TTL).
- `gemini` — klien Google AI Studio (Gemini) dan penyusunan prompt.
- `validation` — batas antara keluaran model dan data backend.
- `service` — orkestrasi satu giliran percakapan.

Bentuknya mengikuti "service ber-ketergantungan" di `app/services/__init__.py`:
repository dan klien model disuntikkan lewat konstruktor supaya pengujian
dapat memakai katalog/model palsu tanpa database maupun API berbayar.
"""
