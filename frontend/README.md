# Readr frontend

Next.js frontend for Bookstore API.

## Run locally

Start backend first:

```powershell
cd ..\backend
uv run main.py
```

Then run frontend:

```powershell
cd ..\frontend
bun install
Copy-Item .env.example .env.local
bun run dev
```

Set these public values in `.env.local`:

```text
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

`NEXT_PUBLIC_API_URL` boleh dikosongkan: tanpa nilai itu, URL API diturunkan
dari host halaman — membuka `http://192.168.1.10:3000` memanggil
`http://192.168.1.10:8000/api/v1`. Nilai eksplisit yang menunjuk `localhost`
diabaikan saat halaman dibuka lewat IP LAN, karena `localhost` di HP/tablet
berarti perangkat itu sendiri.

### Dari perangkat lain di Wi-Fi yang sama

1. Lihat IP komputer backend: `ipconfig` → **IPv4 Address** (mis. `192.168.1.10`).
2. Backend harus bind `0.0.0.0` (`HOST` di `backend/.env`, default sudah begitu);
   bila koneksi ditolak, izinkan port 8000 untuk profil **Private** di Windows
   Firewall sesuai `backend/README.md`.
3. `bun run dev` sudah listen di semua antarmuka; buka `http://192.168.1.10:3000`
   dari perangkat lain.
4. Bila aset dev/HMR diblokir Next (pesan "Blocked cross-origin request to
   Next.js dev resource"), set di `.env.local`:
   ```text
   NEXT_DEV_ALLOWED_ORIGINS=192.168.*.*,10.*.*.*
   ```
   lalu restart `bun run dev`. Hanya berlaku di development.

Open `http://localhost:3000`. Existing Supabase Auth users can sign in at `/login`. Admin users can manage books at `/admin/books`; promote an account in Supabase SQL Editor:

```sql
UPDATE public.profiles SET role = 'admin' WHERE id = 'SUPABASE_USER_UUID';
```

## Checks

```powershell
bun run lint
bun run build
```

Public screens include catalog search, pagination, and book details. Auth includes email/password login and logout. Admin CRUD includes create, edit, delete, validation, duplicate ISBN errors, and pagination. Registration, password reset, checkout, and orders are not included.
