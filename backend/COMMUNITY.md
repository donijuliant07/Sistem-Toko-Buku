# Book Community — Grup Diskusi & Chat

Fitur komunitas pembaca: pengguna menemukan grup diskusi bertema, bergabung ke
grup publik, membaca riwayat dan mengirim pesan secara real-time, serta
membagikan buku dari katalog toko ke dalam percakapan.

Keputusan desain:

| Topik | Keputusan |
|---|---|
| Siapa membuat grup | **Hanya admin** (`profiles.role = 'admin'`). |
| Grup privat | Membership ditambahkan **owner/moderator** lewat pencarian username/nama. Tidak ada tautan undangan. |
| Realtime | **Supabase Realtime** `postgres_changes` pada `chat_messages`, dibatasi policy SELECT + membership. |
| Foto grup | Belum ada unggahan; kolom `avatar_url` disiapkan, UI memakai inisial + warna kategori. |
| Berbagi buku | `message_type = 'book'` + `book_id`; kartu menampilkan **data buku terkini** (harga saat ini, bukan harga saat dikirim). |

---

## Alur singkat

```
Browser ──(Bearer token Supabase)──► FastAPI /api/v1/community/*
          │  semua baca & tulis
          │  service role melewati RLS → izin diputuskan di Python
          ▼
     Postgres (chat_groups, chat_group_members, chat_messages)

Browser ◄── Supabase Realtime (postgres_changes INSERT/DELETE chat_messages)
          RLS SELECT dievaluasi dengan JWT pengguna → non-anggota tidak menerima apa pun
```

Ada **satu jalur tulis**: pesan selalu dikirim lewat FastAPI. Browser tidak
pernah menulis ke tabel langsung, sehingga `sender_id` selalu berasal dari token,
bukan dari body request.

---

## Struktur modul

```
app/models/community.py              # ORM ChatGroup, ChatGroupMember, ChatMessage
app/schemas/community.py             # Pydantic v2: enum, request, respons
app/services/community/
    repository.py                    # OrmGroupRepository, OrmMemberRepository, OrmMessageRepository
    permissions.py                   # matriks izin murni (fungsi biasa, mudah diuji)
    group_service.py                 # list/detail/create/join/leave/update/delete
    member_service.py                # list/search/add/remove/change role/transfer owner
    message_service.py               # keyset pagination, kirim, hapus lembut
    rate_limit.py                    # SendRateLimiter (in-memory)
    errors.py                        # CommunityError(status, pesan)
app/api/v1/community.py              # router /community
migrations/versions/20261019_10_create_community_tables.py
tests/test_community.py
```

---

## Skema database

Migrasi `20261019_10` (`down_revision = "20261018_09"`), raw SQL, idempoten.

### `chat_groups`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `name` | varchar(80) | unik case-insensitive (`lower(btrim(name))`) |
| `slug` | text | dipakai pencarian |
| `description` | text | default `''` |
| `category` | varchar(32) | check: `manga_anime`, `business_startup`, `self_improvement`, `fantasy_fiction`, `technology`, `book_club`, `general` |
| `visibility` | varchar(10) | `public` \| `private` |
| `avatar_url` | text | disiapkan, belum dipakai |
| `created_by` | uuid → `auth.users` | ON DELETE RESTRICT |
| `created_at`, `updated_at` | timestamptz | `updated_at` lewat trigger |

### `chat_group_members`

`(group_id, user_id)` PK, `role` ∈ `owner | moderator | member`. Index unik
parsial `(group_id) WHERE role = 'owner'` menjamin **maksimal satu owner** per grup.

### `chat_messages`

| Kolom | Catatan |
|---|---|
| `id` | uuid PK |
| `group_id`, `sender_id` | FK ke `chat_groups` / `auth.users`, ON DELETE CASCADE |
| `message_type` | `text` \| `book` |
| `content` | teks 1–2000 karakter; `''` untuk tipe `book` |
| `book_id` | FK `books` ON DELETE SET NULL (wajib untuk `book`, null untuk `text`) |
| `client_message_id` | idempotensi retry; unik per `(group_id, sender_id)` |
| `created_at`, `deleted_at` | pesan append-only + hapus lembut |

Check constraint `ck_chat_messages_shape` menegakkan bentuk pesan sesuai tipe.
Index keyset `(group_id, created_at DESC, id DESC)`.

### Helper & RLS

```sql
is_group_member(p_group uuid)  -- ada baris membership untuk auth.uid()
is_group_owner(p_group uuid)   -- membership dengan role = 'owner'
```

Semua tulis dari backend memakai klien **service role** yang melewati RLS, jadi
policy di bawah hanya untuk melindungi pembacaan langsung (termasuk Realtime):

