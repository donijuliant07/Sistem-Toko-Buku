"""Skema AI Book Advisor: preferensi pembaca, kandidat, dan kontrak API.

Tiga lapis yang dibedakan tegas:

1. **Preferensi** (`BookPreferences`) — profil kumulatif dalam satu sesi.
   Semua field opsional: `None` berarti *belum diketahui*, bukan "tidak
   dipedulikan". Daftar kosong berarti belum ada isinya.
2. **Delta** (`PreferenceDelta`) — hasil ekstraksi model untuk satu pesan.
   Field `None` = model tidak menemukan informasi baru; nilai terisi =
   perubahan yang digabungkan oleh `app.services.advisor.preferences`.
3. **Respons** (`AdvisorChatResponse`) — bentuk yang dikonsumsi frontend.
   Harga, stok, dan ID buku di sini **selalu** berasal dari repository, tidak
   pernah dari teks model.
"""

from decimal import Decimal
from enum import Enum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

MAX_LIST_ITEMS = 10
MAX_ITEM_LENGTH = 80

class ReadingLevel(str, Enum):
    """Tingkat pembaca yang didukung."""

    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"

class PreferredStyle(str, Enum):
    """Gaya penyampaian yang didukung."""

    PRACTICAL = "practical"
    THEORETICAL = "theoretical"
    NARRATIVE = "narrative"
    ILLUSTRATIVE = "illustrative"

class PreferredLength(str, Enum):
    """Preferensi panjang buku."""

    SHORT = "short"
    MEDIUM = "medium"
    LONG = "long"

class ConversationState(str, Enum):
    """Status percakapan; ditentukan backend, bukan model."""

    COLLECTING_PREFERENCES = "collecting_preferences"
    READY_TO_RECOMMEND = "ready_to_recommend"
    SHOWING_RECOMMENDATIONS = "showing_recommendations"

class AdvisorOutcome(str, Enum):
    """Bagaimana satu pesan dilayani — dasar keputusan tagihan poin.

    - `answered`: AI memproses dan menjawab (ditagih).
    - `provider_failed`: API key ada tetapi provider gagal; balasan jatuh ke
      aturan. Router me-refund bila sebelumnya sudah ditagih.
    - `unconfigured`: provider AI tidak dikonfigurasi sama sekali; tidak
      pernah ditagih, karena bukan layanan AI yang dipakai.

    Provider mengembalikan JSON yang tidak sesuai bentuk juga dihitung
    `provider_failed`: panggilan sudah dibayar ke provider tetapi balasan
    tidak dapat disajikan, sehingga pengguna tidak boleh ikut menanggungnya.
    """

    ANSWERED = "answered"
    PROVIDER_FAILED = "provider_failed"
    UNCONFIGURED = "unconfigured"

class ModelSource(str, Enum):
    """Dari mana teks balasan berasal."""

    MODEL = "model"
    RULE_BASED = "rule_based"

def _clean_items(values: list[str] | None) -> list[str] | None:
    """Rapikan daftar teks dari model: buang kosong/duplikat, batasi jumlah.

    Input model tidak tepercaya, jadi pemotongan dilakukan di sini — bukan
    setelah disimpan ke profil sesi.
    """
    if values is None:
        return None
    seen: list[str] = []
    for raw in values:
        item = (raw or "").strip()[:MAX_ITEM_LENGTH]
        if item and item.casefold() not in {v.casefold() for v in seen}:
            seen.append(item)
    return seen[:MAX_LIST_ITEMS]

class BookPreferences(BaseModel):
    """Profil preferensi kumulatif satu sesi.

    Field yang tidak punya metadata pendukung di katalog (gaya, panjang,
    bahasa, format) tetap disimpan supaya pertanyaan lanjutan tidak diulang,
    tetapi **tidak** ikut diberi skor — lihat `app.services.advisor.ranking`.
    """

    interests: list[str] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)
    genres: list[str] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)
    reading_level: ReadingLevel | None = None
    reading_goals: list[str] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)
    preferred_style: PreferredStyle | None = None
    preferred_language: str | None = Field(default=None, max_length=32)
    min_budget: Decimal | None = Field(default=None, ge=0, le=100_000_000)
    max_budget: Decimal | None = Field(default=None, ge=0, le=100_000_000)
    preferred_length: PreferredLength | None = None
    favorite_authors: list[str] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)
    liked_books: list[str] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)
    disliked_books: list[str] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)
    format_preferences: list[str] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)
    availability_preferences: Literal["in_stock_only"] | None = None

    @field_validator(
        "interests",
        "genres",
        "reading_goals",
        "favorite_authors",
        "liked_books",
        "disliked_books",
        "format_preferences",
        mode="before",
    )
    @classmethod
    def clean_list(cls, value: object) -> list[str]:
        """Terima `None` sebagai daftar kosong dan rapikan isinya."""
        if value is None:
            return []
        if not isinstance(value, list):
            raise TypeError("harus berupa daftar teks")
        return _clean_items([str(item) for item in value]) or []

    @field_validator("preferred_language")
    @classmethod
    def clean_language(cls, value: str | None) -> str | None:
        """Rapikan kode/nama bahasa; kosong berarti belum diketahui."""
        if value is None:
            return None
        value = value.strip()
        return value or None

    @model_validator(mode="after")
    def check_budget_range(self) -> "BookPreferences":
        """Rentang anggaran harus konsisten."""
        if (
            self.min_budget is not None
            and self.max_budget is not None
            and self.min_budget > self.max_budget
        ):
            raise ValueError("min_budget tidak boleh lebih besar dari max_budget")
        return self

