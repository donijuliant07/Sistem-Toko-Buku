# AI Book Advisor (Penasihat Buku)

Fitur rekomendasi buku berbasis percakapan. Pengguna menyebut minat, level, dan
anggaran; backend mencarikan kandidat **dari katalog toko** dan model AI hanya
menjelaskan kecocokannya. Model tidak pernah menjadi sumber harga, stok, atau ID
buku.

## Alur singkat

```
POST /api/v1/book-advisor/chat
   │
   ├─ preferensi belum cukup ─► satu panggilan model (ekstraksi)
   │                            └► balas pertanyaan lanjutan
   └─ preferensi cukup ───────► SQL: books JOIN categories (filter anggaran/stok/buku tidak disukai)
                              ─► ranking berbobot (murni, tanpa model)
                              ─► satu panggilan model (penjelasan atas kandidat)
                              ─► validasi keluaran (ID, alasan, panjang teks)
                              ─► balas rekomendasi + alasan
```

Setiap giliran memanggil model **satu kali**. Kandidat yang dikirim ke model
maksimal 10, yang ditampilkan maksimal 5.

## Percakapan natural

Advisor dirancang **mengobrol**, bukan melayani formulir:

- Model diminta membalas seperti pustakawan ramah: menanggapi sapaan, terima
  kasih, atau kebingungan lebih dulu, baru mengarahkan ke buku. Satu pertanyaan
  lanjutan per balasan.
- `assistant_message` dari model dipakai apa adanya sebagai `assistant_message`
  respons. Backend hanya menambal bila model tidak memberi kalimat sama sekali
  atau mengulang pertanyaan identik yang baru saja ditanyakan.
- Field `conversation_intent` (`collecting_preferences` | `ready_to_recommend` |
  `chit_chat`). Saat `chit_chat`, backend **tidak** menembak daftar buku walau
  preferensi lama sudah lengkap; status sesi tetap `collecting_preferences` atau
  `ready_to_recommend` sesuai kelengkapan preferensi.
- Mode tanpa API key tetap terasa ramah: sapaan ("halo", "selamat malam") dan
  terima kasih dibalas kalimat, dan preferensi yang baru tertangkap dikonfirmasi
  ("Siap, aku catat minatmu soal investasi…"). Ringkasan rekomendasi menyebut
  dua pilihan teratas, alasan backend, dan harga, lalu mengajak mempersempit.
- Suhu model `0.6` supaya bahasa lebih luwes; nilai ini bukan jaminan fakta —
  fakta tetap datang dari backend.

## Arsitektur modul

| Modul | Tanggung jawab |
| :--- | :--- |
| `app/api/v1/book_advisor.py` | Endpoint, autentikasi, terjemahan error → HTTP |
| `app/services/advisor/service.py` | Orkestrasi satu giliran percakapan |
| `app/services/advisor/preferences.py` | Penggabungan preferensi kumulatif, kesiapan rekomendasi |
| `app/services/advisor/ranking.py` | Filter berbobot + tie-break (murni) |
| `app/services/advisor/catalog.py` | Satu-satunya akses baca `books`/`categories` |
| `app/services/advisor/session.py` | State sesi per pengguna (in-memory, TTL) |
| `app/services/advisor/gemini.py` | Klien Google AI Studio (Gemini) async + prompt |
| `app/services/advisor/validation.py` | Batas antara keluaran model dan data backend |
| `app/schemas/book_advisor.py` | Model preferensi, kandidat, kontrak API |
| `app/schemas/advisor_preferences.py` | Payload `PATCH /preferences` |

## Model preferensi

Semua field opsional. `null` berarti **belum diketahui**; daftar kosong berarti
belum ada isinya.

`interests`, `genres`, `reading_level` (beginner/intermediate/advanced),
`reading_goals`, `preferred_style` (practical/theoretical/narrative/illustrative),
`preferred_language`, `min_budget`, `max_budget`, `preferred_length`
(short/medium/long), `favorite_authors`, `liked_books`, `disliked_books`,
`format_preferences`, `availability_preferences` (`in_stock_only`).

Aturan penggabungan (`preferences.merge_preferences`):

- Field `null` pada delta tidak mengubah nilai lama → "cari yang lebih murah"
  hanya mengubah `max_budget`.