| Tabel | Policy | Siapa |
|---|---|---|
| `chat_groups` | `chat_groups_public_read` | `anon, authenticated` bila `visibility = 'public'` |
| `chat_groups` | `chat_groups_member_read` | anggota grup atau admin |
| `chat_group_members` | `chat_group_members_member_read` | anggota grup atau admin |
| `chat_messages` | `chat_messages_member_read` | `deleted_at IS NULL` dan (anggota atau admin) |

Tidak ada policy INSERT/UPDATE/DELETE untuk `anon`/`authenticated`.

### Realtime

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;  -- agar DELETE membawa group_id
```

Tanpa `REPLICA IDENTITY FULL`, event DELETE hanya membawa primary key sehingga
frontend tidak bisa mencocokkannya dengan grup.

---

## Kontrak API

Prefix `/api/v1/community`. Semua endpoint wajib `Authorization: Bearer <token>`
(`401` tanpa token). Respons dibungkus `ApiResponse[T]`:
`{ "sukses": true, "pesan": "...", "data": ... }`. Endpoint hapus membalas `204`.

| Method | Path | Akses | Status |
|---|---|---|---|
| GET | `/groups` | login | `200` — query `q`, `category`, `mine=true`, `page`, `page_size` (≤50) |
| GET | `/groups/{group_id}` | anggota / admin / publik | `200`, `404` bila privat & bukan anggota |
| POST | `/groups` | **admin** | `201`, `403`, `409` nama duplikat |
| PATCH | `/groups/{group_id}` | owner / admin | `200`, `403/404`, `422` |
| DELETE | `/groups/{group_id}` | owner / admin | `204` |
| POST | `/groups/{group_id}/join` | login | `200` (idempoten), `404` privat |
| POST | `/groups/{group_id}/leave` | anggota | `204`; owner → `409` (transfer dulu) |
| GET | `/groups/{group_id}/members` | anggota / admin | `200` |
| POST | `/groups/{group_id}/members` | moderator / owner | `201`, `409` sudah anggota |
| PATCH | `/groups/{group_id}/members/{user_id}` | owner | `200`, `422` role tidak valid |
| DELETE | `/groups/{group_id}/members/{user_id}` | moderator / owner | `204` |
| POST | `/groups/{group_id}/transfer-owner` | owner | `200` — owner lama menjadi moderator |
| GET | `/users/search?q=` | login (min. 2 huruf) | `200` daftar `{id, username, full_name, avatar_url}` |
| GET | `/groups/{group_id}/messages` | anggota / admin | `200` `{items, next_cursor}` **kronologis** |
| POST | `/groups/{group_id}/messages` | anggota | `201` (`200` bila `client_message_id` sudah ada), `404` non-anggota, `422`, `429` rate limit |
| DELETE | `/groups/{group_id}/messages/{message_id}` | pengirim / moderator / owner / admin | `204` |

### Konvensi error

- **404** dipakai untuk grup privat yang tidak boleh diketahui keberadaannya.
- **403** untuk aksi yang grupnya terlihat tetapi tidak diizinkan.
- **409** untuk konflik aturan (nama duplikat, keluar sebagai owner, transfer ke diri sendiri).
- Detail selalu Bahasa Indonesia.

### Format pesan

```json
{
  "id": "…",
  "group_id": "…",
  "message_type": "text",
  "content": "Halo semua",
  "sender": { "id": "…", "username": "rendy", "full_name": "Rendy", "avatar_url": null },
  "book": null,
  "client_message_id": "…",
  "created_at": "2026-10-19T09:00:00Z"
}
```

Untuk tipe `book`, `content = ""` dan `book` berisi
`{id, title, author, price, cover_url}` dari join katalog **saat dibaca**;
`null` bila buku sudah dihapus dari katalog.

### Pagination keyset

`GET /messages` mengembalikan 30 pesan terbaru secara kronologis. Kirim
`cursor=<next_cursor>` untuk mengambil halaman yang lebih lama. Cursor berbasis
`(created_at, id)` sehingga stabil walau ada pesan baru masuk.

### Idempotensi kirim

`POST /messages` menerima `client_message_id` (uuid dari klien). Pengiriman ulang
dengan id yang sama tidak membuat duplikat — server mengembalikan pesan yang
sudah tersimpan. Frontend memakai ini untuk tombol "Kirim ulang".

---

## Matriks izin

Ditegakkan di `app/services/community/permissions.py`; role **selalu** dibaca dari
`chat_group_members` di database, tidak pernah dari request.

| Aksi | Member | Moderator | Owner | Admin global |
|---|---|---|---|---|
| Lihat grup publik & pesan | ✓ | ✓ | ✓ | ✓ |
| Lihat grup privat & pesan | ✗ (404) | ✓ | ✓ | ✓ |
| Kirim pesan | ✓ | ✓ | ✓ | hanya bila anggota |
| Hapus pesan sendiri | ✓ | ✓ | ✓ | ✓ |
| Hapus pesan orang lain | ✗ | ✓ | ✓ | ✓ |
| Tambah anggota | ✗ | ✓ | ✓ | ✗ |
| Keluarkan anggota | ✗ | hanya `member` | ✓ (kecuali diri sendiri) | ✗ |
| Ubah role member ↔ moderator | ✗ | ✗ | ✓ | ✗ |
| Transfer kepemilikan | ✗ | ✗ | ✓ | ✗ |
| Keluar grup | ✓ | ✓ | ✗ → 409 | — |
| Hapus grup | ✗ | ✗ | ✓ | ✓ |
| Ubah nama/deskripsi/kategori | ✗ | ✗ | ✓ | ✓ |
| Buat grup | ✗ | ✗ | ✗ | ✓ |

Admin global tidak otomatis menjadi anggota, sehingga tidak bisa mengirim pesan
di grup mana pun sebelum bergabung sendiri. UI menampilkan banner "admin hanya
membaca" pada kasus ini.

---

## Frontend

| File | Isi |
|---|---|
| `app/komunitas/layout.tsx` | gerbang login + TopBar/Header/Toaster |
| `app/komunitas/page.tsx` | daftar grup ↔ ruang chat, grup aktif di `?g=<id>` |
| `components/community/GroupBrowser.tsx` | pencarian, filter kategori, tab Semua/Grup Saya, tombol Buat (admin) |
| `components/community/ChatRoom.tsx` | detail grup, riwayat (keyset), komposer, aksi owner/moderator |
| `components/community/MemberPanel.tsx` | daftar anggota, ubah role, keluarkan, transfer kepemilikan |
| `components/community/AddMemberDialog.tsx` | cari pengguna lalu tambahkan |
| `components/community/BookShareDialog.tsx` + `BookMessageCard.tsx` | bagikan buku dari katalog |
| `hooks/useGroupRealtime.ts` | langganan `postgres_changes` INSERT/DELETE, status koneksi |
| `lib/community.ts`, `lib/types.ts`, `lib/api.ts` | label/kategori, tipe, klien API |

Perilaku penting:

- **Optimistic send**: pesan langsung tampil dengan status "mengirim…"; bila gagal
  muncul "Kirim ulang" (memakai `client_message_id` yang sama) dan "Buang".
- **Realtime**: event INSERT menggantikan pesan optimistis berdasarkan
  `client_message_id`; setelah tersambung ulang (termasuk dari error) riwayat
  halaman terakhir dimuat ulang untuk menambal event yang terlewat. Status
  koneksi ditampilkan di header ruang chat.
- **Batas panjang** pesan 2000 karakter (sama dengan constraint database).
- `content` selalu dirender sebagai teks, tidak ada HTML mentah.

Tidak ada variabel lingkungan baru: frontend memakai `NEXT_PUBLIC_SUPABASE_URL`
dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` yang sudah ada, serta token sesi Supabase
untuk header API.

