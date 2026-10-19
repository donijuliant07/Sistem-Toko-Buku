"""Model SQLAlchemy.

Merepresentasikan tabel yang diakses lewat sesi ORM: katalog buku beserta
turunan yang butuh transaksi (`Book`, `Profile`, `Promo`), tabel perbandingan
harga marketplace (`MarketplaceSource`, `MarketplacePrice`), dan tabel
Book Community (`ChatGroup`, `ChatGroupMember`, `ChatMessage`).

Sebagian besar tabel lain yang dipakai aplikasi (`orders`, `order_items`,
`payments`, `carts`, `cart_items`, `categories`) dibaca lewat PostgREST di
`app.core.supabase` dan karena itu **tidak** punya model di sini. Jadi daftar
model ini sengaja tidak mencerminkan seluruh skema database.
"""

from app.models.book import Book
from app.models.community import (
    GROUP_CATEGORIES,
    MEMBER_ROLES,
    MESSAGE_TYPES,
    ChatGroup,
    ChatGroupMember,
    ChatMessage,
)
from app.models.marketplace import MarketplacePrice, MarketplaceSource
from app.models.profile import Profile
from app.models.promo import Promo

__all__ = [
    "GROUP_CATEGORIES",
    "MEMBER_ROLES",
    "MESSAGE_TYPES",
    "Book",
    "ChatGroup",
    "ChatGroupMember",
    "ChatMessage",
    "MarketplacePrice",
    "MarketplaceSource",
    "Profile",
    "Promo",
]
