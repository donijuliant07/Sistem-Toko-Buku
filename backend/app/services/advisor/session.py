"""Penyimpanan state sesi Book Advisor.

Sengaja **in-memory dan per-proses**, seperti cache ulasan AI dan cooldown
perbandingan harga: tidak ada tabel baru, `DATABASE_URL` yang berisi sandi
tidak masuk ke repo, dan tidak ada perubahan skema ke database live tanpa
persetujuan. Konsekuensinya terdokumentasi (lihat `docs/book-advisor.md`):
sesi hilang saat proses restart dan tidak dibagi antar replika. Bila
persistensi permanen dibutuhkan, `AdvisorSessionStore` adalah satu-satunya
kontrak yang perlu diimplementasikan ulang.
"""

from __future__ import annotations

import time
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Literal, Protocol

from app.schemas.book_advisor import (
    AdvisorFeedbackResponse,
    BookPreferences,
    ConversationState,
)

#: Batas sesi aktif per proses. Yang paling lama tidak aktif dibuang duluan.
MAX_SESSIONS = 500

#: Umur sesi tanpa aktivitas; lebih lama dari ini sesi dianggap tidak ada.
SESSION_TTL_SECONDS = 6 * 60 * 60

#: Riwayat yang disimpan dan dikirim balik ke model. Cukup untuk konteks
#: beberapa giliran terakhir tanpa menggembungkan biaya token.
MAX_HISTORY_MESSAGES = 20

@dataclass
class AdvisorSession:
    """State satu percakapan milik satu pengguna."""

    id: uuid.UUID
    user_id: str
    preferences: BookPreferences = field(default_factory=BookPreferences)
    conversation_state: ConversationState = ConversationState.COLLECTING_PREFERENCES
    messages: list[dict[str, str]] = field(default_factory=list)
    feedback: dict[str, AdvisorFeedbackResponse] = field(default_factory=dict)
    updated_at: float = field(default_factory=time.monotonic)

    @property
    def history(self) -> list[dict[str, str]]:
        """Riwayat terbaru yang aman dikirim ke model."""
        return self.messages[-MAX_HISTORY_MESSAGES:]

    def append(self, role: Literal["user", "assistant"], content: str) -> None:
        """Simpan satu pesan; riwayat di memori dibatasi `MAX_HISTORY_MESSAGES`."""
        self.messages.append({"role": role, "content": content})
        if len(self.messages) > MAX_HISTORY_MESSAGES:
            del self.messages[: len(self.messages) - MAX_HISTORY_MESSAGES]
        self.updated_at = time.monotonic()

class AdvisorSessionStore(Protocol):
    """Kontrak penyimpanan sesi yang dipakai service."""

    def create(self, user_id: str) -> AdvisorSession: ...

    def get(self, session_id: uuid.UUID, user_id: str) -> AdvisorSession | None: ...

class InMemoryAdvisorSessionStore:
    """Store LRU dengan TTL, dibatasi ukuran agar memori tidak tumbuh tanpa batas.

    `get` menuntut `user_id` pemilik: sesi orang lain diperlakukan sebagai
    "tidak ditemukan" sehingga tidak ada celah IDOR lewat menebak UUID.
    """

    def __init__(
        self,
        *,
        max_sessions: int = MAX_SESSIONS,
        ttl_seconds: float = SESSION_TTL_SECONDS,
        clock=time.monotonic,
    ) -> None:
        self._sessions: OrderedDict[uuid.UUID, AdvisorSession] = OrderedDict()
        self._max_sessions = max_sessions
        self._ttl = ttl_seconds
        self._clock = clock

    def create(self, user_id: str) -> AdvisorSession:
        """Sesi baru untuk pengguna ini; sesi tertua dibuang bila penuh."""
        session = AdvisorSession(id=uuid.uuid4(), user_id=user_id, updated_at=self._clock())
        self._sessions[session.id] = session
        while len(self._sessions) > self._max_sessions:
            self._sessions.popitem(last=False)
        return session

    def get(self, session_id: uuid.UUID, user_id: str) -> AdvisorSession | None:
        """Sesi milik `user_id`, atau `None` bila tidak ada, basi, atau milik orang lain."""
        session = self._sessions.get(session_id)
        if session is None:
            return None
        if self._clock() - session.updated_at > self._ttl:
            del self._sessions[session_id]
            return None
        if session.user_id != user_id:
            return None
        self._sessions.move_to_end(session_id)
        return session
