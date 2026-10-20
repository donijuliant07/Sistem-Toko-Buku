"""Pengujian AI Book Advisor — tanpa database dan tanpa panggilan ke Gemini.

Yang diuji adalah bagian yang paling mudah rusak diam-diam:

1. **Penggabungan preferensi** — preferensi lama dipertahankan saat pengguna
   hanya menyebut satu hal baru, dan "cari yang lebih murah" tidak menghapus
   minat.
2. **Ranking** — bobot hanya dibagi untuk sinyal yang datanya ada, batas
   anggaran tidak pernah dilanggar, tie-break deterministik.
3. **Validasi keluaran model** — ID buku karangan dibuang, skor tetap dari
   backend, alasan kosong diganti alasan backend.
4. **Alur percakapan** — pertanyaan lanjutan saat preferensi belum cukup,
   rekomendasi saat sudah cukup, dan kepemilikan sesi.
5. **Endpoint** — autentikasi, validasi input, dan 404 untuk sesi orang lain.
6. **Klien Gemini** — parsing JSON, penolakan 4xx, dan tidak bocor ke log.
"""

import json
import uuid
from decimal import Decimal

import httpx
import pytest

from app.api.v1 import book_advisor as advisor_api
from app.core.security import UserPayload, require_user
from app.main import app
from app.schemas.book_advisor import (
    AdvisorChatRequest,
    AdvisorFeedbackRequest,
    BookPreferences,
    CandidateBook,
    PreferenceDelta,
)
from app.services.advisor import gemini
from app.services.advisor.catalog import candidate_ids
from app.services.advisor.preferences import (
    is_ready,
    merge_preferences,
    merge_user_changes,
    missing_preferences,
)
from app.services.advisor.ranking import DEFAULT_WEIGHTS, rank_candidates
from app.services.advisor.service import BookAdvisorService
from app.services.advisor.session import InMemoryAdvisorSessionStore
from app.services.advisor.validation import heuristic_delta, validate_recommendations

USER_ID = "user-1"
OTHER_USER_ID = "user-2"

def book(title: str, price: str = "90000", category: str = "Bisnis & Keuangan", stock: int = 3) -> CandidateBook:
    """Kandidat uji dengan ID unik per judul."""
    return CandidateBook(
        id=uuid.uuid5(uuid.NAMESPACE_DNS, title),
        title=title,
        author="Penulis Uji",
        description="Deskripsi uji",
        price=Decimal(price),
        stock=stock,
        category=category,
    )

class FakeCatalog:
    """Katalog palsu: menyimpan kandidat dan merekam preferensi terakhir."""

    def __init__(self, books: list[CandidateBook]) -> None:
        self.books = books
        self.calls = 0
        self.last_preferences: BookPreferences | None = None

    async def search(self, preferences: BookPreferences, *, limit: int = 200) -> list[CandidateBook]:
        self.calls += 1
        self.last_preferences = preferences
        return [b for b in self.books if preferences.max_budget is None or b.price <= preferences.max_budget]

class FakeModel:
    """Model palsu yang memisahkan respons ekstraksi dan penjelasan.

    Satu giliran bisa memanggil model dua kali (ekstraksi lalu penjelasan),
    jadi antrean dipisah menurut isi pesan sistem — bukan urutan panggilan.
    """

    def __init__(self, extractions: list[dict] | None = None, explanations: list[dict] | None = None) -> None:
        self.extractions = list(extractions or [])
        self.explanations = list(explanations or [])
        self.calls: list[list[dict[str, str]]] = []

    is_configured = True

    async def complete_json(self, messages):
        self.calls.append(messages)
        if "Kandidat dari katalog" in messages[-1]["content"]:
            if self.explanations:
                return self.explanations.pop(0)
            return {"assistant_message": "Ini pilihan terbaiknya.", "recommendations": [], "follow_up_question": None}
        if self.extractions:
            return self.extractions.pop(0)
        return {"assistant_message": "Boleh, lanjut.", "extracted_preferences": {}, "follow_up_question": None}

class FailingModel:
    """Model yang selalu gagal — memastikan fallback, bukan error ke pengguna."""

    is_configured = True

    async def complete_json(self, messages):
        raise gemini.AdvisorModelError("gagal")

def make_service(books: list[CandidateBook] | None = None, responses: list[dict] | None = None, model=None):
    """Service dengan katalog dan model palsu serta store baru."""
    catalog = FakeCatalog(books if books is not None else [book("Zero to One"), book("Rich Dad Poor Dad", "99000")])
    store = InMemoryAdvisorSessionStore()
    service = BookAdvisorService(
        catalog=catalog,
        store=store,
        model=model if model is not None else FakeModel(responses or []),
    )
    return service, catalog, store

