import socket
from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import patch
from uuid import UUID

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError, OperationalError

from app.api.v1.books import (
    _is_isbn_conflict,
    list_books,
    load_book_for_read,
    load_book_for_write,
)
from app.core.security import UserPayload, get_current_user, require_admin
from app.db.session import get_db
from app.main import app
from app.models import Book
from app.schemas.book import BookCreate, BookPage, BookUpdate


class EmptyResult:
    def scalar_one(self):
        return 0

    def scalars(self):
        return self

    def all(self):
        return []


class EmptyBookSession:
    async def execute(self, _statement):
        return EmptyResult()


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()


def valid_book_data() -> dict:
    return {
        "title": "Clean Code",
        "author": "Robert C. Martin",
        "isbn": "9780132350884",
        "description": "Software craftsmanship guide",
        "price": "39.99",
        "stock": 5,
        "cover_url": "https://example.com/clean-code.jpg",
    }


def test_book_create_schema_validates_payload():
    book = BookCreate(**valid_book_data())

    assert book.title == "Clean Code"
    assert book.price == Decimal("39.99")
    assert book.stock == 5


def test_book_create_schema_normalizes_isbn():
    data = valid_book_data()
    data["isbn"] = " 978-0-132350-88-4 "

    assert BookCreate(**data).isbn == "9780132350884"


@pytest.mark.parametrize(
    "field,value",
    [("title", "   "), ("author", "   "), ("isbn", "   ")],
)
def test_book_create_schema_rejects_blank_required_fields(field, value):
    data = valid_book_data()
    data[field] = value

    with pytest.raises(ValueError):
        BookCreate(**data)


@pytest.mark.parametrize(
    "field,value",
    [("price", -1), ("stock", -1)],
)
def test_book_create_schema_rejects_negative_values(field, value):
    data = valid_book_data()
    data[field] = value

    with pytest.raises(ValueError):
        BookCreate(**data)


def test_book_update_schema_requires_one_field():
    with pytest.raises(ValueError):
        BookUpdate()


def test_book_update_schema_accepts_partial_update():
    update = BookUpdate(price="24.50")

    assert update.model_dump(exclude_unset=True) == {"price": Decimal("24.50")}


@pytest.mark.asyncio
async def test_books_list_is_public(client):
    app.dependency_overrides[get_db] = lambda: EmptyBookSession()
    response = await client.get("/api/v1/books")

    assert response.status_code == 200
    assert response.json()["items"] == []


@pytest.mark.asyncio
async def test_book_create_requires_admin(client):
    async def deny_admin():
        raise HTTPException(status_code=403, detail="Admin access required")

    app.dependency_overrides[require_admin] = deny_admin

    response = await client.post("/api/v1/books", json=valid_book_data())

    assert response.status_code == 403
    assert response.json() == {"detail": "Admin access required"}


@pytest.mark.asyncio
async def test_book_create_requires_valid_input_before_database(client):
    async def allow_user():
        return {"sub": str(UUID(int=1))}

    app.dependency_overrides[require_admin] = allow_user
    response = await client.post("/api/v1/books", json={**valid_book_data(), "price": -1})

    assert response.status_code == 422



# --- Pemisahan hak akses admin/user (RBAC) ---
# Endpoint tulis buku memakai `require_admin`; pembacaan tetap publik.


def _as_role(role: str) -> None:
    """Override dependency admin dengan hasil `get_current_user` berrole tertentu.

    `require_admin` diturunkan dari `get_current_user`, jadi mengganti
    `get_current_user` membuktikan pemeriksaan role asli (bukan mock) berjalan.
    """
    app.dependency_overrides[get_current_user] = lambda: UserPayload(id=str(UUID(int=9)), role=role)
    app.dependency_overrides.pop(require_admin, None)


@pytest.mark.asyncio
@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
async def test_book_write_endpoints_reject_user(client, method):
    _as_role("user")
    path = "/api/v1/books" if method == "post" else "/api/v1/books/11111111-1111-1111-1111-111111111111"

    # `httpx` tidak menerima body pada DELETE; kirim body hanya untuk method lain.
    kwargs = {} if method == "delete" else {"json": valid_book_data()}
    response = await getattr(client, method)(path, **kwargs)

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_book_write_endpoints_reject_guest(client):
    response = await client.post("/api/v1/books", json=valid_book_data())
    assert response.status_code == 401


