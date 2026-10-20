"""Endpoint katalog buku.

Menangani CRUD buku untuk admin, pembacaan katalog publik, dan pembuatan
ulasan AI. Modul ini adalah **satu-satunya** tempat backend memakai SQLAlchemy
untuk tulis (`app.db.session`); modul lain membaca lewat klien Supabase di
`app.core.supabase`.

Catatan penting soal dua jalur data:

- **Tulis** (create/update/delete) selalu lewat SQLAlchemy, karena butuh sesi
  transaksi ORM. Bila database tidak terjangkau, permintaan gagal — tidak ada
  jalur tulis alternatif.
- **Baca** mencoba SQLAlchemy dulu, lalu jatuh ke PostgREST `books` (tabel
  `books` punya policy baca publik, jadi pembacaan tanpa token memang sah).
  Fallback hanya dipicu oleh kegagalan lapisan database, bukan oleh error
  pemrograman.

Detail kueri dan pemetaan data ada di repository (`app.services.book_service`);
modul ini hanya menyusun jalur baca/tulis, menerjemahkan error menjadi status
HTTP, dan memilih jalur cadangan.
"""

import asyncio
import logging
import uuid
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    UserPayload,
    get_optional_user,
    require_admin,
)
from app.db.session import get_db
from app.models import Book
from app.schemas.ai_review import AIReviewRequest, AIReviewResponse, SpoilerLevel
from app.schemas.book import BookCreate, BookPage, BookRead, BookUpdate
from app.schemas.rewards import AIReviewGenerationRead
from app.services.ai_review_service import generate_ai_book_review
from app.services.book_service import OrmBookRepository, RestBookRepository
from app.services.marketplace.seeding import build_default_source_rows
from app.services.marketplace_repository import OrmMarketplaceSourceRepository
from app.services.rewards.access import FREE_LEVELS as FREE_SPOILER_LEVELS
from app.services.rewards.errors import RewardsError
from app.services.rewards.service import rewards_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/books", tags=["books"])

# Kegagalan yang menandakan database tidak terjangkau, bukan bug pemrograman.
# `OSError` wajib ikut: asyncpg melempar `socket.gaierror` mentah saat nama host
# tidak bisa di-resolve, dan itu tidak diturunkan dari `SQLAlchemyError`.
DB_UNREACHABLE = (SQLAlchemyError, OSError)


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


def _fetch_book_from_rest(book_id: UUID) -> dict[str, Any] | None:
    """Baca satu buku lewat PostgREST. `None` bila barisnya tidak ada."""
    return RestBookRepository().get(book_id)


def _list_books_from_rest(page: int, page_size: int, q: str | None) -> BookPage:
    """Cadangan pembacaan katalog lewat PostgREST bila SQLAlchemy tidak tersedia."""
    items, total = RestBookRepository().list_page(page=page, page_size=page_size, q=q)
    return BookPage(items=items, total=total, page=page, page_size=page_size)


