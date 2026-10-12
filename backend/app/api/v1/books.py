"""Endpoint katalog buku.

Menangani CRUD buku untuk admin, pembacaan katalog publik, dan pembuatan
ulasan AI. Modul ini adalah **satu-satunya** tempat backend memakai SQLAlchemy
(`app.db.session`); modul lain membaca lewat klien Supabase di
`app.core.supabase`.

Catatan penting soal dua jalur data:

- **Tulis** (create/update/delete) selalu lewat SQLAlchemy, karena butuh sesi
  transaksi ORM. Bila database tidak terjangkau, permintaan gagal — tidak ada
  jalur tulis alternatif.
- **Baca** mencoba SQLAlchemy dulu, lalu jatuh ke PostgREST `books` (tabel
  `books` punya policy baca publik, jadi pembacaan tanpa token memang sah).
  Fallback hanya dipicu oleh kegagalan lapisan database, bukan oleh error
  pemrograman.
"""

import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_admin
from app.core.supabase import supabase_admin
from app.db.session import get_db
from app.models import Book
from app.schemas.ai_review import AIReviewRequest, AIReviewResponse
from app.schemas.book import BookCreate, BookPage, BookRead, BookUpdate
from app.services.ai_review_service import generate_ai_book_review

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/books", tags=["books"])

# Kegagalan yang menandakan database tidak terjangkau, bukan bug pemrograman.
# `OSError` wajib ikut: asyncpg melempar `socket.gaierror` mentah saat nama host
# tidak bisa di-resolve, dan itu tidak diturunkan dari `SQLAlchemyError`.
DB_UNREACHABLE = (SQLAlchemyError, OSError)

# Kolom `books` yang dibutuhkan `BookRead`; dipakai jalur baca PostgREST.
_BOOK_COLUMNS = "id, title, author, isbn, description, price, stock, cover_url, created_at, updated_at"


def _is_isbn_conflict(error: IntegrityError) -> bool:
    """Deteksi pelanggaran UNIQUE `uq_books_isbn` dari error IntegrityError.

    `sqlstate` 23505 adalah kode pelanggaran UNIQUE standar PostgreSQL, jadi
    dicek lebih dulu; pencocokan nama constraint dipakai sebagai cadangan untuk
    driver yang tidak mengisi `sqlstate`.
    """
    orig = error.orig
    if getattr(orig, "sqlstate", None) == "23505" or getattr(orig, "pgcode", None) == "23505":
        return True
    constraint_name = getattr(getattr(orig, "diag", None), "constraint_name", None)
    return constraint_name == "uq_books_isbn" or "uq_books_isbn" in str(orig)


def _book_to_dict(book: Book) -> dict[str, Any]:
    """Ubah model ORM menjadi dict berkunci kolom `books`.

    Dipakai agar sisa modul hanya berurusan dengan satu bentuk data (dict),
    alih-alih menebak antara model ORM dan hasil PostgREST di setiap pemakaian.
    """
    return {
        "id": str(book.id),
        "title": book.title,
        "author": book.author,
        "isbn": book.isbn,
        "description": book.description,
        "price": book.price,
        "stock": book.stock,
        "cover_url": book.cover_url,
        "created_at": book.created_at,
        "updated_at": book.updated_at,
    }


def _fetch_book_from_rest(book_id: UUID) -> dict[str, Any] | None:
    """Baca satu buku lewat PostgREST. `None` bila barisnya tidak ada."""
    res = supabase_admin.table("books").select(_BOOK_COLUMNS).eq("id", str(book_id)).execute()
    rows = res.data or []
    return rows[0] if rows else None


