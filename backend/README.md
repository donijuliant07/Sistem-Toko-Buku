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

Health endpoint: `http://localhost:8000/api/v1/health`  
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