# ---------------------------------------------------------------------------
# Preferensi
# ---------------------------------------------------------------------------

def test_merge_keeps_old_preferences_when_only_budget_changes():
    current = BookPreferences(interests=["bisnis"], reading_level="beginner", max_budget=Decimal(200000))
    delta = PreferenceDelta(max_budget=Decimal(100000))

    merged = merge_preferences(current, delta)

    assert merged.interests == ["bisnis"]
    assert merged.reading_level == "beginner"
    assert merged.max_budget == Decimal(100000)

def test_merge_unions_lists_without_duplicates():
    current = BookPreferences(interests=["Bisnis"])
    merged = merge_preferences(current, PreferenceDelta(interests=["bisnis", "startup"]))

    assert merged.interests == ["Bisnis", "startup"]

def test_merge_reset_interests_replaces_topic():
    current = BookPreferences(interests=["bisnis"])
    merged = merge_preferences(current, PreferenceDelta(interests=["filsafat"], reset_interests=True))

    assert merged.interests == ["filsafat"]

def test_merge_drops_min_budget_when_new_max_budget_is_lower():
    current = BookPreferences(min_budget=Decimal(200000), max_budget=Decimal(300000))

    merged = merge_preferences(current, PreferenceDelta(max_budget=Decimal(150000)))

    assert merged.max_budget == Decimal(150000)
    assert merged.min_budget is None

def test_missing_preferences_only_lists_actionable_fields():
    missing = missing_preferences(BookPreferences())

    assert missing[0] == "interests"
    assert "preferred_length" not in missing
    assert "preferred_language" not in missing

def test_is_ready_requires_topic_not_every_field():
    assert is_ready(BookPreferences(interests=["bisnis"])) is True
    assert is_ready(BookPreferences(max_budget=Decimal(100000))) is False

def test_user_changes_replace_lists():
    current = BookPreferences(interests=["bisnis", "startup"], reading_level="beginner")

    merged = merge_user_changes(current, {"interests": ["filsafat"]})

    assert merged.interests == ["filsafat"]
    assert merged.reading_level == "beginner"

# ---------------------------------------------------------------------------
# Ranking
# ---------------------------------------------------------------------------

def test_ranking_only_divides_weights_for_available_signals():
    preferences = BookPreferences(interests=["bisnis"], max_budget=Decimal(100000))
    top = rank_candidates(preferences, [book("Zero to One", "95000")])[0]

    # Topic (0.35) + budget (0.15) = 0.5 dari total bobot; keduanya 1.0.
    assert top.score == pytest.approx(1.0)
    assert set(top.signals) == {"topic", "budget"}
    assert "reading_level" not in top.signals

def test_ranking_prefers_topic_match_over_cheaper_unrelated_book():
    preferences = BookPreferences(interests=["bisnis"], max_budget=Decimal(200000))
    books = [book("Buku Murah Tanpa Topik", "20000", category="Komik & Manga"), book("Zero to One", "150000")]

    ranked = rank_candidates(preferences, books)

    assert ranked[0].book.title == "Zero to One"

def test_ranking_tie_break_uses_price_then_title():
    preferences = BookPreferences(interests=["bisnis"], max_budget=Decimal(200000))
    books = [book("Beta", "99000"), book("Alpha", "99000"), book("Gamma", "50000")]

    ranked = rank_candidates(preferences, books)

    assert [item.book.title for item in ranked] == ["Gamma", "Alpha", "Beta"]

def test_ranking_without_interests_does_not_score_topic():
    ranked = rank_candidates(BookPreferences(), [book("Apa Saja")])[0]

    assert "topic" not in ranked.signals
    assert ranked.score == pytest.approx(1.0)

def test_ranking_is_configurable_without_touching_service():
    preferences = BookPreferences(interests=["bisnis"], max_budget=Decimal(100000))
    weights = {**DEFAULT_WEIGHTS, "topic": 0.0, "budget": 1.0}

    ranked = rank_candidates(preferences, [book("Zero to One", "100000")], weights=weights)

    assert ranked[0].score == pytest.approx(1.0)

