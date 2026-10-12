"""Base class deklaratif SQLAlchemy.

Seluruh model di `app.models` mewarisi `Base`. Ia menyatukan metadata tabel
sehingga `Base.metadata` dapat dipakai Alembic untuk autogenerate.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Kelas dasar bersama untuk seluruh model ORM aplikasi."""