class PreferenceDelta(BaseModel):
    """Perubahan preferensi hasil ekstraksi satu pesan pengguna.

    `None` = tidak ada informasi baru. Daftar terisi = ditambahkan ke daftar
    yang sudah ada (union), bukan menggantinya — kecuali `reset_interests`
    yang secara eksplisit meminta penggantian.
    """

    interests: list[str] | None = None
    genres: list[str] | None = None
    reading_level: ReadingLevel | None = None
    reading_goals: list[str] | None = None
    preferred_style: PreferredStyle | None = None
    preferred_language: str | None = None
    min_budget: Decimal | None = Field(default=None, ge=0, le=100_000_000)
    max_budget: Decimal | None = Field(default=None, ge=0, le=100_000_000)
    preferred_length: PreferredLength | None = None
    favorite_authors: list[str] | None = None
    liked_books: list[str] | None = None
    disliked_books: list[str] | None = None
    format_preferences: list[str] | None = None
    availability_preferences: Literal["in_stock_only"] | None = None
    reset_interests: bool = False

    @field_validator(
        "interests",
        "genres",
        "reading_goals",
        "favorite_authors",
        "liked_books",
        "disliked_books",
        "format_preferences",
        mode="before",
    )
    @classmethod
    def clean_delta_list(cls, value: object) -> list[str] | None:
        """Rapikan daftar delta; `None` tetap berarti "tidak berubah"."""
        if value is None:
            return None
        if not isinstance(value, list):
            raise TypeError("harus berupa daftar teks")
        return _clean_items([str(item) for item in value]) or None

    @field_validator("preferred_language")
    @classmethod
    def clean_delta_language(cls, value: str | None) -> str | None:
        """Rapikan bahasa dari model."""
        if value is None:
            return None
        value = value.strip()
        return value or None

class CandidateBook(BaseModel):
    """Satu kandidat dari katalog; sumbernya repository, bukan model."""

    id: UUID
    title: str
    author: str
    price: Decimal
    stock: int
    description: str | None = None
    cover_url: str | None = None
    category: str | None = None

class Recommendation(BaseModel):
    """Satu rekomendasi yang lolos validasi backend."""

    book: CandidateBook
    reason: str = Field(description="Alasan kecocokan, dari backend atau model yang sudah divalidasi")
    score: float = Field(ge=0, le=1)

class AdvisorChatRequest(BaseModel):
    """Payload `POST /book-advisor/chat`.

    `message_id` dibuat **frontend sekali per pesan** dan dikirim ulang apa
    adanya saat retry. Backend memakainya sebagai kunci idempotensi tagihan
    (`advisor:<message_id>:charge`), sehingga kirim ulang tidak memotong poin
    dua kali. Bila tidak dikirim, backend membuat ID sendiri — aman, tetapi
    retry dari klien lama tidak terlindungi.
    """

    message: str = Field(min_length=1, max_length=2000)
    session_id: UUID | None = None
    message_id: UUID | None = None

    @field_validator("message")
    @classmethod
    def reject_blank_message(cls, value: str) -> str:
        """Pesan kosong/spasi ditolak sebelum sampai ke model."""
        value = value.strip()
        if not value:
            raise ValueError("pesan tidak boleh kosong")
        return value

class AdvisorChatResponse(BaseModel):
    """Respons satu giliran percakapan.

    `recommendations` kosong berarti sistem masih mengumpulkan preferensi;
    `follow_up_question` boleh `None` bila rekomendasi sudah diberikan.

    Field `points_*` diisi router dari ledger — **bukan** dari klien. Frontend
    hanya menampilkan angka ini; nilai yang dikirim browser tidak pernah
    dipakai untuk menghitung biaya atau saldo.
    """

    session_id: UUID
    #: ID pesan dari klien; dipakai sebagai kunci idempotensi tagihan.
    message_id: UUID | None = None
    assistant_message: str
    conversation_state: ConversationState
    preferences: BookPreferences
    missing_preferences: list[str] = Field(default_factory=list)
    recommendations: list[Recommendation] = Field(default_factory=list)
    follow_up_question: str | None = None
    #: Bagaimana pesan ini dilayani; `provider_failed` berarti poin dikembalikan.
    outcome: AdvisorOutcome = AdvisorOutcome.UNCONFIGURED
    model_source: ModelSource = ModelSource.RULE_BASED
    #: Biaya aturan saat ini (0 bila AI tidak dikonfigurasi).
    points_cost: int = 0
    #: Poin yang benar-benar dipotong untuk pesan ini.
    points_charged: int = 0
    #: Poin yang dikembalikan karena kegagalan provider.
    points_refunded: int = 0
    #: Saldo setelah operasi; `None` bila tidak dapat dibaca.
    points_balance: int | None = None

class AdvisorMessage(BaseModel):
    """Satu pesan tersimpan dalam riwayat sesi."""

    role: Literal["user", "assistant"]
    content: str

class AdvisorSessionRead(BaseModel):
    """Ringkasan sesi beserta riwayat pesannya."""

    session_id: UUID
    conversation_state: ConversationState
    preferences: BookPreferences
    messages: list[AdvisorMessage]

class AdvisorFeedbackRequest(BaseModel):
    """Feedback pengguna atas satu rekomendasi."""

    session_id: UUID
    book_id: UUID
    feedback: Literal["liked", "not_relevant"]
    reason: str | None = Field(default=None, max_length=500)

class AdvisorFeedbackResponse(BaseModel):
    """Konfirmasi feedback tersimpan di sesi."""

    session_id: UUID
    book_id: UUID
    feedback: Literal["liked", "not_relevant"]