def test_budget_is_a_hard_filter_in_catalog_query():
    """Batas wajib diterapkan repository; service tidak boleh menawar."""
    service, catalog, _ = make_service([book("Mahal", "500000"), book("Murah", "50000")])
    service._catalog = catalog

    async def run():
        return await service._search_and_rank(BookPreferences(interests=["bisnis"], max_budget=Decimal(100000)))

    ranked = __import__("asyncio").run(run())
    assert [item.book.title for item in ranked] == ["Murah"]

# ---------------------------------------------------------------------------
# Validasi keluaran model
# ---------------------------------------------------------------------------

def test_recommendation_with_unknown_book_id_is_dropped():
    candidates = rank_candidates(BookPreferences(interests=["bisnis"]), [book("Zero to One")])
    raw = [{"book_id": str(uuid.uuid4()), "reason": "karangan"}, {"book_id": str(candidates[0].book.id), "reason": "Cocok"}]

    result = validate_recommendations(raw, candidates, BookPreferences())

    assert len(result) == 1
    assert result[0].book.id == candidates[0].book.id
    assert result[0].reason == "Cocok"

def test_score_never_comes_from_model():
    candidates = rank_candidates(BookPreferences(interests=["bisnis"]), [book("Zero to One")])
    raw = [{"book_id": str(candidates[0].book.id), "reason": "x", "score": 999}]

    result = validate_recommendations(raw, candidates, BookPreferences())

    assert result[0].score == candidates[0].score

def test_recommendation_without_reason_uses_backend_reason():
    preferences = BookPreferences(interests=["bisnis"], max_budget=Decimal(100000))
    candidates = rank_candidates(preferences, [book("Zero to One", "95000")])

    result = validate_recommendations([{"book_id": str(candidates[0].book.id)}], candidates, preferences)

    assert "bisnis" in result[0].reason

def test_prose_response_still_returns_ranked_candidates():
    candidates = rank_candidates(BookPreferences(interests=["bisnis"]), [book("Zero to One")])

    result = validate_recommendations(None, candidates, BookPreferences())

    assert len(result) == 1

def test_candidate_ids_only_contains_repository_ids():
    books = [book("A"), book("B")]

    assert candidate_ids(books) == {str(item.id) for item in books}

def test_heuristic_delta_reads_budget_and_topic_without_model():
    delta = heuristic_delta("Aku ingin belajar bisnis, budget 150rb", BookPreferences())

    assert delta.interests == ["bisnis"]
    assert delta.max_budget == Decimal(150000)

def test_heuristic_delta_does_not_guess_unknown_topics():
    delta = heuristic_delta("Rekomendasi dong", BookPreferences())

    assert delta.interests is None
    assert delta.max_budget is None

# ---------------------------------------------------------------------------
# Alur service
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_first_message_asks_follow_up_when_no_preference_extracted():
    model = FakeModel([{"assistant_message": "Halo!", "extracted_preferences": {}, "follow_up_question": "Topik apa?"}])
    service, catalog, _ = make_service(responses=[], model=model)

    response = await service.chat(USER_ID, AdvisorChatRequest(message="Halo"))

    assert response.conversation_state == "collecting_preferences"
    assert response.recommendations == []
    assert response.assistant_message == "Halo!\n\nTopik apa?"
    # Pertanyaan sudah menjadi paragraf terakhir balasan; tidak dikirim ulang.
    assert response.follow_up_question is None
    assert catalog.calls == 0


@pytest.mark.asyncio
async def test_repeated_follow_up_in_reply_is_not_duplicated():
    """Model yang menulis pertanyaan di balasan dan mengulangnya di field terpisah tidak dobel."""
    model = FakeModel(
        [
            {
                "assistant_message": "Wah menarik! Kamu lebih suka yang klasik atau modern?",
                "extracted_preferences": {},
                "follow_up_question": "Kamu lebih suka yang klasik atau modern?",
            }
        ]
    )
    service, _, _ = make_service(responses=[], model=model)

    response = await service.chat(USER_ID, AdvisorChatRequest(message="halo"))

    assert response.assistant_message.count("klasik atau modern") == 1
    assert response.follow_up_question is None

@pytest.mark.asyncio
async def test_recommendations_are_served_when_preferences_are_enough():
    model = FakeModel(
        [
            {
                "assistant_message": "Ini pilihannya.",
                "extracted_preferences": {"interests": ["bisnis"], "max_budget": 150000},
                "follow_up_question": None,
            }
        ]
    )
    service, catalog, _ = make_service(model=model)
    service._model = model

    response = await service.chat(USER_ID, AdvisorChatRequest(message="Belajar bisnis, budget 150rb"))

    assert response.conversation_state == "showing_recommendations"
    assert response.preferences.interests == ["bisnis"]
    assert catalog.calls == 1
    assert response.recommendations