async def load_book_for_read(book_id: UUID, db: AsyncSession) -> dict[str, Any]:
    """Ambil satu buku sebagai dict untuk respons baca; 404 bila tidak ada.

    Urutan: SQLAlchemy dulu, lalu PostgREST. Fallback hanya untuk kegagalan
    lapisan database (`SQLAlchemyError` dan `OSError`), bukan untuk semua
    exception — supaya bug pemrograman tetap terlihat, tidak diam-diam tersamar
    sebagai "buku tidak ada".
    """
    try:
        book = await db.get(Book, book_id)
    except DB_UNREACHABLE:
        logger.warning("Koneksi SQLAlchemy gagal saat membaca buku %s; memakai PostgREST.", book_id)
    else:
        if book is not None:
            return _book_to_dict(book)

    row = _fetch_book_from_rest(book_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Buku tidak ditemukan.")
    return row


async def load_book_for_write(book_id: UUID, db: AsyncSession) -> Book:
    """Ambil satu buku sebagai model ORM untuk diubah/dihapus; 404 bila tidak ada.

    Tidak ada fallback ke PostgREST di sini: operasi tulis butuh instance ORM
    yang terikat ke sesi, dan `supabase_admin` tidak bisa menggantikannya.
    """
    book = await db.get(Book, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Buku tidak ditemukan.")
    return book


@router.get("", response_model=BookPage)
async def list_books(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: str | None = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
) -> BookPage:
    """Daftar buku dengan pencarian opsional dan paginasi.

    Katalog bersifat publik, jadi tidak ada dependency otorisasi di sini.
    """
    filters = []
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        filters.append(
            or_(Book.title.ilike(pattern), Book.author.ilike(pattern), Book.isbn.ilike(pattern))
        )

    try:
        count_query = select(func.count()).select_from(Book).where(*filters)
        total = (await db.execute(count_query)).scalar_one()
        query = (
            select(Book)
            .where(*filters)
            .order_by(Book.created_at.desc(), Book.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        books = (await db.execute(query)).scalars().all()
    except DB_UNREACHABLE:
        # Database ORM tidak terjangkau: layani dari PostgREST, dengan bentuk
        # respons yang sama supaya kontrak API tidak berubah.
        logger.warning("Koneksi SQLAlchemy gagal saat mendaftar buku; memakai PostgREST.")
        return _list_books_from_rest(page=page, page_size=page_size, q=q)

    return BookPage(items=books, total=total, page=page, page_size=page_size)


def _list_books_from_rest(page: int, page_size: int, q: str | None) -> BookPage:
    """Cadangan pembacaan katalog lewat PostgREST bila SQLAlchemy tidak tersedia."""
    offset = (page - 1) * page_size
    sb_query = supabase_admin.table("books").select("*", count="exact")
    if q and q.strip():
        term = q.strip()
        sb_query = sb_query.or_(
            f"title.ilike.%{term}%,author.ilike.%{term}%,isbn.ilike.%{term}%"
        )
    res = sb_query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
    items = res.data or []
    total = res.count if res.count is not None else len(items)
    return BookPage(items=items, total=total, page=page, page_size=page_size)


@router.get("/{book_id}", response_model=BookRead)
async def read_book(
    book_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Detail satu buku. Katalog publik — tidak butuh token."""
    return await load_book_for_read(book_id, db)


@router.post("", response_model=BookRead, status_code=status.HTTP_201_CREATED)
async def create_book(
    data: BookCreate,
    _payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Book:
    """Buat buku baru. Hanya admin (diverifikasi dari tabel `profiles`)."""
    values = data.model_dump()
    if values.get("cover_url") is not None:
        values["cover_url"] = str(values["cover_url"])
    book = Book(**values)
    db.add(book)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        if _is_isbn_conflict(exc):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="ISBN sudah terdaftar."
            ) from exc
        raise
    await db.refresh(book)
    return book


@router.put("/{book_id}", response_model=BookRead)
@router.patch("/{book_id}", response_model=BookRead)
async def update_book(
    book_id: UUID,
    data: BookUpdate,
    _payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Book:
    """Perbarui buku. Hanya admin. PUT dan PATCH diperlakukan sama (patch parsial)."""
    book = await load_book_for_write(book_id, db)
    values = data.model_dump(exclude_unset=True)
    if values.get("cover_url") is not None:
        values["cover_url"] = str(values["cover_url"])
    for field, value in values.items():
        setattr(book, field, value)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        if _is_isbn_conflict(exc):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="ISBN sudah terdaftar."
            ) from exc
        raise
    await db.refresh(book)
    return book


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(
    book_id: UUID,
    _payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Hapus buku. Hanya admin."""
    book = await load_book_for_write(book_id, db)
    await db.delete(book)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{book_id}/ai-review", response_model=AIReviewResponse)
async def get_ai_book_review(
    book_id: UUID,
    payload: AIReviewRequest,
    db: AsyncSession = Depends(get_db),
) -> AIReviewResponse:
    """Buat atau ambil ulasan AI untuk sebuah buku pada tingkat spoiler tertentu."""
    book = await load_book_for_read(book_id, db)

    return await generate_ai_book_review(
        book_id=str(book["id"]),
        title=book.get("title") or "Buku",
        author=book.get("author") or "Penulis",
        description=book.get("description") or "",
        isbn=book.get("isbn") or "",
        spoiler_level=payload.spoiler_level,
    )
