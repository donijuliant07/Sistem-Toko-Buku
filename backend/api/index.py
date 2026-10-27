"""Entrypoint Vercel Python Function untuk FastAPI.

Vercel hanya mengenali aplikasi ASGI dari variabel `app` di `api/index.py`.
Modul yang sama dipakai `uvicorn app.main:app` saat lokal — tidak ada logika
yang diduplikasi di sini.

`sys.path` disisipkan karena proses Vercel berjalan dengan direktori kerja
proyek, sementara paket `app/` ada satu tingkat di atas folder `api/`.

Beberapa SDK pihak ketiga (mis. `supabase` + PostgREST/Storage) mengisi
signature SSL dengan default `inspect.signature`, yang di Python 3.14 memicu
`PydanticInvalidForJsonSchema` saat `/docs` membuat skema OpenAPI. Serverless
tidak butuh `/docs`, jadi dimatikan bila `VERCEL` sudah di-set.
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app

if os.getenv("VERCEL"):
    app.openapi_url = None
    app.docs_url = None
    app.redoc_url = None
