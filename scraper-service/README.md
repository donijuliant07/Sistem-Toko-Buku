# Scraper Service (Playwright)

Service berbasis **Python, uv & Playwright** yang mengambil harga buku dari
marketplace Indonesia (**Tokopedia, Lazada, Blibli, Gramedia, Periplus, Shopee**) tanpa
SerpApi. Satu image yang sama punya dua peran:

- **API** (`uv run python -m src.api`) — backend utama memanggil
  `POST /scrape` saat pengguna menekan *Bandingkan Harga*, lalu menyimpan
  hasilnya sebagai snapshot di `marketplace_prices`. Chromium tidak pernah
  dijalankan di proses backend.
- **Cron worker** (`uv run python -m src.main`, opsional) — menyegarkan
  snapshot harga seluruh buku secara berkala.

Dengan arsitektur ini:

- **Backend utama & frontend tetap ramping**: Chromium hidup di service ini,
  bukan di worker FastAPI yang melayani permintaan lain.
- **Batas waktu jelas**: backend memanggil scraper dengan batas yang lebih
  ketat (`SCRAPER_TIMEOUT_SECONDS`, default 20 dtk) daripada batas total
  perbandingan (25 dtk), lalu tetap menampilkan harga terakhir bila gagal.
- **Standar uv**: dependensi dikelola cepat dan konsisten dengan backend utama
  via `pyproject.toml` dan `uv.lock`.

---

## 🛠️ Persiapan Lokal (Local Development)

### 1. Prasyarat

- Python 3.12+
- `uv` ([Panduan instalasi uv](https://docs.astral.sh/uv/getting-started/installation/))

### 2. Setup Environment

Salin template `.env.example` ke `.env`:

```bash
cp .env.example .env
```

- Mode API: cukup isi `SCRAPER_API_TOKEN` (sama dengan `backend/.env`) dan `PORT`.
- Mode cron: isi juga `DATABASE_URL` (connection string Supabase, sama seperti
  `backend/.env`).

### 3. Pasang Dependensi & Browser dengan `uv`

```bash
cd scraper-service

# Pasang virtual environment & dependensi
uv sync

# Pasang browser Chromium Playwright
uv run playwright install chromium
```

### 4. Jalankan Mode API (dipakai backend)

```bash
uv run python -m src.api
```

Server berjalan di `PORT` (default 8001). Isi `backend/.env`:

```env
SCRAPER_SERVICE_URL=http://127.0.0.1:8001
SCRAPER_API_TOKEN=<sama dengan scraper-service/.env>
SCRAPER_TIMEOUT_SECONDS=20
```

Uji cepat (PowerShell):

```powershell
$body = @{ title = "Bumi Manusia"; author = "Pramoedya Ananta Toer" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8001/scrape `
  -Headers @{ "X-Scraper-Token" = "<token>" } -ContentType "application/json" -Body $body
```

Respons: `{"offers": {"tokopedia": {...}}, "failures": {"shopee": "..."}}`.
Panggilan pertama lambat (Chromium baru start, ±40-60 dtk); berikutnya lebih
cepat.

### 5. Jalankan Mode Cron (opsional)

```bash
uv run python -m src.main
```

Browser Chromium mencari buku-buku di kelima marketplace lalu menyisipkan
snapshot harga ke tabel `marketplace_prices`.

Cek parser tanpa browser/network: `uv run python selftest.py`.

---

## 🔎 Bagaimana Tiap Marketplace Diambil

Semua marketplace diambil lewat Playwright langsung. Hasil pencarian disaring
di `src/scrapers/filtering.py` (salinan aturan backend): seluruh kata judul
wajib cocok, judul bertanda paket (`tetralogi`, `set`, `paket`, ...) dan barang
non-buku ditolak, lalu dipilih harga termurah yang wajar dibanding titik
tengah harga kandidat.

| Marketplace | Status | Catatan |
|---|---|---|
| Tokopedia | ✅ Jalan | Butuh UA desktop Chrome eksplisit (`browser.py`) dan `BROWSER_CHANNEL=chromium` (mode headless baru); tanpa itu `ERR_HTTP2_PROTOCOL_ERROR` / 0 kartu. Query wajib `quote_plus` (`+`), bukan `%20`. |
| Lazada | ✅ Jalan | URL `catalog/?q=` dengan `+`; judul dibaca dari atribut `title`. |
| Blibli | ⚠️ Tidak stabil | `/cari/<q>` kadang mengembalikan 0 kartu (deteksi bot). Pencarian memakai varian query pendek. |
| Gramedia | ✅ Jalan | `/search?q=`; kartu produk di `<a href*="/products/">`. Query dipendekkan (tanpa subtitle setelah `:`). |
| Periplus | ✅ Jalan | `/product/Search?filter_name=`; kartu di `<a href*="/p/">`. Katalog cenderung buku import/Inggris. |
| Shopee | ❌ Tidak bisa | Selalu dialihkan ke `/verify/traffic/error` (wajib login). |

Marketplace yang gagal muncul di `failures` sebagai peringatan — tidak
menggagalkan perbandingan.

---

## 🚀 Panduan Deployment ke Railway

Service ini sudah dilengkapi `Dockerfile` resmi berbasis
`mcr.microsoft.com/playwright/python` dan `uv` dari Astral, sehingga build di
Railway cepat dengan *layer caching*.

**Dua service Railway memakai repo dan `Dockerfile` yang sama**, hanya beda
*start command*:

| Service | Start Command | Keterangan |
|---|---|---|
| scraper-api | `uv run python -m src.api` | Dipanggil backend via `SCRAPER_SERVICE_URL`; butuh public domain. |
| scraper-cron (opsional) | `uv run python -m src.main` | Cron schedule; mengakses DB langsung. |

### Langkah 1: Buat Service Baru di Railway

1. Buka [Railway Dashboard](https://railway.com/).
2. Masuk ke project Anda, klik **+ Create** -> **GitHub Repo**.
3. Pilih repository ini (`Sistem-Toko_Buku`).
4. Pada pengaturan **Root Directory**, setel ke: `/scraper-service`.
5. Setel **Start Command** sesuai tabel di atas.

### Langkah 2: Tambahkan Environment Variable

Service API:

```env
PORT=8001
SCRAPER_API_TOKEN=<token acak panjang>
HEADLESS=true
MAX_CONCURRENT_SCRAPES=2
```

Service cron (opsional) juga butuh:

```env
DATABASE_URL=postgresql+asyncpg://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
DELAY_MIN_SECONDS=2.0
DELAY_MAX_SECONDS=5.0
```

Lalu isi di environment backend: `SCRAPER_SERVICE_URL=<domain service API>`
dan `SCRAPER_API_TOKEN` yang sama.

### Langkah 3: Aktifkan Cron Schedule (hanya service cron)

1. Di halaman service Railway, masuk tab **Settings**.
2. Scroll ke bagian **Deploy** -> cari opsi **Cron Schedule**.
3. Masukkan ekspresi cron, misalnya:
   - `0 3 * * *` *(setiap hari pukul 03.00)*
   - `0 */6 * * *` *(setiap 6 jam)*
4. Simpan perubahan.

> **Selesai!** Railway menyalakan container, menjalankan scraping ke Supabase,
> lalu mematikan container setelah selesai.
