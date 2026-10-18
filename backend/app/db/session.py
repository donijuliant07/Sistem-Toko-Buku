"""Engine dan sesi database SQLAlchemy.

Menyediakan `get_db`, dependency FastAPI yang memberi tepat satu `AsyncSession`
per permintaan. Sesi ditutup otomatis saat blok `async with` selesai, termasuk
ketika request gagal di tengah jalan.

Jalur ini hanya dipakai endpoint `books`; modul lain mengakses Supabase lewat
PostgREST di `app.core.supabase`.

Pool dipakai dengan sengaja: database Supabase jarak jauh, dan membuka koneksi
baru (TLS + auth) jauh lebih mahal daripada satu query. `pool_pre_ping` mengganti
koneksi yang sudah diputus server sebelum dipakai, `pool_recycle` mencegah
koneksi menganggur terlalu lama.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Berikan satu sesi database untuk satu permintaan, lalu tutup."""
    async with AsyncSessionLocal() as session:
        yield session
