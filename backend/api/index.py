"""Entrypoint Vercel Python Function untuk FastAPI.

Vercel hanya mengenali aplikasi ASGI dari variabel `app` di `api/index.py`.
Modul yang sama dipakai `uvicorn app.main:app` saat lokal — tidak ada logika
yang diduplikasi di sini.

`sys.path` disisipkan karena proses Vercel berjalan dengan direktori kerja
proyek, sementara paket `app/` ada satu tingkat di atas folder `api/`.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app  # noqa: F401