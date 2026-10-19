"""Klien Supabase untuk PostgREST, Storage, dan Auth.

Dua klien dengan hak akses berbeda:

- `supabase_admin` memakai service role key dan **melewati RLS**. Dipakai service
  untuk operasi backend yang sudah diotorisasi di layer API.
- `supabase_anon` memakai anon key dan tunduk pada RLS. Dipakai alur
  login/registrasi supaya Supabase Auth berjalan sebagai klien publik, bukan
  sebagai service role.

Karena `supabase_admin` menembus RLS, otorisasi TIDAK boleh mengandalkan
database: pemeriksaan peran tetap dilakukan dependency FastAPI di
`app.core.security`.
"""

from app.core.config import settings
from supabase import Client, create_client

# Service role client - bypasses RLS for backend authorized operations
supabase_admin: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY
)

# Anon client - respects RLS. Dipakai alur login/registrasi (`auth.py`) supaya
# Supabase Auth memakai anon key, bukan service role.
supabase_anon: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_ANON_KEY
)
