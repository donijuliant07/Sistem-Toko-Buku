# Bookstore API

## Setup

```powershell
uv sync
Copy-Item .env.example .env
```

Set Supabase and PostgreSQL values in `.env`.

## Database migration

Apply the profiles table and Supabase Auth profile trigger after reviewing the SQL:

```powershell
uv run alembic upgrade head
```

The migration links `profiles.id` to `auth.users.id`, defaults role to `user`, and creates `public.handle_new_user()` for new Auth users. Promote an account to admin directly in Supabase SQL Editor:

```sql
UPDATE public.profiles SET role = 'admin' WHERE id = 'SUPABASE_USER_UUID';
```

## Run

```powershell
uv run main.py
```

`main.py` membaca `HOST`/`PORT` dari `.env` (default `0.0.0.0:8000`) dan membuka
`--reload`. Padanan perintah langsung:

```powershell
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

> Windows: `--host 0.0.0.0` (IPv4) membuat backend dapat dihubungi dari perangkat
> lain di Wi-Fi yang sama. Browser yang me-resolve `localhost` ke IPv6 (`::1`)
> bisa gagal menghubungi backend, jadi buka frontend lewat
> `http://localhost:3000` **atau** `http://127.0.0.1:3000` — keduanya sudah ada di
> `FRONTEND_ORIGINS`. `--host ::` **tidak** dipakai: di Windows socket IPv6
> bersifat v6-only, sehingga IPv4 ikut mati. Untuk pengembangan, `app/main.py`
> juga menerima origin LAN `:3000` (IP privat) agar dev server Next bisa dibuka
> dari mesin lain; port frontend lain didaftarkan di `FRONTEND_ORIGINS`.

### Akses dari perangkat lain (Wi-Fi/LAN)

1. Lihat IP komputer: `ipconfig` → **IPv4 Address** pada adapter Wi-Fi
   (mis. `192.168.1.10`).
2. Jalankan backend (`uv run main.py`) dan frontend (`bun run dev` di `frontend/`;
   Next `next dev` sudah listen di `0.0.0.0`).
3. Dari HP/laptop lain di jaringan yang sama, buka `http://192.168.1.10:3000`.
   Frontend otomatis memanggil backend di `http://192.168.1.10:8000` (atau
   `NEXT_PUBLIC_API_URL` bila diisi).
4. Bila koneksi ditolak padahal backend jalan, izinkan port di Windows Firewall
   (PowerShell **sebagai Administrator**; jaringan privat saja):
   ```powershell
   New-NetFirewallRule -DisplayName "Readr API 8000" -Direction Inbound `
     -Protocol TCP -LocalPort 8000 -Profile Private -Action Allow
   ```
   Firewall bukan urusan CORS: keduanya harus benar agar request sampai.
5. Jangan buka `-Profile Public` atau port-forward router kecuali memang perlu;
   autentikasi tetap berlaku, tetapi backend tidak dirancang untuk internet publik.


Health endpoint: `http://localhost:8000/health`  
Current-user endpoint: `http://localhost:8000/api/v1/me`  
Admin check endpoint: `http://localhost:8000/api/v1/admin/check`  
Book list endpoint: `http://localhost:8000/api/v1/books`  
Swagger UI: `http://localhost:8000/docs`

Send a Supabase access token to protected endpoints:

```powershell
curl.exe http://localhost:8000/api/v1/me -H "Authorization: Bearer ACCESS_TOKEN"
```

## Test and lint

```powershell
uv run pytest
uv run ruff check .
```

## AI Book Advisor

Rekomendasi buku berbasis percakapan (endpoint `/api/v1/book-advisor/*`). Dokumentasi lengkap, kontrak API, strategi ranking, konfigurasi, dan batasan: [BOOK-ADVISOR.md](BOOK-ADVISOR.md).

## Book Community

Grup diskusi buku + chat real-time, buka grup publik, berbagi buku dari katalog (endpoint `/api/v1/community/*`). Skema tabel, matriks izin, mekanisme RLS/Realtime, dan batasan: [COMMUNITY.md](COMMUNITY.md).

```powershell
uv run alembic upgrade head          # menerapkan tabel komunitas (20261019_10)
uv run pytest tests/test_community.py
```