@pytest.mark.asyncio
async def test_preferences_accumulate_across_messages_in_one_session():
    model = FakeModel(
        [
            {"assistant_message": "Topik bisnis, oke.", "extracted_preferences": {"interests": ["bisnis"]}, "follow_up_question": "Level?"},
            {"assistant_message": "Siap.", "extracted_preferences": {"reading_level": "beginner"}, "follow_up_question": None},
        ]
    )
    service, _, _ = make_service(model=model)

    first = await service.chat(USER_ID, AdvisorChatRequest(message="Belajar bisnis"))
    second = await service.chat(USER_ID, AdvisorChatRequest(message="Aku pemula", session_id=first.session_id))

    assert second.session_id == first.session_id
    assert second.preferences.interests == ["bisnis"]
    assert second.preferences.reading_level == "beginner"

@pytest.mark.asyncio
async def test_cheaper_request_keeps_other_preferences():
    model = FakeModel(
        [
            {
                "assistant_message": "Ini pilihannya.",
                "extracted_preferences": {"interests": ["bisnis"], "reading_level": "beginner", "max_budget": 200000},
                "follow_up_question": None,
            },
            {
                "assistant_message": "Ini yang lebih murah.",
                "extracted_preferences": {"max_budget": 100000},
                "follow_up_question": None,
            },
        ]
    )
    service, catalog, _ = make_service(model=model)

    first = await service.chat(USER_ID, AdvisorChatRequest(message="Bisnis pemula budget 200rb"))
    second = await service.chat(USER_ID, AdvisorChatRequest(message="Cari yang lebih murah", session_id=first.session_id))

    assert second.preferences.interests == ["bisnis"]
    assert second.preferences.reading_level == "beginner"
    assert second.preferences.max_budget == Decimal(100000)
    assert catalog.last_preferences.max_budget == Decimal(100000)

@pytest.mark.asyncio
async def test_model_failure_falls_back_to_ranked_candidates():
    service, _, _ = make_service(books=[book("Zero to One")], model=FailingModel())
    store = service._store
    session = store.create(USER_ID)
    session.preferences = BookPreferences(interests=["bisnis"])

    response = await service.chat(USER_ID, AdvisorChatRequest(message="Cari bisnis", session_id=session.id))

    assert response.recommendations
    assert response.recommendations[0].book.title == "Zero to One"
    assert response.assistant_message

@pytest.mark.asyncio
async def test_no_candidate_returns_honest_message():
    extraction = {
        "assistant_message": "Siap, aku carikan.",
        "extracted_preferences": {"interests": ["bisnis"]},
        "follow_up_question": None,
    }
    service, _, _ = make_service(books=[], model=FakeModel([extraction]))

    response = await service.chat(USER_ID, AdvisorChatRequest(message="Cari bisnis"))

    assert response.recommendations == []
    # Tanpa kandidat, model tidak dipanggil untuk menjelaskan; jawabannya jujur
    # dari backend, bukan teks model yang mungkin menyebut buku fiktif.
    assert "Belum ada buku" in response.assistant_message

@pytest.mark.asyncio
async def test_other_users_session_is_not_readable():
    service, _, store = make_service()
    session = store.create(OTHER_USER_ID)

    with pytest.raises(KeyError):
        service.get_session(USER_ID, session.id)

@pytest.mark.asyncio
async def test_feedback_not_relevant_excludes_book_next_time():
    service, _, store = make_service()
    session = store.create(USER_ID)
    book_id = uuid.uuid4()

    service.add_feedback(
        USER_ID,
        AdvisorFeedbackRequest(session_id=session.id, book_id=book_id, feedback="not_relevant"),
    )

    assert str(book_id) in session.preferences.disliked_books

@pytest.mark.asyncio
async def test_session_expires_after_ttl():
    clock = [0.0]
    store = InMemoryAdvisorSessionStore(ttl_seconds=10, clock=lambda: clock[0])
    session = store.create(USER_ID)
    clock[0] = 11

    assert store.get(session.id, USER_ID) is None

# ---------------------------------------------------------------------------
# Klien Gemini
# ---------------------------------------------------------------------------

def chat_response(content: str) -> httpx.Response:
    """Respons Gemini `generateContent` dengan teks di `candidates[0].content.parts`."""
    return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": content}]}}]})