---

## Menjalankan migrasi

```powershell
cd backend
uv run alembic upgrade head      # menerapkan 20261019_10
uv run alembic downgrade -1      # hanya untuk lingkungan pengembangan (menghapus riwayat chat)
```

Setelah migrasi, verifikasi RLS dan publikasi Realtime dengan
[`docs/verifikasi-community-rls.sql`](../docs/verifikasi-community-rls.sql) di
Supabase SQL Editor.

---

## Testing

```powershell
cd backend
uv run pytest tests/test_community.py      # service + endpoint dengan repository palsu, tanpa DB
```

Cakupan: 401 tanpa token, 404 untuk non-anggota, isolasi grup privat, anti
spoofing `sender_id`, matriks role, transfer kepemilikan, validasi pesan, buku
tidak ditemukan, idempotensi `client_message_id`, pagination keyset, dan rate
limit.

---

## Batasan yang perlu diketahui

- **Rate limit in-memory per proses** (10 pesan / 10 detik per user per grup).
  Dengan beberapa worker/replika, batas efektif berlipat dan reset saat proses
  restart. Ini proteksi dasar, bukan pembatas terdistribusi; untuk produksi
  besar pindahkan ke Redis/Postgres.
- **Harga buku mengikuti katalog saat ini**, bukan snapshot saat pesan dikirim.
- **Admin global** hanya bisa membaca; tidak bisa kirim atau mengelola anggota.
- **Belum ada**: tautan undangan, foto grup, balasan/thread, reaksi, indikator
  mengetik, presence, notifikasi, pin, pencarian riwayat, laporan pesan.
- Realtime bergantung pada publikasi `supabase_realtime` yang sudah ada di
  project Supabase. Pada Postgres biasa migrasi tetap berjalan tanpa publikasi.
- Membangun DB kosong dari rantai alembic sudah gagal di migrasi `04` sebelum
  fitur ini (backlog lama, lihat `docs/SUPABASE_SYNC_ISSUES.md`).
