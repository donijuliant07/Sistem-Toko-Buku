"""Repository katalog buku: dua jalur baca, masing-masing menyembunyikan detailnya.

Tabel `books` dibaca lewat dua jalur yang memang sudah dipakai aplikasi:

- **SQLAlchemy** (`OrmBookRepository`) — jalur utama, memakai sesi transaksi ORM
  yang asinkron.
- **PostgREST Supabase** (`RestBookRepository`) — jalur cadangan ketika lapisan
  database ORM tidak terjangkau. Klien `supabase` bersifat sinkron/blokir.

Kedua class memakai nama method yang sama (`get`, `list_page`) dengan bentuk hasil
yang sama, sehingga layer API dapat berpindah jalur tanpa mengubah cara pemakaiannya.
Dua perbedaan tipe pengembaliannya disengaja:

- `get` mengembalikan **dict** di kedua jalur, karena respons `GET /books/{id}`
  memang berbentuk dict di kontrak API.
- `list_page` mengembalikan **objek ORM** di jalur SQLAlchemy dan **dict** di jalur
  PostgREST. Keduanya diterima `BookRead` lewat `from_attributes`, jadi kontrak
  respons tetap sama.

Catatan desain — **kontrak baca ditegakkan lewat `BookRepository(ABC)`**
(`app/services/base.py`). Kedua class di bawah mewarisinya, sehingga kontraknya
eksplisit: Python akan menolak class yang lupa mengimplementasikan `get`/`list_page`.
Yang **tidak** dilakukan ABC ini adalah memaksa satu signature `async` vs sinkron —
model eksekusinya memang berbeda secara mendasar (`AsyncSession` hanya bisa
di-`await`, sedangkan klien `supabase` tidak punya varian async), jadi ABC hanya
menuntut *nama method*, bukan bentuk coroutine-nya. Jalur tulis sengaja tidak masuk
kontrak: hanya jalur baca yang punya dua implementasi untuk dipertukarkan.

Batas tanggung jawab: penulisan buku (create/update/delete) selalu lewat ORM dan
tinggal di layer API, karena butuh instance ORM yang terikat sesi
(`add`/`commit`/`refresh`/`delete`). Repository ini juga **tidak** menangkap
kegagalan koneksi: pemilihan jalur cadangan adalah keputusan pemanggil, sehingga
bug pemrograman tidak diam-diam tersamar sebagai "database mati".
"""

from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.supabase import supabase_admin
from app.models import Book
from app.services.base import BookRepository

# Kolom `books` yang dibutuhkan `BookRead`; dipakai jalur baca PostgREST.
_BOOK_COLUMNS = "id, title, author, isbn, description, price, stock, cover_url, created_at, updated_at"


def book_to_dict(book: Book) -> dict[str, Any]:
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


class OrmBookRepository(BookRepository):
    """Jalur baca SQLAlchemy. Memegang satu `AsyncSession` milik permintaan."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get(self, book_id: UUID) -> dict[str, Any] | None:
        """Satu buku sebagai dict; `None` bila barisnya tidak ada."""
        book = await self.get_model(book_id)
        return book_to_dict(book) if book is not None else None

    async def get_model(self, book_id: UUID) -> Book | None:
        """Instance ORM mentah, untuk jalur tulis yang butuh objek terikat sesi."""
        return await self._db.get(Book, book_id)

    async def list_page(self, page: int, page_size: int, q: str | None) -> tuple[list[Book], int]:
        """Satu halaman buku (objek ORM) beserta total baris untuk paginasi."""
        filters = self._search_filters(q)
        count_query = select(func.count()).select_from(Book).where(*filters)
        total = (await self._db.execute(count_query)).scalar_one()
        query = (
            select(Book)
            .where(*filters)
            .order_by(Book.created_at.desc(), Book.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        books = (await self._db.execute(query)).scalars().all()
        return books, total

    @staticmethod
    def _search_filters(q: str | None) -> list[Any]:
        """Filter pencarian katalog; kosong bila `q` tidak berisi kata kunci.

        Kata kuncinya dirapikan oleh `BookRepository._search_term` (diwarisi),
        sehingga aturan "kapan dianggap kosong" hanya ada di satu tempat.
        """
        term = BookRepository._search_term(q)
        if term is None:
            return []
        pattern = f"%{term}%"
        return [
            or_(Book.title.ilike(pattern), Book.author.ilike(pattern), Book.isbn.ilike(pattern))
        ]


class RestBookRepository(BookRepository):
    """Jalur baca PostgREST Supabase. Sinkron, mengikuti klien `supabase`."""

    def get(self, book_id: UUID) -> dict[str, Any] | None:
        """Satu buku sebagai dict; `None` bila barisnya tidak ada."""
        res = supabase_admin.table("books").select(_BOOK_COLUMNS).eq("id", str(book_id)).execute()
        rows = res.data or []
        return rows[0] if rows else None

    def list_page(self, page: int, page_size: int, q: str | None) -> tuple[list[dict[str, Any]], int]:
        """Satu halaman buku (dict) beserta total baris untuk paginasi."""
        offset = (page - 1) * page_size
        sb_query = supabase_admin.table("books").select("*", count="exact")
        term = self._search_term(q)
        if term is not None:
            sb_query = sb_query.or_(f"title.ilike.%{term}%,author.ilike.%{term}%,isbn.ilike.%{term}%")
        res = sb_query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
        items = res.data or []
        total = res.count if res.count is not None else len(items)
        return items, total
