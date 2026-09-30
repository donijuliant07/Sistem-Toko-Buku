from decimal import Decimal
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.db.session import get_db
from app.core.security import require_admin
from app.main import app
from app.schemas.book import BookCreate, BookUpdate


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
