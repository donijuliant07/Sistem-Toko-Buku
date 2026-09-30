from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, field_validator, model_validator


def normalize_isbn(value: str) -> str:
    """Normalize ISBN input so formatting variants share one unique value."""
    value = value.strip().replace("-", "").replace(" ", "").upper()
    if not value:
        raise ValueError("must not be blank")
    return value


class BookCreate(BaseModel):
    """Payload for creating a book."""

    title: str = Field(min_length=1, max_length=255)
    author: str = Field(min_length=1, max_length=255)
    isbn: str = Field(min_length=1, max_length=32)
    description: str | None = None
    price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    stock: int = Field(default=0, ge=0)
    cover_url: AnyHttpUrl | None = None

    @field_validator("title", "author")
    @classmethod
    def reject_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("isbn")
    @classmethod
    def canonicalize_isbn(cls, value: str) -> str:
        return normalize_isbn(value)


class BookUpdate(BaseModel):
    """Payload for partially updating a book."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    author: str | None = Field(default=None, min_length=1, max_length=255)
    isbn: str | None = Field(default=None, min_length=1, max_length=32)
    description: str | None = None
    price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    stock: int | None = Field(default=None, ge=0)
    cover_url: AnyHttpUrl | None = None

    @field_validator("title", "author")
    @classmethod
    def reject_blank(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("isbn")
    @classmethod
    def canonicalize_isbn(cls, value: str | None) -> str | None:
        return normalize_isbn(value) if value is not None else None

    @model_validator(mode="after")
    def require_change(self):
        if not self.model_dump(exclude_unset=True):
            raise ValueError("at least one field is required")
        return self


class BookRead(BaseModel):
    """Book response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    author: str
    isbn: str
    description: str | None
    price: Decimal
    stock: int
    cover_url: AnyHttpUrl | None
    created_at: datetime
    updated_at: datetime


class BookPage(BaseModel):
    """Paginated book response."""

    items: list[BookRead]
    total: int
    page: int
    page_size: int
