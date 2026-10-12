"""Lapisan database SQLAlchemy.

Pemakaiannya sengaja terbatas: hanya endpoint `books` yang menempuh jalur ini.
- `base` — `Base` deklaratif untuk seluruh model.
- `session` — engine async, pabrik sesi, dan dependency `get_db`.

Modul lain mengakses Supabase lewat `app.core.supabase` (PostgREST), bukan
lewat sesi SQLAlchemy.
"""