- Daftar digabung sebagai himpunan (case-insensitive). `reset_interests: true`
  (dari model) atau `PATCH` mengganti daftar minat.
- Bila `min_budget` lama > `max_budget` baru, `min_budget` dibuang: batas atas
  pengguna adalah syarat wajib.

## Strategi pencarian dan ranking

**Filter keras (SQL, `catalog.py`):** `price <= max_budget`, `price >= min_budget`,
`stock > 0` bila `in_stock_only`, serta buku pada `disliked_books`. Batas keras ini
tidak pernah dilonggarkan oleh skor.

**Ranking (bobot awal, `ranking.DEFAULT_WEIGHTS`):** topik 35%, tingkat pembaca
20%, gaya 20%, anggaran 15%, panjang 10%. Katalog live hanya punya kolom
`title`, `author`, `description`, `price`, `stock`, `category_id` — jadi sinyal
`reading_level`, `style`, dan `length` **tidak diberi skor** dan bobotnya
dikeluarkan dari penyebut. Skor yang dilaporkan adalah "kecocokan pada sinyal
yang diketahui" (0–1), bukan persentase kecocokan.

Topik dicocokkan dengan `TOPIC_SYNONYMS` (kosakata backend) di judul, penulis,
kategori, dan deskripsi, sebagai awal kata utuh ("bisnis" ≠ "bisnisnya").
Penulis favorit yang cocok menaikkan sinyal topik. Tie-break: harga lebih murah
dulu, lalu judul (casefold) — deterministik.

## Kontrak API

Semua endpoint memerlukan Bearer token Supabase dengan `role = 'user'`
(`require_user`) dan dibungkus `ApiResponse` (`sukses`, `pesan`, `data`).

### `POST /api/v1/book-advisor/chat`

```json
{ "message": "Aku ingin belajar bisnis dan startup, masih pemula, budget maksimal Rp150.000", "session_id": null }
```

```json
{
  "sukses": true,
  "pesan": "Pesan berhasil diproses.",
  "data": {
    "session_id": "6f1c…",
    "assistant_message": "…",
    "conversation_state": "showing_recommendations",
    "preferences": { "interests": ["bisnis", "startup"], "reading_level": "beginner", "max_budget": "150000.00", "…": "…" },
    "missing_preferences": ["reading_goals", "favorite_authors"],
    "recommendations": [
      {
        "book": { "id": "…", "title": "Zero to One", "author": "Peter Thiel", "price": "95000.00", "stock": 5, "category": "Bisnis & Keuangan", "cover_url": "…", "description": "…" },
        "reason": "Cocok untuk startup dengan gaya praktis.",
        "score": 0.92
      }
    ],
    "follow_up_question": null
  }
}
```

`conversation_state`: `collecting_preferences` → `ready_to_recommend` →
`showing_recommendations`. Status diputuskan backend. `recommendations` kosong
berarti belum ada kandidat; `follow_up_question` boleh `null`.

- `message`: 1–2000 karakter, kosong ditolak 422.
- `session_id` milik pengguna lain / kedaluwarsa → sesi baru dibuat (tanpa
  mengungkap keberadaan sesi lama).

### `GET /api/v1/book-advisor/sessions/{session_id}/messages`

Riwayat sesi milik pemanggil. Sesi lain / UUID tidak valid → `404`.

### `GET /api/v1/book-advisor/preferences?session_id=…`

Preferensi sesi. Tanpa `session_id`, mengembalikan profil kosong.

### `PATCH /api/v1/book-advisor/preferences`

```json
{ "session_id": "6f1c…", "interests": ["filsafat"], "max_budget": 120000 }
```

Daftar yang dikirim menggantikan daftar lama; field lain tetap. Sesi orang lain → `404`.

### `POST /api/v1/book-advisor/feedback`

```json
{ "session_id": "6f1c…", "book_id": "…", "feedback": "not_relevant", "reason": "terlalu teoretis" }
```

`not_relevant` menambahkan buku ke `disliked_books` sehingga tidak muncul lagi di
sesi itu.

## Konfigurasi

