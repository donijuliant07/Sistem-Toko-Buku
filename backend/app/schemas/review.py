"""Kontrak API ulasan buku.

`body` minimal 20 karakter setelah dirapikan — ulasan satu kata bukan sumber
reward yang sah. Batas atas mencegah satu baris raksasa membebani daftar.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    title: str | None = Field(default=None, max_length=120)
    body: str = Field(..., min_length=20, max_length=4000)

    @model_validator(mode="after")
    def _clean(self) -> ReviewCreate:
        self.body = self.body.strip()
        if self.title is not None:
            self.title = self.title.strip() or None
        if len(self.body) < 20:
            raise ValueError("Ulasan minimal 20 karakter.")
        return self


class ReviewUpdate(BaseModel):
    """Semua field opsional; hanya yang dikirim yang diubah."""

    rating: int | None = Field(default=None, ge=1, le=5)
    title: str | None = Field(default=None, max_length=120)
    body: str | None = Field(default=None, min_length=20, max_length=4000)

    @model_validator(mode="after")
    def _clean(self) -> ReviewUpdate:
        if self.body is not None:
            self.body = self.body.strip()
            if len(self.body) < 20:
                raise ValueError("Ulasan minimal 20 karakter.")
        if self.title is not None:
            self.title = self.title.strip() or None
        return self


class ReviewModeration(BaseModel):
    """Keputusan moderator. `approved` memberi reward; `rejected` tidak."""

    status: str = Field(..., pattern="^(approved|rejected)$")
    reason: str | None = Field(default=None, max_length=255)


class ReviewAuthor(BaseModel):
    id: UUID
    username: str | None = None
    full_name: str | None = None
    avatar_url: str | None = None


class ReviewRead(BaseModel):
    id: UUID
    book_id: UUID
    rating: int
    title: str | None = None
    body: str
    status: str
    author: ReviewAuthor | None = None
    rejection_reason: str | None = None
    rewarded_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ReviewSummary(BaseModel):
    """Ringkasan rating untuk satu buku; hanya ulasan tayang yang dihitung."""

    book_id: UUID
    average_rating: float | None = None
    total: int = 0


class ReviewPage(BaseModel):
    items: list[ReviewRead]
    summary: ReviewSummary
    total: int
    page: int
    limit: int
    total_pages: int


class ReviewQueuePage(BaseModel):
    """Antrean moderasi lintas buku (tanpa ringkasan rating)."""

    items: list[ReviewRead]
    total: int
    page: int
    limit: int
    total_pages: int


__all__ = [
    "ReviewAuthor",
    "ReviewCreate",
    "ReviewModeration",
    "ReviewPage",
    "ReviewQueuePage",
    "ReviewRead",
    "ReviewSummary",
    "ReviewUpdate",
]