async def load_book_for_read(book_id: UUID, db: AsyncSession) -> dict[str, Any]:
    """Ambil satu buku sebagai dict untuk respons baca; 404 bila tidak ada.

    Urutan: SQLAlchemy dulu, lalu PostgREST. Fallback hanya untuk kegagalan
    lapisan database (`SQLAlchemyError` dan `OSError`), bukan untuk semua
    exception — supaya bug pemrograman tetap terlihat, tidak diam-diam tersamar
    sebagai "buku tidak ada".
    """
    try:
        book = await OrmBookRepository(db).get(book_id)
    except DB_UNREACHABLE:
        logger.warning("Koneksi SQLAlchemy gagal saat membaca buku %s; memakai PostgREST.", book_id)
    else:
        if book is not None:
            return book

    row = _fetch_book_from_rest(book_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Buku tidak ditemukan.")
    return row


async def load_book_for_write(book_id: UUID, db: AsyncSession) -> Book:
    """Ambil satu buku sebagai model ORM untuk diubah/dihapus; 404 bila tidak ada.

    Tidak ada fallback ke PostgREST di sini: operasi tulis butuh instance ORM
    yang terikat ke sesi, dan `supabase_admin` tidak bisa menggantikannya.
    """
    book = await OrmBookRepository(db).get_model(book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Buku tidak ditemukan.")
    return book


@router.get("", response_model=BookPage)
async def list_books(
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: str | None = Query(default=None, max_length=100),
) -> BookPage:
    """Daftar buku dengan pencarian opsional dan paginasi.

    Katalog bersifat publik, jadi tidak ada dependency otorisasi di sini.
    """
    try:
        books, total = await OrmBookRepository(db).list_page(page=page, page_size=page_size, q=q)
    except DB_UNREACHABLE:
        # Database ORM tidak terjangkau: layani dari PostgREST, dengan bentuk
        # respons yang sama supaya kontrak API tidak berubah.
        logger.warning("Koneksi SQLAlchemy gagal saat mendaftar buku; memakai PostgREST.")
        return _list_books_from_rest(page=page, page_size=page_size, q=q)

    return BookPage(items=books, total=total, page=page, page_size=page_size)


@router.get("/{book_id}", response_model=BookRead)
async def read_book(
    book_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    """Detail satu buku. Katalog publik — tidak butuh token."""
    return await load_book_for_read(book_id, db)


@router.post("", response_model=BookRead, status_code=status.HTTP_201_CREATED)
async def create_book(
    data: BookCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _payload: Annotated[dict, Depends(require_admin)],
) -> Book:
    """Buat buku baru. Hanya admin (diverifikasi dari tabel `profiles`).

    Buku baru langsung mendapat sumber marketplace bawaan (lihat
    `app.services.marketplace.seeding`) dalam transaksi yang sama, sehingga
    perbandingan harga bisa dipakai tanpa admin mengisi sumber satu per satu.
    Bila ISBN bentrok, `rollback` membatalkan keduanya — tidak ada sumber yatim.
    """
    values = data.model_dump()
    if values.get("cover_url") is not None:
        values["cover_url"] = str(values["cover_url"])
    book = Book(**values)
    # `id` diisi `default=uuid.uuid4` saat flush, jadi dikirim eksplisit lebih
    # dulu supaya baris sumber tidak perlu kueri tambahan untuk `book.id`.
    book.id = uuid.uuid4()
    db.add(book)
    try:
        # `flush` menulis baris buku lebih dulu: sumber marketplace punya FK ke
        # `books.id`, dan `commit` tunggal tetap membuat keduanya atomik.
        await db.flush()
        await OrmMarketplaceSourceRepository(db).create_many_if_absent(
            build_default_source_rows(book.id, title=book.title, author=book.author)
        )
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
    db: Annotated[AsyncSession, Depends(get_db)],
    _payload: Annotated[dict, Depends(require_admin)],
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
    db: Annotated[AsyncSession, Depends(get_db)],
    _payload: Annotated[dict, Depends(require_admin)],
) -> Response:
    """Hapus buku. Hanya admin."""
    book = await load_book_for_write(book_id, db)
    await db.delete(book)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{book_id}/ai-review", response_model=AIReviewResponse, deprecated=True)
async def get_ai_book_review(
    book_id: UUID,
    payload: AIReviewRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[UserPayload | None, Depends(get_optional_user)],
) -> AIReviewResponse:
    """Alias lama untuk `POST /ai/books/{book_id}/review`.

    Kompatibilitas: pemanggil tanpa token tetap mendapat level gratis
    (`no_spoiler`/`low`) seperti sebelumnya. Level `medium`/`heavy` butuh token
    dan melewati Book Rewards (syarat pembelian atau potong poin) — tanpa itu,
    konten berbayar akan terbuka gratis lewat endpoint lama.
    """
    book = await load_book_for_read(book_id, db)
    level = payload.spoiler_level

    if level in FREE_SPOILER_LEVELS:
        return await generate_ai_book_review(
            book_id=str(book["id"]),
            title=book.get("title") or "Buku",
            author=book.get("author") or "Penulis",
            description=book.get("description") or "",
            isbn=book.get("isbn") or "",
            spoiler_level=level,
        )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tingkat spoiler ini membutuhkan login dan poin.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.role != "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak. Fitur ini hanya untuk akun pelanggan.",
        )
    try:
        generation, _reused = await asyncio.to_thread(
            _ai_alias_run, user, book_id, book, level
        )
    except RewardsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    if generation.status != "success" or not generation.result:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Ulasan AI gagal dibuat. Poin yang terpotong sudah dikembalikan.",
        )
    return AIReviewResponse.model_validate({**generation.result, "cached": False})


def _ai_alias_run(
    user: UserPayload, book_id: UUID, book: dict[str, Any], level: SpoilerLevel
) -> tuple[AIReviewGenerationRead, bool]:
    # Impor lokal: `app.api.v1.ai` sendiri mengimpor `load_book_for_read` dari
    # modul ini, jadi impor di level modul akan melingkar.
    from app.api.v1.ai import _generator

    return rewards_service.generate_ai_review(
        user,
        book_id=book_id,
        spoiler_level=level,
        book=book,
        generator=_generator,
    )