@pytest.mark.asyncio
async def test_client_parses_json_and_strips_markdown_fence():
    requests: list[httpx.Request] = []
    client = gemini.GeminiClient(
        api_key="test-key",
        transport=httpx.MockTransport(
            lambda request: (requests.append(request), chat_response('```json\n{"ok": true}\n```'))[1]
        ),
    )

    result = await client.complete_json([{"role": "user", "content": "hai"}])

    assert result == {"ok": True}
    request = requests[0]
    assert request.url.path.endswith("/models/gemini-2.5-flash:generateContent")
    # Kunci tidak boleh ada di URL (bisa tercatat di log), hanya di header.
    assert "key=" not in str(request.url)
    assert request.headers["x-goog-api-key"] == "test-key"
    await client.aclose()


@pytest.mark.asyncio
async def test_client_maps_system_prompt_and_roles_to_gemini_shape():
    captured: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(json.loads(request.content))
        return chat_response('{"ok": true}')

    client = gemini.GeminiClient(api_key="test-key", transport=httpx.MockTransport(handler))

    await client.complete_json(
        [
            {"role": "system", "content": "aturan"},
            {"role": "user", "content": "halo"},
            {"role": "assistant", "content": "hai"},
            {"role": "user", "content": "ambilkan buku"},
        ]
    )

    payload = captured[0]
    assert payload["systemInstruction"]["parts"][0]["text"] == "aturan"
    assert [c["role"] for c in payload["contents"]] == ["user", "model", "user"]
    assert payload["generationConfig"]["responseMimeType"] == "application/json"
    await client.aclose()


@pytest.mark.asyncio
async def test_client_retries_server_error_once():
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if len(calls) == 1:
            return httpx.Response(503, json={"error": {"code": 503}})
        return chat_response('{"ok": true}')

    client = gemini.GeminiClient(api_key="test-key", transport=httpx.MockTransport(handler))

    assert await client.complete_json([{"role": "user", "content": "hai"}]) == {"ok": True}
    assert len(calls) == 2
    await client.aclose()


@pytest.mark.asyncio
async def test_client_rejects_non_json_content():
    client = gemini.GeminiClient(
        api_key="test-key",
        transport=httpx.MockTransport(lambda request: chat_response("bukan json")),
    )

    with pytest.raises(gemini.AdvisorModelError):
        await client.complete_json([])
    await client.aclose()

@pytest.mark.asyncio
async def test_client_does_not_retry_on_auth_error():
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(401, json={"error": "bad key"})

    client = gemini.GeminiClient(api_key="test-key", transport=httpx.MockTransport(handler))

    with pytest.raises(gemini.AdvisorModelError):
        await client.complete_json([])
    assert len(calls) == 1
    await client.aclose()

@pytest.mark.asyncio
async def test_client_without_key_is_not_configured():
    client = gemini.GeminiClient(api_key="")

    assert client.is_configured is False
    with pytest.raises(gemini.AdvisorModelError):
        await client.complete_json([])

# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def clean_overrides():
    yield
    app.dependency_overrides.clear()

class _FreeRewards:
    """Tagihan palsu: biaya 0, sehingga endpoint tidak menyentuh ledger asli.

    Aturan biaya diuji tersendiri di `test_advisor_billing.py`; di sini yang
    diuji alur percakapan.
    """

    def advisor_message_cost(self) -> int:
        return 0

    def get_balance(self, _user) -> int:
        return 0

    def charge_advisor_message(self, *_args, **_kwargs):  # pragma: no cover
        raise AssertionError("biaya 0 tidak boleh memotong poin")


@pytest.fixture
def fake_service(monkeypatch):
    """Ganti service di router dengan katalog + model palsu, store baru."""
    service, catalog, store = make_service(
        responses=[
            {
                "assistant_message": "Ini pilihannya.",
                "extracted_preferences": {"interests": ["bisnis"]},
                "follow_up_question": None,
            }
        ]
    )
    monkeypatch.setattr(advisor_api, "session_store", store)
    monkeypatch.setattr(advisor_api, "build_service", lambda *_args, **_kwargs: service)
    monkeypatch.setattr(advisor_api, "rewards_service", _FreeRewards())
    app.dependency_overrides[require_user] = lambda: UserPayload(id=USER_ID, role="user")
    return service, catalog, store

@pytest.mark.asyncio
async def test_chat_endpoint_requires_authentication(client):
    response = await client.post("/api/v1/book-advisor/chat", json={"message": "halo"})

    assert response.status_code == 401