| Variabel | Default | Keterangan |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | kosong | Kunci Google AI Studio. Tanpa kunci: fallback aturan (kata kunci minat & anggaran), tidak ada panggilan jaringan |
| `GEMINI_MODEL` | `gemini-3.5-flash` | Model Gemini yang dipakai Penasihat Buku |
| `GEMINI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta` | Endpoint `generateContent` |
| `GEMINI_TIMEOUT_SECONDS` | `30` | Batas satu panggilan |
| `GEMINI_MAX_OUTPUT_TOKENS` | `2048` | Batas token keluaran per giliran (termasuk token "berpikir" Gemini 3) |
| `GEMINI_THINKING_BUDGET` | `0` | Token berpikir Gemini 3; `0` = mati, kosong = default provider |

Kunci dikirim lewat header `x-goog-api-key`, bukan query string, agar tidak
tercatat di URL/log. Ulasan AI dan validator harga marketplace tetap memakai
`OPENROUTER_*`; Penasihat Buku tidak lagi membaca variabel itu.

Kuota gratis Gemini dibatasi per model per hari; bila terkena batas (429),
backend otomatis memakai fallback, bukan menampilkan error ke pengguna.

## Menjalankan

```powershell
uv sync
Copy-Item .env.example .env   # isi DATABASE_URL, SUPABASE_*, GEMINI_API_KEY
uv run uvicorn app.main:app --reload
```

Dokumentasi interaktif: `http://localhost:8000/docs` (tag **book-advisor**).

Uji manual dengan akun pelanggan (token dapat dari login Supabase):

```powershell
curl -X POST http://localhost:8000/api/v1/book-advisor/chat `
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" `
  -d '{"message":"Aku ingin belajar bisnis dan startup, masih pemula, budget maksimal Rp150.000"}'
```

Kirim `session_id` dari respons pada pesan berikutnya, misalnya
`"Cari yang lebih murah"` — minat dan level tetap tersimpan.

Catatan lingkungan pengembang: kalau `DATABASE_URL` menunjuk host
`db.<ref>.supabase.co`, baca katalog bisa lambat/gagal — gunakan connection
pooler (lihat komentar di `.env.example`).

## Testing

```powershell
uv run pytest tests/test_book_advisor.py -q
uv run pytest -q
uv run ruff check .
```

`tests/test_book_advisor.py` tidak membutuhkan database maupun API key: katalog
dan model diganti fake, endpoint diuji lewat `app.dependency_overrides`.

## Keamanan

- API key disimpan di `.env` (tidak pernah dicatat ke log; header Authorization
  tidak pernah di-log). `backend/.env` **tidak** masuk git.
- Respons 4xx/5xx/JSON rusak dari Gemini → `AdvisorModelError` → fallback;
  stack trace tidak pernah dikirim ke klien.
- Retry maksimal 1× dan hanya untuk timeout/error jaringan/429/5xx.
- ID buku, harga, stok, dan skor di respons selalu dari backend; ID dari model
  yang tidak ada di kandidat dibuang.
- Judul/deskripsi dikirim ke model sebagai DATA dan prompt melarang
  mengikutinya sebagai instruksi.
- Kepemilikan sesi diperiksa per pengguna; sesi lain dijawab 404.
- Pesan dan riwayat dibatasi (2000 karakter, 20 pesan terkirim ke model).

## Batasan yang perlu diketahui

- **Sesi in-memory.** Hilang saat proses restart dan tidak dibagi antar
  replika (batas 500 sesi, TTL 6 jam). Persistensi ke tabel baru **belum**
  dibuat — sesuai aturan proyek, perubahan skema DB perlu persetujuan dulu.
  Kontrak `AdvisorSessionStore` tinggal diimplementasikan ulang dengan SQL.
- **Tidak ada rate limiting per pengguna** untuk endpoint ini. Pola cooldown
  in-memory sudah ada di `marketplaces.py` dan bisa ditiru bila pemakaian nyata
  meningkat.
- **Metadata katalog terbatas.** Tidak ada bahasa, jumlah halaman, format, atau
  genre terpisah; karena itu preferensi tersebut disimpan tetapi tidak dipakai
  memberi skor. Katalog live juga punya `category_id` dan `weight_gram` yang
  belum ada di model/migrasi repo — fitur ini membaca lewat SQL eksplisit agar
  tidak memaksa migrasi baru.
- **Tidak ada tabel preferensi persisten per pengguna.** Profil preferensi
  hidup per sesi.
