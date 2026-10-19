"""Titik masuk aplikasi FastAPI.

Merangkai seluruh router `/api/v1`, mengatur CORS dari konfigurasi, dan
menyediakan endpoint kesehatan. Jalankan lewat `uvicorn app.main:app`.
"""

import contextlib

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import (
    auth,
    book_advisor,
    books,
    cart,
    categories,
    dashboard,
    inventory,
    marketplaces,
    orders,
    promos,
    uploads,
)
from app.core.config import settings
from app.services.advisor.gemini import close_gemini_client


@contextlib.asynccontextmanager
async def lifespan(_app: FastAPI):
    """Tutup klien HTTP bersama saat aplikasi berhenti, di event loop yang sama.

    `atexit` tidak dipakai: saat proses berhenti loop-nya sudah tertutup,
    sehingga `aclose()` gagal dan koneksi menggantung.
    """
    yield
    await close_gemini_client()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(books.router, prefix=settings.API_V1_PREFIX)
app.include_router(marketplaces.router, prefix=settings.API_V1_PREFIX)
app.include_router(categories.router, prefix=settings.API_V1_PREFIX)
app.include_router(orders.router, prefix=settings.API_V1_PREFIX)
app.include_router(orders.shipping_router, prefix=settings.API_V1_PREFIX)
app.include_router(cart.router, prefix=settings.API_V1_PREFIX)
app.include_router(inventory.router, prefix=settings.API_V1_PREFIX)
app.include_router(dashboard.router, prefix=settings.API_V1_PREFIX)
app.include_router(promos.router, prefix=settings.API_V1_PREFIX)
app.include_router(uploads.router, prefix=settings.API_V1_PREFIX)
app.include_router(book_advisor.router, prefix=settings.API_V1_PREFIX)

# Klien Gemini dibuat malas pada pemanggilan pertama dan ditutup lewat
# lifespan di atas; tanpa API key tidak ada koneksi yang dibuka.

# Alias /me untuk kompatibilitas sinkronisasi klien frontend
app.add_api_route(
    f"{settings.API_V1_PREFIX}/me",
    auth.get_my_profile,
    methods=["GET"],
    tags=["Autentikasi"],
)


@app.get("/health", tags=["Kesehatan"])
async def health_check():
    """Laporan kesiapan sederhana; dipakai pemeriksaan uptime."""
    return {
        "status": "online",
        "pesan": "Backend Toko Buku Gramedia API siap digunakan.",
        "environment": settings.ENVIRONMENT,
    }
