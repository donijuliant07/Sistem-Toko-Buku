"""Orkestrasi satu giliran percakapan AI Book Advisor.

Tidak ada query maupun HTTP di sini — semuanya lewat kontrak yang disuntikkan
(`AdvisorCatalog`, `AdvisorSessionStore`, `ModelClient`), sehingga alurnya
dapat diuji tanpa database dan tanpa API berbayar.

Alur satu giliran:

1. Muat sesi milik pengguna, atau buat sesi baru bila `session_id` tidak
   dikirim / bukan miliknya (tidak pernah mengakses sesi orang lain).
2. Satu panggilan model:
   - preferensi belum cukup → **ekstraksi**: delta preferensi + balasan +
     pertanyaan;
   - pesan hanya sapaan/obrolan (`chit_chat`) → balas natural, tanpa mencari buku;
   - preferensi sudah cukup → **penjelasan** atas kandidat pilihan backend.
3. Gabungkan delta ke profil kumulatif.
4. Bila cukup: cari kandidat (syarat wajib diterapkan repository), ranking,
   lalu validasi keluaran model terhadap kandidat tersebut.

Status percakapan (`conversation_state`) diputuskan backend, bukan model.
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass
from typing import Any, Protocol

from app.schemas.book_advisor import (
    AdvisorChatRequest,
    AdvisorChatResponse,
    AdvisorFeedbackRequest,
    AdvisorFeedbackResponse,
    AdvisorMessage,
    AdvisorOutcome,
    AdvisorSessionRead,
    BookPreferences,
    ConversationState,
    ModelSource,
    ReadingLevel,
    Recommendation,
)
from app.services.advisor import gemini
from app.services.advisor import preferences as pref_rules
from app.services.advisor.catalog import AdvisorCatalog
from app.services.advisor.ranking import ScoredCandidate, rank_candidates
from app.services.advisor.session import AdvisorSession, AdvisorSessionStore
from app.services.advisor.validation import (
    heuristic_delta,
    parse_explanation,
    parse_extraction,
    small_talk_reply,
    validate_recommendations,
)

logger = logging.getLogger(__name__)

#: Jumlah rekomendasi yang ditampilkan per giliran.
MAX_RECOMMENDATIONS = 5

#: Kandidat teratas yang dikirim ke model untuk diberi penjelasan. Sisanya
#: hanya dipakai ranking — mengirim seluruh kandidat menambah biaya token.
MAX_CONTEXT_CANDIDATES = 10

#: Catatan yang ditambahkan ke balasan bila provider AI gagal; pengguna harus
#: tahu balasan itu berasal dari aturan, bukan AI.
PROVIDER_FAILED_NOTICE = (
    "\n\n_(Catatan: layanan AI sedang gangguan, jadi balasan di atas berasal dari "
    "panduan berbasis aturan. Poin untuk pesan ini dikembalikan — silakan coba lagi nanti.)_"
)


@dataclass
class _TurnTracker:
    """Hasil panggilan model dalam satu giliran, untuk menentukan tagihan.

    Satu giliran bisa memanggil model dua kali (ekstraksi lalu penjelasan).
    Giliran dianggap dilayani AI bila **setidaknya satu** panggilan berhasil;
    `provider_failed` hanya bila provider dikonfigurasi tetapi semua panggilan
    gagal, sehingga balasan yang dilihat pengguna seluruhnya buatan aturan.
    """

    model_calls: int = 0
    model_succeeded: bool = False
    provider_failed: bool = False

class ModelClient(Protocol):
    """Kontrak klien model yang dipakai service."""

    @property
    def is_configured(self) -> bool:
        """Apakah klien punya API key."""
        ...

    async def complete_json(self, messages: list[dict[str, str]]) -> dict[str, Any]:
        """Kirim percakapan, kembalikan objek JSON."""
        ...

class BookAdvisorService:
    """Menjalankan alur percakapan dan mengembalikan respons tervalidasi."""

    def __init__(
        self,
        *,
        catalog: AdvisorCatalog,
        store: AdvisorSessionStore,
        model: ModelClient,
        weights: dict[str, float] | None = None,
    ) -> None:
        self._catalog = catalog
        self._store = store
        self._model = model
        self._weights = weights

    @property
    def ai_enabled(self) -> bool:
        """Apakah provider AI dikonfigurasi (API key tersedia).

        Router memakai ini untuk memutuskan apakah pesan perlu ditagih. Tanpa
        provider, advisor berbasis aturan dan tidak pernah memotong poin.
        """
        return bool(self._model.is_configured)

    async def chat(self, user_id: str, payload: AdvisorChatRequest) -> AdvisorChatResponse:
        """Proses satu pesan pengguna dan kembalikan giliran percakapan."""
        session = self._load_or_create(user_id, payload.session_id)

        # `turn` dikumpulkan selama satu giliran; `_call` mencatat kegagalan
        # provider agar tagihan poin di router tahu apakah fallback terjadi.
        turn = _TurnTracker()
        configured = self._model.is_configured

        session.append("user", payload.message)

        # Ekstraksi selalu dijalankan, termasuk saat preferensi sudah cukup:
        # "cari yang lebih murah" atau "aku pemula" adalah perubahan preferensi
        # yang harus tertangkap, bukan sekadar permintaan ulang.
        if not configured:
            delta = heuristic_delta(payload.message, session.preferences)
            chat = small_talk_reply(payload.message)
            reply = chat or self._fallback_reply(delta)
            question = None
            intent = "chit_chat" if chat else None
        else:
            delta, reply, question, intent = await self._extract(session, payload.message, turn)

        if delta is not None:
            session.preferences = pref_rules.merge_preferences(session.preferences, delta)

        # Sapaan/obrolan ringan dijawab apa adanya; jangan menembak daftar buku
        # hanya karena preferensi lama sudah lengkap.
        if intent == "chit_chat" and reply:
            session.conversation_state = (
                ConversationState.READY_TO_RECOMMEND
                if pref_rules.is_ready(session.preferences)
                else ConversationState.COLLECTING_PREFERENCES
            )
            answer = self._join_reply(reply, question)
            session.append("assistant", answer)
            return self._response(session, turn, configured, answer, question, [])

        if not pref_rules.is_ready(session.preferences):
            session.conversation_state = ConversationState.COLLECTING_PREFERENCES
            # Balasan model mengobrol apa adanya (sapaan, tanggapan, pertanyaan).
            # Backend hanya menambal bila model tidak memberi kalimat sama sekali,
            # atau mengulang pertanyaan identik yang baru saja ditanyakan.
            answer = self._join_reply(reply, question) or self._ask_question(session.preferences)
            if len(session.messages) >= 2 and session.messages[-2]["content"] == answer:
                answer = self._ask_question(session.preferences)
            session.append("assistant", answer)
            return self._response(
                session, turn, configured, answer, self._extra_question(answer, question), []
            )

        scored = await self._search_and_rank(session.preferences)
        reply, question, recommendations = await self._explain(
            session, payload.message, scored, turn
        )

        session.conversation_state = (
            ConversationState.SHOWING_RECOMMENDATIONS
            if recommendations
            else ConversationState.READY_TO_RECOMMEND
        )
        answer = self._join_reply(reply, question) or self._no_result_message(recommendations)
        session.append("assistant", answer)
        return self._response(
            session,
            turn,
            configured,
            answer,
            self._extra_question(answer, question),
            recommendations,
        )

    def get_session(self, user_id: str, session_id: uuid.UUID) -> AdvisorSessionRead:
        """Riwayat sesi milik `user_id`; `KeyError` bila tidak ada/bukan miliknya."""
        session = self._store.get(session_id, user_id)
        if session is None:
            raise KeyError(str(session_id))
        return AdvisorSessionRead(
            session_id=session.id,
            conversation_state=session.conversation_state,
            preferences=session.preferences,
            messages=[AdvisorMessage(role=message["role"], content=message["content"]) for message in session.messages],
        )

    def get_preferences(self, user_id: str, session_id: uuid.UUID | None) -> BookPreferences:
        """Preferensi sesi pengguna; `None` sesi belum ada = profil kosong."""
        if session_id is None:
            return BookPreferences()
        session = self._store.get(session_id, user_id)
        if session is None:
            raise KeyError(str(session_id))
        return session.preferences

    def update_preferences(
        self, user_id: str, session_id: uuid.UUID, changes: dict[str, Any]
    ) -> BookPreferences:
        """Terapkan perubahan eksplisit dari pengguna ke sesi miliknya.

        Perubahan digabung dengan aturan yang sama seperti hasil model —
        daftar ditambahkan, field `None` berarti "tidak diubah" — lalu
        divalidasi ulang oleh Pydantic.
        """
        session = self._store.get(session_id, user_id)
        if session is None:
            raise KeyError(str(session_id))
        session.preferences = pref_rules.merge_user_changes(session.preferences, changes)
        session.updated_at = time.monotonic()
        return session.preferences

    def add_feedback(self, user_id: str, payload: AdvisorFeedbackRequest) -> AdvisorFeedbackResponse:
        """Simpan feedback dan jadikan sinyal untuk pencarian berikutnya."""
        session = self._store.get(payload.session_id, user_id)
        if session is None:
            raise KeyError(str(payload.session_id))
        response = AdvisorFeedbackResponse(
            session_id=payload.session_id,
            book_id=payload.book_id,
            feedback=payload.feedback,
        )
        session.feedback[str(payload.book_id)] = response
        if payload.feedback == "not_relevant":
            # "Tidak cocok" berarti buku itu tidak boleh muncul lagi di sesi ini.
            session.preferences.disliked_books = list(
                dict.fromkeys([*session.preferences.disliked_books, str(payload.book_id)])
            )[:10]
        session.updated_at = time.monotonic()
        return response

    def _load_or_create(self, user_id: str, session_id: uuid.UUID | None) -> AdvisorSession:
        """Sesi lama bila ada dan milik pengguna; selain itu sesi baru."""
        if session_id is not None:
            session = self._store.get(session_id, user_id)
            if session is not None:
                return session
        return self._store.create(user_id)

    async def _extract(
        self, session: AdvisorSession, message: str, turn: _TurnTracker
    ) -> tuple[Any, str | None, str | None, str | None]:
        """Minta delta preferensi; gagal → kosong semua (tanpa perubahan)."""
        messages = gemini.build_extraction_messages(
            session.history,
            session.preferences,
            message,
            pref_rules.missing_preferences(session.preferences),
        )
        raw = await self._call(messages, turn)
        if raw is None:
            return None, None, None, None
        reply, question = parse_extraction(raw)
        delta = pref_rules.parse_delta(raw.get("extracted_preferences") or raw.get("delta"))
        intent = raw.get("conversation_intent")
        return delta, reply, question, intent if isinstance(intent, str) else None

    async def _explain(
        self,
        session: AdvisorSession,
        message: str,
        scored: list[ScoredCandidate],
        turn: _TurnTracker,
    ) -> tuple[str | None, str | None, list[Recommendation]]:
        """Minta penjelasan dan validasi hasilnya terhadap kandidat backend.

        Tanpa kandidat, model tidak dipanggil sama sekali: jawabannya harus
        jujur ("tidak ada yang cocok"), bukan teks model yang mungkin
        menawarkan buku fiktif.
        """
        if not scored:
            return None, None, []
        top = scored[:MAX_CONTEXT_CANDIDATES]
        if not self._model.is_configured:
            return self._rule_explanation(top, session.preferences)
        raw = await self._call(
            gemini.build_explanation_messages(
                session.history, session.preferences, [item.book for item in top], message
            ),
            turn,
        )
        if raw is None:
            return self._rule_explanation(top, session.preferences)
        reply, question, recommendations = parse_explanation(raw, top, session.preferences)
        # Urutan akhir mengikuti ranking backend, bukan urutan dari model.
        ranked = {str(rec.book.id): rec for rec in recommendations}
        ordered = [ranked[str(item.book.id)] for item in top if str(item.book.id) in ranked]
        return reply, question, ordered[:MAX_RECOMMENDATIONS]

    async def _call(
        self, messages: list[dict[str, str]], turn: _TurnTracker
    ) -> dict[str, Any] | None:
        """Panggil model; kegagalan dicatat dan diterjemahkan menjadi `None`.

        `turn` menandai bahwa provider gagal — pemanggil layanan tidak dapat
        menebak ini dari `None`, sehingga tagihan poin bergantung padanya.
        """
        turn.model_calls += 1
        try:
            raw = await self._model.complete_json(messages)
        except gemini.AdvisorModelError:
            turn.provider_failed = True
            logger.warning("Model AI gagal dihubungi; memakai fallback aturan", exc_info=False)
            return None
        turn.model_succeeded = True
        return raw

    async def _search_and_rank(self, preferences: BookPreferences) -> list[ScoredCandidate]:
        """Kandidat dari katalog, difilter syarat wajib lalu diranking."""
        candidates = await self._catalog.search(preferences)
        return rank_candidates(preferences, candidates, weights=self._weights)

    @staticmethod
    def _rule_explanation(
        scored: list[ScoredCandidate], preferences: BookPreferences
    ) -> tuple[str, str | None, list[Recommendation]]:
        """Penjelasan dari sinyal yang dihitung backend, tanpa teks model."""
        recs = validate_recommendations([], scored[:MAX_RECOMMENDATIONS], preferences)
        return BookAdvisorService._summary(recs), None, recs

    @staticmethod
    def _summary(recommendations: list[Recommendation]) -> str:
        """Ringkasan rekomendasi yang terdengar seperti sedang mengobrol, dari data backend.

        Menyebut dua pilihan teratas beserta alasan backend dan harganya, lalu
        mengajak pengguna mempersempit atau memilih — bukan satu kalimat acak.
        """
        if not recommendations:
            return BookAdvisorService._no_result_message(recommendations)
        top = recommendations[0].book
        harga = f"Rp{int(top.price):,}".replace(",", ".")
        text = (
            f"Menurut katalog kami, '{top.title}' karya {top.author} paling pas untukmu "
            f"(harga {harga}). {recommendations[0].reason}"
        )
        if len(recommendations) > 1:
            second = recommendations[1].book
            text += f" Sebagai pembanding, ada juga '{second.title}' karya {second.author}."
        return text + " Mau aku persempit lagi, atau cukup ini dulu?"

    @staticmethod
    def _extra_question(answer: str, question: str | None) -> str | None:
        """Kirim `follow_up_question` hanya bila belum ada di dalam balasan."""
        if not question or question in answer:
            return None
        # Bila balasan diakhiri pertanyaan (yang mungkin menyerupai `question`),
        # klien sudah punya pertanyaannya; jangan kirim pertanyaan kedua.
        return None if _looks_like_question(answer) else question

    def _response(
        self,
        session: AdvisorSession,
        turn: _TurnTracker,
        configured: bool,
        message: str,
        question: str | None,
        recommendations: list[Recommendation],
    ) -> AdvisorChatResponse:
        """Bentuk respons; pertanyaan hanya dikirim bila masih ada yang berguna ditanya.

        `outcome` adalah satu-satunya sinyal tagihan: router menagih hanya bila
        AI benar-benar memproses pesan, dan me-refund bila provider gagal.
        """
        if not configured or turn.model_calls == 0:
            outcome = AdvisorOutcome.UNCONFIGURED
        elif turn.model_succeeded:
            outcome = AdvisorOutcome.ANSWERED
        else:
            outcome = AdvisorOutcome.PROVIDER_FAILED
            message = f"{message}{PROVIDER_FAILED_NOTICE}"
        return AdvisorChatResponse(
            session_id=session.id,
            assistant_message=message,
            conversation_state=session.conversation_state,
            preferences=session.preferences,
            missing_preferences=pref_rules.missing_preferences(session.preferences),
            recommendations=recommendations,
            follow_up_question=question,
            outcome=outcome,
            model_source=(
                ModelSource.MODEL
                if turn.model_succeeded
                else ModelSource.RULE_BASED
            ),
        )

    @staticmethod
    def _join_reply(reply: str | None, question: str | None) -> str | None:
        """Gabungkan balasan dan pertanyaan bila keduanya ada; hindari duplikasi.

        Model sering menulis pertanyaannya di akhir `assistant_message` *dan*
        mengulangnya di `follow_up_question`. Bila kalimat terakhir balasan sudah
        merupakan pertanyaan yang sama, balasan dipakai apa adanya.
        """
        if not reply:
            return question
        if not question:
            return reply
        if question in reply or _looks_like_question(reply):
            return reply
        return f"{reply}\n\n{question}"

    @staticmethod
    def _fallback_reply(delta: Any) -> str | None:
        """Kalimat pengakuan dari preferensi yang baru ditangkap, tanpa model.

        Bukan pengganti percakapan AI — hanya membuat mode tanpa API key tidak
        terasa seperti formulir kosong.
        """
        parts: list[str] = []
        if delta.interests:
            parts.append(f"Siap, aku catat minatmu soal {', '.join(delta.interests)}.")
        if delta.max_budget is not None:
            harga = f"Rp{int(delta.max_budget):,}".replace(",", ".")
            parts.append(f"Anggaran maksimal {harga} juga sudah kucatat.")
        if delta.reading_level == ReadingLevel.BEGINNER:
            parts.append("Aku akan utamakan buku yang ramah untuk pemula.")
        return " ".join(parts) or None

    @staticmethod
    def _ask_question(preferences: BookPreferences) -> str:
        """Pertanyaan lanjutan dari backend saat model tidak memberi satu."""
        missing = pref_rules.missing_preferences(preferences)
        if "interests" in missing:
            return "Buku tentang apa yang lagi bikin kamu penasaran? Cerita aja, nanti aku bantu carikan."
        if "max_budget" in missing:
            return "Ada batas anggaran untuk bukunya, atau bebas?"
        return "Mau aku carikan rekomendasi sekarang, atau ada preferensi lain?"

    @staticmethod
    def _no_result_message(recommendations: list[Recommendation]) -> str:
        """Balasan bawaan; jujur bila katalog tidak punya kandidat yang cocok."""
        if recommendations:
            top = recommendations[0].book
            return f"Menurut katalog kami, '{top.title}' karya {top.author} paling cocok untukmu."
        return (
            "Belum ada buku di katalog yang cocok dengan preferensi itu. "
            "Coba longgarkan anggaran atau sebutkan minat lain."
        )

def _looks_like_question(text: str) -> bool:
    """Apakah paragraf terakhir teks diakhiri tanda tanya."""
    last = text.rstrip().rsplit("\n", 1)[-1].strip()
    return last.endswith("?")


def build_service(catalog: AdvisorCatalog, store: AdvisorSessionStore) -> BookAdvisorService:
    """Susun service dengan klien model bersama aplikasi."""
    return BookAdvisorService(catalog=catalog, store=store, model=gemini.get_gemini_client())
