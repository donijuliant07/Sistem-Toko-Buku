"""Engine dan sesi database SQLAlchemy.

Menyediakan `get_db`, dependency FastAPI yang memberi tepat satu `AsyncSession`
per permintaan. Sesi ditutup otomatis saat blok `async with` selesai, termasuk
ketika request gagal di tengah jalan.

Jalur ini hanya dipakai endpoint `books`; modul lain mengakses Supabase lewat
PostgREST di `app.core.supabase`.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Berikan satu sesi database untuk satu permintaan, lalu tutup."""
    async with AsyncSessionLocal() as session:
        yield session
