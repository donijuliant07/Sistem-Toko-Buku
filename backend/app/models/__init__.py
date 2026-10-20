"""Model SQLAlchemy.

Merepresentasikan tabel yang diakses lewat sesi ORM: katalog buku beserta
turunan yang butuh transaksi (`Book`, `Profile`, `Promo`), tabel perbandingan
harga marketplace (`MarketplaceSource`, `MarketplacePrice`), tabel
Book Community (`ChatGroup`, `ChatGroupMember`, `ChatMessage`,
`ChatMessageHelpfulMark`), ulasan buku (`Review`), serta sistem poin
(`PointTransaction`, `RewardActivity`, `RewardRule`, `RewardRuleAudit`,
`AIReviewGeneration`).

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
    MODERATION_STATUSES,
    ChatGroup,
    ChatGroupMember,
    ChatMessage,
    ChatMessageHelpfulMark,
)
from app.models.marketplace import MarketplacePrice, MarketplaceSource
from app.models.profile import Profile
from app.models.promo import Promo
from app.models.review import REVIEW_STATUSES, Review
from app.models.rewards import (
    ACTIVITY_STATUSES,
    ACTIVITY_TYPES,
    SOURCE_TYPES,
    TRANSACTION_TYPES,
    AIReviewGeneration,
    PointTransaction,
    RewardActivity,
    RewardRule,
    RewardRuleAudit,
)

__all__ = [
    "ACTIVITY_STATUSES",
    "ACTIVITY_TYPES",
    "GROUP_CATEGORIES",
    "MEMBER_ROLES",
    "MESSAGE_TYPES",
    "MODERATION_STATUSES",
    "REVIEW_STATUSES",
    "SOURCE_TYPES",
    "TRANSACTION_TYPES",
    "AIReviewGeneration",
    "Book",
    "ChatGroup",
    "ChatGroupMember",
    "ChatMessage",
    "ChatMessageHelpfulMark",
    "MarketplacePrice",
    "MarketplaceSource",
    "PointTransaction",
    "Profile",
    "Promo",
    "Review",
    "RewardActivity",
    "RewardRule",
    "RewardRuleAudit",
]
