import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Profile(Base):
    """Profil aplikasi yang terhubung ke pengguna Supabase Auth.

    `role` adalah satu-satunya sumber otorisasi (`app.core.security`); nilainya
    dibatasi CHECK constraint ke `user`/`admin`.
    """

    __tablename__ = "profiles"
    __table_args__ = (
        CheckConstraint("role IN ('user', 'admin')", name="ck_profiles_role"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="CASCADE", use_alter=True),
        primary_key=True,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'user'"))
    # Identifier mudah dicari (CLAUDE.md §2). Nullable di skema: baris lama bisa
    # belum memilikinya, dan keunikannya ditegakkan lewat unique index parsial
    # `uq_profiles_username` (case-insensitive, hanya untuk nilai non-NULL).
    username: Mapped[str | None] = mapped_column(String(50), nullable=True)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=text("now()"),
        server_onupdate=text("now()"),
    )
