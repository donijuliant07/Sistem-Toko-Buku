# ⚠️ JANGAN dipakai sebagai jalur migrasi

Folder ini **basi** dan **bukan** sumber kebenaran skema. Jangan jalankan
`supabase db push` atau mengeksekusi `*.sql` di sini ke database produksi.

- Jalur migrasi resmi: **Alembic** (`backend/migrations/versions/`).
- Berkas di folder ini masih memakai skema lama (`products`, enum `user_role`,
  `is_staff_or_admin()`, policy `customer_id`) yang **tidak** cocok dengan DB live.
- `0002_rls.sql` pernah menjadi satu-satunya sumber `is_admin()` — fungsi itu
  sekarang dibuat oleh migrasi alembic `20261011_05`.

Biarkan folder ini hanya sebagai arsip historis. Lihat
`docs/SUPABASE_SYNC_ISSUES.md` dan `docs/LAPORAN-RBAC.md`.
