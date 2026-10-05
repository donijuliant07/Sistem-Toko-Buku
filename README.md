# Sistem Toko Buku

---

## 🚀 Cara Menjalankan Aplikasi (Startup)

### 1. Prasyarat

- **Node.js:** v20+ / Bun
- **Python:** v3.12+
- **uv:**

---

### 2. Startup Backend (FastAPI)

1. Masuk ke folder backend:
   ```bash
   cd backend
   ```
2. Pasang dependensi:
   ```bash
   uv sync
   ```
3. Salin file environment dan isi kredensial Supabase/PostgreSQL:
   ```bash
   cp .env.example .env
   ```
4. Jalankan migrasi database:
   ```bash
   uv run alembic upgrade head
   ```
5. Jalankan server backend:

   ```bash
   uv run main.py
   # atau
   uv run uvicorn app.main:app --reload --port 8000
   ```

   - **Swagger API Docs:** `http://localhost:8000/docs`
   - **API Health:** `http://localhost:8000/api/v1/health`

---

### 3. Startup Frontend (Next.js)

1. Masuk ke folder frontend:
   ```bash
   cd frontend
   ```
2. Pasang dependensi:
   ```bash
   npm install
   ```
3. Konfigurasi environment `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
4. Jalankan frontend development server:
   ```bash
   npm run dev
   ```
5. Buka di browser: `http://localhost:3000`

---

## 🗺️ Dokumentasi Rute Aplikasi

### 🌐 Storefront / Publik

| Rute          | Komponen / Halaman        | Deskripsi                                                                                     |
| :------------ | :------------------------ | :-------------------------------------------------------------------------------------------- |
| `/`           | `app/page.tsx`            | Katalog utama toko buku (hero promo, daftar buku, filter kategori, search, keranjang belanja) |
| `/login`      | `app/login/page.tsx`      | Autentikasi user & admin login via Supabase Auth                                              |
| `/books/[id]` | `app/books/[id]/page.tsx` | Halaman detail informasi spesifik buku                                                        |

---

### 🛡️ Portal Admin (`/admin`)

| Rute                | Komponen / Halaman              | Deskripsi                                                                                      |
| :------------------ | :------------------------------ | :--------------------------------------------------------------------------------------------- |
| `/admin/dashboard`  | `app/admin/dashboard/page.tsx`  | Dashboard utama (KPI revenue, pesanan terkini, stok menipis, shortcut admin)                   |
| `/admin/produk`     | `app/admin/produk/page.tsx`     | Manajemen katalog & inventori buku (tambah, edit via sheet modal, hapus, sorting, filter stok) |
| `/admin/pesanan`    | `app/admin/pesanan/page.tsx`    | Pengelolaan status transaksi dan tracking resi kurir                                           |
| `/admin/pelanggan`  | `app/admin/pelanggan/page.tsx`  | Manajemen dan profil data pembeli                                                              |
| `/admin/inventori`  | `app/admin/inventori/page.tsx`  | Monitoring stok kritis & penyesuaian stok cepat                                                |
| `/admin/promo`      | `app/admin/promo/page.tsx`      | Manajemen kupon voucher & potongan harga diskon                                                |
| `/admin/laporan`    | `app/admin/laporan/page.tsx`    | Rekapitulasi laporan analitik penjualan                                                        |
| `/admin/pengaturan` | `app/admin/pengaturan/page.tsx` | Konfigurasi sistem toko, branding, dan integrasi WhatsApp                                      |

---

### 🔌 Endpoint Backend (FastAPI)

| Method | Endpoint              | Keterangan                               | Autentikasi          |
| :----- | :-------------------- | :--------------------------------------- | :------------------- |
| `GET`  | `/api/v1/health`      | Healthcheck server API                   | Publik               |
| `GET`  | `/api/v1/books`       | Mengambil katalog buku publik            | Publik               |
| `GET`  | `/api/v1/me`          | Mengambil profil user aktif              | Bearer Token         |
| `GET`  | `/api/v1/admin/check` | Validasi apakah user memiliki role admin | Bearer Token (Admin) |

## 🧪 Testing & Build Verification

### Frontend

```bash
cd frontend
npm run build      # Verifikasi compile Turbopack & TypeScript
npm run lint       # ESLint check
```

### Backend

```bash
cd backend
uv run pytest      # Unit test
uv run ruff check . # Linting python code
```
