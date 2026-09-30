# rak buku. frontend

Next.js frontend for Bookstore API.

## Run locally

Start backend first:

```powershell
cd ..\backend
uv run uvicorn app.main:app --reload
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
