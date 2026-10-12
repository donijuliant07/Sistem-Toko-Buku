import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Date, Numeric, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Promo(Base):
    """Voucher/diskon. Hanya berlaku saat aktif dan di dalam rentang tanggalnya.

    Status (`Aktif`/`Jadwal`/`Kadaluarsa`/`Nonaktif`) tidak disimpan sebagai
    kolom; nilainya diturunkan dari `is_active` + tanggal oleh `PromoService`.
    """

    __tablename__ = "promos"
    __table_args__ = (
        CheckConstraint(
            "discount_type IN ('Persentase', 'Potongan Tetap', 'Gratis Ongkir')",
            name="ck_promos_discount_type",
        ),
        CheckConstraint("discount_value > 0", name="ck_promos_discount_value_positive"),
        CheckConstraint("min_purchase >= 0", name="ck_promos_min_purchase_nonnegative"),
        CheckConstraint("quota > 0", name="ck_promos_quota_positive"),
        CheckConstraint("used_count >= 0", name="ck_promos_used_count_nonnegative"),
        CheckConstraint("end_date >= start_date", name="ck_promos_date_range"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    code: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    discount_type: Mapped[str] = mapped_column(String(20), nullable=False)
    discount_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    min_purchase: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    max_discount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    quota: Mapped[int] = mapped_column(nullable=False, server_default=text("100"))
    used_count: Mapped[int] = mapped_column(nullable=False, server_default=text("0"))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=text("now()"),
        server_onupdate=text("now()"),
    )
