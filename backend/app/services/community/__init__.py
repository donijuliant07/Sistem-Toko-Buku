"""Book Community sebagai paket, bukan router raksasa.

Pembagian tanggung jawab (masing-masing bisa diuji sendiri):

- `permissions` — matriks izin murni, tanpa I/O. Satu-satunya tempat keputusan
  "boleh/tidak" ditulis; service hanya menyiapkan datanya.
- `repository` — satu-satunya jalur SQL (`OrmGroupRepository`,
  `OrmMemberRepository`, `OrmMessageRepository`) lewat `AsyncSession` milik
  permintaan.
- `errors` — `CommunityError` berisi kode HTTP + pesan Bahasa Indonesia, sehingga
  service tidak bergantung pada FastAPI.
- `rate_limit` — pembatas pengiriman pesan in-memory per proses.
- `group_service`, `member_service`, `message_service` — orkestrasi:
  otorisasi → repository → bentuk respons.

**Keamanan:** klien database backend memakai service role yang *melewati* RLS.
Karena itu otorisasi **selalu** dijalankan di sini; policy RLS di database hanya
lapis kedua untuk jalur baca Realtime di browser. Identitas pengirim dan role
tidak pernah diambil dari body permintaan.

Bentuknya mengikuti paket lain di `app/services/`: dependensi disuntikkan lewat
konstruktor (atau `build_*` di layer API) supaya pengujian dapat memakai
repository palsu tanpa database.
"""
