from supabase import create_client, Client
from app.core.config import settings

# Service role client - bypasses RLS for backend authorized operations
supabase_admin: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY
)

# Anon client - respects RLS
supabase_anon: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_ANON_KEY
)


def get_supabase() -> Client:
    return supabase_admin
