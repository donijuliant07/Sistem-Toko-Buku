"""Model SQLAlchemy.

Merepresentasikan tabel yang diakses lewat sesi ORM. Saat ini hanya tabel yang
disentuh endpoint tulis `books`: `Book`, `Profile`, dan `Promo`.

Sebagian besar tabel lain yang dipakai aplikasi (`orders`, `order_items`,
`payments`, `carts`, `cart_items`, `categories`) dibaca lewat PostgREST di
`app.core.supabase` dan karena itu **tidak** punya model di sini. Jadi daftar
model ini sengaja tidak mencerminkan seluruh skema database.
"""

from app.models.book import Book
from app.models.profile import Profile
from app.models.promo import Promo

__all__ = ["Book", "Profile", "Promo"]