@pytest.mark.asyncio
async def test_chat_endpoint_rejects_blank_message(fake_service, client):
    response = await client.post("/api/v1/book-advisor/chat", json={"message": "   "})

    assert response.status_code == 422

@pytest.mark.asyncio
async def test_chat_endpoint_returns_session_and_recommendations(fake_service, client):
    response = await client.post("/api/v1/book-advisor/chat", json={"message": "Belajar bisnis"})

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["session_id"]
    assert data["preferences"]["interests"] == ["bisnis"]
    assert data["recommendations"]

@pytest.mark.asyncio
async def test_session_history_is_owner_only(fake_service, client):
    _, _, store = fake_service
    other_session = store.create(OTHER_USER_ID)

    response = await client.get(f"/api/v1/book-advisor/sessions/{other_session.id}/messages")

    assert response.status_code == 404

@pytest.mark.asyncio
async def test_session_history_rejects_invalid_uuid(fake_service, client):
    response = await client.get("/api/v1/book-advisor/sessions/bukan-uuid/messages")

    assert response.status_code == 404

@pytest.mark.asyncio
async def test_preferences_patch_updates_only_own_session(fake_service, client):
    _, _, store = fake_service
    session = store.create(USER_ID)

    response = await client.patch(
        "/api/v1/book-advisor/preferences",
        json={"session_id": str(session.id), "interests": ["filsafat"], "max_budget": 120000},
    )

    assert response.status_code == 200
    assert response.json()["data"]["interests"] == ["filsafat"]

@pytest.mark.asyncio
async def test_feedback_endpoint_rejects_other_users_session(fake_service, client):
    _, _, store = fake_service
    other_session = store.create(OTHER_USER_ID)

    response = await client.post(
        "/api/v1/book-advisor/feedback",
        json={"session_id": str(other_session.id), "book_id": str(uuid.uuid4()), "feedback": "liked"},
    )

    assert response.status_code == 404

# ---------------------------------------------------------------------------
# Percakapan natural
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_model_reply_is_returned_verbatim_for_small_talk():
    """Sapaan dijawab seperti manusia; backend tidak menggantinya dengan template."""
    service, _, _ = make_service(
        responses=[{"assistant_message": "Hai! Lagi pengin baca yang ringan atau berat nih?", "conversation_intent": "chit_chat"}]
    )

    result = await service.chat(USER_ID, AdvisorChatRequest(message="halo kak"))

    assert result.assistant_message == "Hai! Lagi pengin baca yang ringan atau berat nih?"
    assert result.recommendations == []
    assert result.conversation_state == "collecting_preferences"

@pytest.mark.asyncio
async def test_small_talk_does_not_force_recommendations_when_preferences_are_ready():
    """Preferensi sudah lengkap pun, sapaan tidak boleh langsung menembak daftar buku."""
    service, catalog, _ = make_service(
        responses=[
            {"assistant_message": "Siap!", "conversation_intent": "ready_to_recommend", "extracted_preferences": {"interests": ["bisnis"]}},
            {"assistant_message": "Haha iya, aku di sini kalau butuh rekomendasi.", "conversation_intent": "chit_chat"},
        ]
    )
    first = await service.chat(USER_ID, AdvisorChatRequest(message="aku suka buku bisnis"))

    result = await service.chat(USER_ID, AdvisorChatRequest(session_id=first.session_id, message="makasih ya"))

    assert result.recommendations == []
    assert "Haha iya" in result.assistant_message
    assert catalog.calls == 1

@pytest.mark.asyncio
async def test_offline_mode_greets_naturally_instead_of_asking_question():
    service, _, _ = make_service(model=FakeModel(), responses=[])
    service._model.is_configured = False  # type: ignore[attr-defined]

    result = await service.chat(USER_ID, AdvisorChatRequest(message="halo, selamat malam"))

    assert "Halo juga" in result.assistant_message
    assert result.conversation_state == "collecting_preferences"

@pytest.mark.asyncio
async def test_offline_mode_acknowledges_captured_preferences():
    """Tanpa model, preferensi yang tertangkap tetap dikonfirmasi dengan kalimat, bukan formulir."""
    service, _, _ = make_service(model=FakeModel())
    service._model.is_configured = False  # type: ignore[attr-defined]
    session = service._store.create(USER_ID)  # type: ignore[attr-defined]

    result = await service.chat(
        USER_ID, AdvisorChatRequest(session_id=session.id, message="aku pemula, budget 150rb")
    )

    assert "150.000" in result.assistant_message
    assert "pemula" in result.assistant_message
