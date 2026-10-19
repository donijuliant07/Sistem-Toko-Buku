"""Skema request/response `PATCH /book-advisor/preferences`.

Dibedakan dari `PreferenceDelta`: di sini `None` **tidak** dipakai untuk
mengosongkan field — untuk daftar, kirim daftar kosong. Sesi target wajib
disebutkan karena profil preferensi hidup di dalam sesi (lihat
`app.services.advisor.session`).
"""

from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.schemas.book_advisor import PreferredLength, PreferredStyle, ReadingLevel


class AdvisorPreferenceUpdate(BaseModel):
    """Perubahan preferensi eksplisit oleh pemilik sesi."""

    session_id: UUID
    interests: list[str] | None = Field(default=None, max_length=10)
    genres: list[str] | None = Field(default=None, max_length=10)
    reading_level: ReadingLevel | None = None
    reading_goals: list[str] | None = Field(default=None, max_length=10)
    preferred_style: PreferredStyle | None = None
    preferred_language: str | None = Field(default=None, max_length=32)
    min_budget: Decimal | None = Field(default=None, ge=0, le=100_000_000)
    max_budget: Decimal | None = Field(default=None, ge=0, le=100_000_000)
    preferred_length: PreferredLength | None = None
    favorite_authors: list[str] | None = Field(default=None, max_length=10)
    liked_books: list[str] | None = Field(default=None, max_length=10)
    disliked_books: list[str] | None = Field(default=None, max_length=10)
    format_preferences: list[str] | None = Field(default=None, max_length=10)
    availability_preferences: Literal["in_stock_only"] | None = None

    @model_validator(mode="after")
    def require_change(self) -> "AdvisorPreferenceUpdate":
        """Patch kosong ditolak agar tidak menimbulkan request tanpa makna."""
        if not self.model_dump(exclude={"session_id"}, exclude_unset=True):
            raise ValueError("minimal satu preferensi harus dikirim")
        return self
