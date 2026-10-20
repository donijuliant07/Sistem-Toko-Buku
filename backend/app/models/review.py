"""Model ulasan buku.

Ulasan adalah **sumber sah** reward ulasan, jadi statusnya disimpan di tabel
sendiri, bukan disimpulkan dari teks. Alur status:

    pending ──approve──► approved ──reward──► rewarded
        └────reject────► rejected ──(edit)──► pending

`rewarded_at` hanya diisi oleh service reward (tahap berikutnya); mengedit
ulasan tidak pernah mengosongkannya, sehingga satu ulasan tidak bisa memberi
reward dua kali.

`UNIQUE (user_id, book_id)` adalah aturan "satu ulasan per pengguna per buku"
dan sekaligus pertahanan pertama terhadap spam ulasan berulang.
"""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, SmallInteger, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

#: Cerminan CHECK `ck_reviews_status` di migrasi `20261019_11`.
REVIEW_STATUSES = ("pending", "approved", "rejected", "rewarded")

_STATUS_SQL = ", ".join(f"'{value}'" for value in REVIEW_STATUSES)


class Review(Base):
    """Satu ulasan pengguna untuk satu buku."""

    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_reviews_rating"),
        CheckConstraint(
            "char_length(btrim(body)) BETWEEN 20 AND 4000", name="ck_reviews_body_len"
        ),
        CheckConstraint(f"status IN ({_STATUS_SQL})", name="ck_reviews_status"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.books.id", ondelete="CASCADE"),
        nullable=False,
    )
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    title: Mapped[str | None] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=text("'pending'")
    )
    moderated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("public.profiles.id", ondelete="SET NULL")
    )
    moderated_at: Mapped[datetime | None] = mapped_column()
    rejection_reason: Mapped[str | None] = mapped_column(String(255))
    rewarded_at: Mapped[datetime | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=text("now()")
    )


__all__ = ["REVIEW_STATUSES", "Review"]
