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

Alternative direct command:

```powershell
uv run uvicorn app.main:app --reload
```

> Windows: `main.py` sudah memakai `--host 0.0.0.0` (IPv4). Browser yang
> me-resolve `localhost` ke IPv6 (`::1`) bisa gagal menghubungi backend, jadi
> buka frontend lewat `http://localhost:3000` **atau** `http://127.0.0.1:3000`
> — keduanya sudah ada di `FRONTEND_ORIGINS`. `--host ::` **tidak** dipakai:
> di Windows socket IPv6 bersifat v6-only, sehingga IPv4 ikut mati. Untuk
> pengembangan, `app/main.py` juga menerima origin LAN `:3000` (IP privat)
> agar dev server Next bisa dibuka dari mesin lain.

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
