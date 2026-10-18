"""Koneksi database PostgreSQL / Supabase untuk scraper worker."""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config import settings

logger = logging.getLogger(__name__)

# Normalisasi URL agar kompatibel dengan driver asyncpg
db_url = settings.DATABASE_URL
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)

engine = create_async_engine(
    db_url,
    pool_pre_ping=True,
    pool_recycle=1800,
)

async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Context manager untuk sesi database async."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def fetch_books_to_scrape(session: AsyncSession, limit: int = 0) -> list[dict[str, Any]]:
    """Tarik daftar buku yang perlu diperbarui harganya."""
    query_str = """
        SELECT b.id, b.title, b.author, b.isbn, b.price
        FROM public.books b
        ORDER BY b.created_at DESC
    """
    if limit > 0:
        query_str += f" LIMIT {limit}"

    result = await session.execute(text(query_str))
    rows = result.mappings().all()
    return [dict(row) for row in rows]


async def save_marketplace_price(session: AsyncSession, price_data: dict[str, Any]) -> None:
    """Simpan satu baris snapshot harga ke tabel public.marketplace_prices."""
    insert_sql = text("""
        INSERT INTO public.marketplace_prices (
            book_id,
            marketplace,
            price,
            currency,
            product_url,
            product_title,
            seller_name,
            in_stock,
            match_score,
            source,
            fetched_at
        ) VALUES (
            :book_id,
            :marketplace,
            :price,
            :currency,
            :product_url,
            :product_title,
            :seller_name,
            :in_stock,
            :match_score,
            :source,
            NOW()
        )
    """)
    await session.execute(insert_sql, price_data)