# --- Jalur baca SQLAlchemy → PostgREST dan deteksi konflik ISBN ---
# `books.py` adalah satu-satunya modul yang memakai SQLAlchemy; jalur baca
# jatuh ke PostgREST hanya ketika lapisan database gagal.


class FakeSession:
    """Sesi ORM minimal: `get` mengembalikan objek tetap atau melempar error."""

    def __init__(self, result=None, error=None):
        self._result = result
        self._error = error

    async def get(self, _model, _pk):
        if self._error is not None:
            raise self._error
        return self._result

    async def execute(self, _statement):
        if self._error is not None:
            raise self._error
        return EmptyResult()


def make_book() -> Book:
    now = datetime(2026, 1, 1, tzinfo=UTC)
    return Book(
        id=UUID(int=7),
        title="Clean Code",
        author="Robert C. Martin",
        isbn="9780132350884",
        description=None,
        price=Decimal("39.99"),
        stock=5,
        cover_url=None,
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_load_book_for_read_prefers_the_orm():
    book = make_book()
    result = await load_book_for_read(UUID(int=7), FakeSession(result=book))

    assert result["title"] == "Clean Code"
    assert result["id"] == str(UUID(int=7))


@pytest.mark.asyncio
async def test_load_book_for_read_falls_back_to_postgrest_on_db_failure():
    """Kegagalan lapisan database memicu fallback, bukan 500."""
    rest_row = {"id": str(UUID(int=7)), "title": "Clean Code", "author": "Robert C. Martin"}
    session = FakeSession(error=OperationalError("select 1", {}, Exception("db down")))

    with patch("app.api.v1.books._fetch_book_from_rest", return_value=rest_row):
        result = await load_book_for_read(UUID(int=7), session)

    assert result["title"] == "Clean Code"


@pytest.mark.asyncio
async def test_load_book_for_read_raises_404_when_missing_everywhere():
    session = FakeSession(result=None)
    rest = patch("app.api.v1.books._fetch_book_from_rest", return_value=None)

    with rest, pytest.raises(HTTPException) as exc:
        await load_book_for_read(UUID(int=7), session)

    assert exc.value.status_code == 404

@pytest.mark.asyncio
async def test_load_book_for_write_raises_404_without_rest_fallback():
    """Operasi tulis tidak punya jalur alternatif: baris hilang = 404."""
    with pytest.raises(HTTPException) as exc:
        await load_book_for_write(UUID(int=7), FakeSession(result=None))

    assert exc.value.status_code == 404


def test_isbn_conflict_detected_from_sqlstate():
    orig = Exception("duplicate key value violates unique constraint")
    orig.sqlstate = "23505"

    assert _is_isbn_conflict(IntegrityError("insert", {}, orig))


def test_isbn_conflict_detected_from_constraint_name():
    orig = Exception('duplicate key value violates unique constraint "uq_books_isbn"')

    assert _is_isbn_conflict(IntegrityError("insert", {}, orig))


def test_unrelated_integrity_error_is_not_an_isbn_conflict():
    orig = Exception("null value in column violates not-null constraint")

    assert not _is_isbn_conflict(IntegrityError("insert", {}, orig))


@pytest.mark.asyncio
async def test_list_books_falls_back_to_postgrest_when_host_cannot_be_resolved():
    """Nama host DB yang gagal di-resolve harus jatuh ke PostgREST, bukan 500.

    asyncpg melempar `socket.gaierror` mentah untuk kasus ini; itu turunan
    `OSError`, bukan `SQLAlchemyError`, jadi regresi di sini membuat katalog
    landing page mati total.
    """
    session = FakeSession(error=socket.gaierror(11001, "getaddrinfo failed"))
    rest_page = BookPage(items=[], total=0, page=1, page_size=12)

    with patch("app.api.v1.books._list_books_from_rest", return_value=rest_page) as rest:
        result = await list_books(page=1, page_size=12, q=None, db=session)

    assert rest.called
    assert result is rest_page


@pytest.mark.asyncio
async def test_list_books_does_not_swallow_programming_errors():
    """Hanya kegagalan konektivitas yang di-fallback; bug kode tetap terlihat."""
    session = FakeSession(error=TypeError("bug di kode"))

    with pytest.raises(TypeError):
        await list_books(page=1, page_size=12, q=None, db=session)
