"""Pengujian tagihan poin AI Book Advisor — tanpa database, tanpa Gemini.

Ledger asli (RPC `apply_point_transaction`) dan provider AI diganti fake yang
meniru jaminan database:

- **idempotensi**: key yang sama mengembalikan baris lama, bukan baris baru;
- **saldo tidak boleh negatif** (`INSUFFICIENT_POINTS`, HTTP 400);
- ledger dilindungi lock agar request bersamaan tidak saling menimpa.

Skenario yang diuji sesuai kebijakan:

1. Saldo cukup → pesan diproses dan poin dipotong sekali.
2. Saldo tidak cukup → provider tidak dipanggil, saldo tidak berubah.
3. Pesan kosong/tidak valid → ledger tidak disentuh.
4. Provider AI gagal → poin dikembalikan dan balasan ditandai bukan dari AI.
5. Provider tidak dikonfigurasi → tidak pernah ditagih.
6. Request bersamaan → saldo tidak negatif, tidak ada potongan ganda.
7. Retry dengan `message_id` yang sama → transaksi tetap idempoten.
8. Tanpa autentikasi / peran admin → ditolak sebelum ledger disentuh.
"""

from __future__ import annotations

import threading
import uuid
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.api.v1 import book_advisor as advisor_api
from app.core.security import UserPayload, require_user
from app.main import app
from app.schemas.book_advisor import AdvisorChatRequest
from app.services.advisor import gemini
from app.services.advisor.service import BookAdvisorService
from app.services.advisor.session import InMemoryAdvisorSessionStore
from app.services.rewards.errors import RewardsError
from app.services.rewards.service import RewardsService

USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
OTHER_USER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
DEFAULT_COST = 10


# ---------------------------------------------------------------------------
# Fake ledger & repository
# ---------------------------------------------------------------------------
class FakeLedger:
    """Meniru `apply_point_transaction`: atomik, idempoten, saldo ≥ 0."""

    def __init__(self, balance: int = 500) -> None:
        self.balance = balance
        self.balances: dict[str, int] = {USER_ID: balance}
        self.rows: dict[str, dict[str, Any]] = {}
        self.calls: list[dict[str, Any]] = []
        self._lock = threading.Lock()

    def apply(self, **kwargs: Any) -> dict[str, Any]:
        # Lock meniru baris `profiles` yang di-FOR UPDATE oleh RPC.
        with self._lock:
            self.calls.append(kwargs)
            key = kwargs["idempotency_key"]
            if key in self.rows:
                return self.rows[key]
            user_id = str(kwargs["user_id"])
            balance = self.balances.get(user_id, 0)
            delta = int(kwargs["delta"])
            if balance + delta < 0:
                raise _insufficient(balance, -delta)
            new_balance = balance + delta
            self.balances[user_id] = new_balance
            row = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "points_delta": delta,
                "balance_after": new_balance,
                "transaction_type": kwargs["transaction_type"],
                "source_type": kwargs["source_type"],
                "source_id": kwargs["source_id"],
                "idempotency_key": key,
            }
            self.rows[key] = row
            return row

    def balance_of(self, user_id: str = USER_ID) -> int:
        return self.balances.get(user_id, 0)

    def rows_of_type(self, transaction_type: str) -> list[dict[str, Any]]:
        return [
            row
            for row in self.rows.values()
            if row["transaction_type"] == transaction_type
        ]


class _InsufficientError(Exception):
    """Error PostgREST dengan `sqlstate` P0004 seperti RPC asli."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.sqlstate = "P0004"


def _insufficient(balance: int, needed: int) -> _InsufficientError:
    return _InsufficientError(f"INSUFFICIENT_POINTS saldo {balance} butuh {needed}")


class FakeRepo:
    def __init__(self, ledger: FakeLedger) -> None:
        self._ledger = ledger
        self.rules: dict[str, int] = {}

    def load_rules(self) -> dict[str, int]:
        return dict(self.rules)

    def get_profile(self, user_id):
        if str(user_id) not in self._ledger.balances:
            return None
        return {"id": str(user_id), "points": self._ledger.balance_of(str(user_id))}

    def find_transaction(self, **kwargs):
        key = kwargs.get("idempotency_key")
        return self._ledger.rows.get(key) if key else None


class _BalanceReportingRewards(RewardsService):
    """`RewardsService` dengan saldo dibaca dari fake ledger, bukan Supabase.

    Produksi membaca `profiles.points`; fake ledger adalah sumber itu.
    """

    def __init__(self, ledger: FakeLedger) -> None:
        super().__init__(ledger=ledger, repository=FakeRepo(ledger))


# ---------------------------------------------------------------------------
# Fake model & katalog
# ---------------------------------------------------------------------------
class _ConfiguredModel:
    """Provider AI yang selalu menjawab dengan JSON ekstraksi yang sah."""

    is_configured = True
    calls = 0

    async def complete_json(self, messages: list[dict[str, str]]) -> dict[str, Any]:
        type(self).calls += 1
        return {
            "assistant_message": "Siap, aku bantu carikan bukunya.",
            "follow_up_question": "Buku tentang apa yang kamu minati?",
            "conversation_intent": "preference_update",
            "extracted_preferences": {"interests": ["bisnis"]},
        }


class _FailingModel:
    """Provider dikonfigurasi tetapi selalu gagal (timeout/5xx)."""

    is_configured = True
    calls = 0

    async def complete_json(self, messages: list[dict[str, str]]) -> dict[str, Any]:
        type(self).calls += 1
        raise gemini.AdvisorModelError("provider down")


class _NoCatalog:
    async def search(self, *_args, **_kwargs):
        return []


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def ledger() -> FakeLedger:
    return FakeLedger()


@pytest.fixture
def rewards(ledger: FakeLedger) -> _BalanceReportingRewards:
    return _BalanceReportingRewards(ledger)


@pytest.fixture
def billing(rewards, monkeypatch) -> None:
    """Service advisor palsu + aturan biaya tersuntik ke router.

    Provider default = model yang berhasil; tes yang butuh kegagalan
    menukar `advisor_api.build_service` sebelum request.
    """
    _ConfiguredModel.calls = 0
    _FailingModel.calls = 0

    def _build(_catalog, store):
        return BookAdvisorService(
            catalog=_NoCatalog(), store=store, model=_ConfiguredModel()
        )

    monkeypatch.setattr(advisor_api, "build_service", _build)
    monkeypatch.setattr(advisor_api, "session_store", InMemoryAdvisorSessionStore())
    monkeypatch.setattr(advisor_api, "rewards_service", rewards)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)


@pytest.fixture(autouse=True)
def _clear_overrides():
    yield
    app.dependency_overrides.clear()


def _identify(user_id: str = USER_ID) -> None:
    app.dependency_overrides[require_user] = lambda: UserPayload(
        id=user_id, email="u@example.test", role="user"
    )


async def _post(payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as http:
        response = await http.post("/api/v1/book-advisor/chat", json=payload)
    return response.status_code, response.json()


async def _get(path: str) -> tuple[int, dict[str, Any]]:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as http:
        response = await http.get(path)
    return response.status_code, response.json()


def _new_message() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# 1. Saldo cukup
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sufficient_balance_charges_rule_cost_once(billing, ledger):
    _identify()
    message_id = _new_message()

    status_code, body = await _post({"message": "carikan buku bisnis", "message_id": message_id})

    assert status_code == 200, body
    data = body["data"]
    assert data["outcome"] == "answered"
    assert data["model_source"] == "model"
    assert data["points_cost"] == DEFAULT_COST
    assert data["points_charged"] == DEFAULT_COST
    assert data["points_refunded"] == 0
    assert data["points_balance"] == 500 - DEFAULT_COST
    assert ledger.balance_of() == 500 - DEFAULT_COST
    charges = ledger.rows_of_type("ai_chat_charge")
    assert len(charges) == 1
    assert charges[0]["source_type"] == "ai_chat"
    assert charges[0]["source_id"] == message_id
    assert charges[0]["idempotency_key"] == f"advisor:{message_id}:charge"
    refunds = ledger.rows_of_type("refund")
    assert refunds == []


@pytest.mark.asyncio
async def test_cost_follows_reward_rule_not_a_hardcoded_number(billing, ledger, rewards):
    rewards._repo.rules["advisor_message_points"] = 25  # type: ignore[attr-defined]
    _identify()

    status_code, body = await _post({"message": "carikan buku bisnis"})

    assert status_code == 200
    assert body["data"]["points_cost"] == 25
    assert ledger.balance_of() == 500 - 25


@pytest.mark.asyncio
async def test_zero_rule_cost_never_touches_ledger(billing, ledger, rewards):
    rewards._repo.rules["advisor_message_points"] = 0  # type: ignore[attr-defined]
    _identify()

    status_code, body = await _post({"message": "carikan buku bisnis"})

    assert status_code == 200
    assert body["data"]["points_cost"] == 0
    assert body["data"]["points_charged"] == 0
    assert ledger.calls == []


# ---------------------------------------------------------------------------
# 2. Saldo tidak cukup
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_insufficient_balance_blocks_message_without_calling_ai(billing, ledger):
    ledger.balances[USER_ID] = DEFAULT_COST - 1
    _identify()

    status_code, body = await _post({"message": "carikan buku bisnis"})

    assert status_code == 400
    assert body["detail"].startswith("INSUFFICIENT_POINTS")
    assert _ConfiguredModel.calls == 0
    assert ledger.balance_of() == DEFAULT_COST - 1
    assert ledger.rows_of_type("ai_chat_charge") == []


@pytest.mark.asyncio
async def test_balance_is_never_pushed_negative(billing, ledger):
    ledger.balances[USER_ID] = DEFAULT_COST - 1
    _identify()

    await _post({"message": "halo"})

    assert ledger.balance_of() >= 0


# ---------------------------------------------------------------------------
# 3. Input tidak valid
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("payload", [{"message": "   "}, {"message": ""}, {}])
@pytest.mark.asyncio
async def test_invalid_input_does_not_touch_ledger(billing, ledger, payload):
    _identify()

    status_code, _ = await _post(payload)

    assert status_code == 422
    assert ledger.calls == []
    assert _ConfiguredModel.calls == 0


def test_blank_message_rejected_by_schema_before_router():
    with pytest.raises(ValidationError):
        AdvisorChatRequest(message="   ")


# ---------------------------------------------------------------------------
# 4. Provider gagal → refund + tanda balasan bukan AI
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_provider_failure_refunds_points_and_flags_reply(billing, ledger, monkeypatch):
    monkeypatch.setattr(
        advisor_api,
        "build_service",
        lambda _catalog, store: BookAdvisorService(
            catalog=_NoCatalog(), store=store, model=_FailingModel()
        ),
    )
    _identify()
    message_id = _new_message()

    status_code, body = await _post({"message": "carikan buku bisnis", "message_id": message_id})

    assert status_code == 200, body
    data = body["data"]
    assert data["outcome"] == "provider_failed"
    assert data["model_source"] == "rule_based"
    assert "layanan AI sedang gangguan" in data["assistant_message"]
    assert data["points_charged"] == 0
    assert data["points_refunded"] == DEFAULT_COST
    assert data["points_balance"] == 500
    assert ledger.balance_of() == 500
    refunds = ledger.rows_of_type("refund")
    assert len(refunds) == 1
    assert refunds[0]["source_id"] == message_id
    assert refunds[0]["points_delta"] == DEFAULT_COST


@pytest.mark.asyncio
async def test_refund_is_idempotent_across_retries(billing, ledger, monkeypatch):
    monkeypatch.setattr(
        advisor_api,
        "build_service",
        lambda _catalog, store: BookAdvisorService(
            catalog=_NoCatalog(), store=store, model=_FailingModel()
        ),
    )
    _identify()
    message_id = _new_message()

    await _post({"message": "carikan buku bisnis", "message_id": message_id})
    await _post({"message": "carikan buku bisnis", "message_id": message_id})

    assert len(ledger.rows_of_type("refund")) == 1
    assert ledger.balance_of() == 500


# ---------------------------------------------------------------------------
# 5. AI tidak dikonfigurasi → tidak ditagih
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_unconfigured_ai_is_never_charged(billing, ledger, monkeypatch):
    class _OfflineModel:
        is_configured = False

        async def complete_json(self, messages):  # pragma: no cover - tak dipanggil
            raise AssertionError("model tidak boleh dipanggil saat offline")

    monkeypatch.setattr(
        advisor_api,
        "build_service",
        lambda _catalog, store: BookAdvisorService(
            catalog=_NoCatalog(), store=store, model=_OfflineModel()
        ),
    )
    _identify()

    status_code, body = await _post({"message": "halo"})

    assert status_code == 200
    assert body["data"]["outcome"] == "unconfigured"
    assert body["data"]["points_charged"] == 0
    assert ledger.calls == []


# ---------------------------------------------------------------------------
# 6. Request bersamaan
# ---------------------------------------------------------------------------
def test_concurrent_charges_never_go_negative_or_double_charge(ledger):
    service = _BalanceReportingRewards(ledger)
    # Saldo cukup untuk tepat tiga pesan.
    ledger.balances[USER_ID] = DEFAULT_COST * 3
    user = UserPayload(id=USER_ID, email="u@example.test", role="user")
    ids = [_new_message() for _ in range(10)]
    outcomes: list[str] = []
    errors: list[str] = []

    def _run(message_id: str) -> None:
        try:
            service.charge_advisor_message(user, message_id=message_id, cost=DEFAULT_COST)
            outcomes.append("charged")
        except RewardsError as exc:
            errors.append(exc.code)

    threads = [threading.Thread(target=_run, args=(mid,)) for mid in ids]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert ledger.balance_of() == 0
    assert len(outcomes) == 3
    assert errors == ["INSUFFICIENT_POINTS"] * 7
    assert len(ledger.rows_of_type("ai_chat_charge")) == 3
    assert len({row["source_id"] for row in ledger.rows_of_type("ai_chat_charge")}) == 3


def test_same_message_charged_once_even_if_concurrent(ledger):
    service = _BalanceReportingRewards(ledger)
    user = UserPayload(id=USER_ID, email="u@example.test", role="user")
    message_id = _new_message()

    threads = [
        threading.Thread(
            target=service.charge_advisor_message,
            kwargs={"user": user, "message_id": message_id, "cost": DEFAULT_COST},
        )
        for _ in range(5)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert ledger.balance_of() == 500 - DEFAULT_COST
    assert len(ledger.rows_of_type("ai_chat_charge")) == 1


# ---------------------------------------------------------------------------
# 7. Retry / kirim ulang dengan message_id sama
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_retry_with_same_message_id_is_idempotent(billing, ledger):
    _identify()
    message_id = _new_message()
    payload = {"message": "carikan buku bisnis", "message_id": message_id}

    first_status, first = await _post(payload)
    second_status, second = await _post(payload)

    assert first_status == second_status == 200
    assert first["data"]["session_id"] is not None
    assert ledger.balance_of() == 500 - DEFAULT_COST
    assert len(ledger.rows_of_type("ai_chat_charge")) == 1
    assert second["data"]["points_cost"] == DEFAULT_COST
    assert second["data"]["points_balance"] == 500 - DEFAULT_COST


@pytest.mark.asyncio
async def test_different_messages_are_charged_separately(billing, ledger):
    _identify()

    await _post({"message": "carikan buku bisnis", "message_id": _new_message()})
    await _post({"message": "yang lebih murah", "message_id": _new_message()})

    assert ledger.balance_of() == 500 - DEFAULT_COST * 2
    assert len(ledger.rows_of_type("ai_chat_charge")) == 2


@pytest.mark.asyncio
async def test_omitted_message_id_still_creates_one_charge(billing, ledger):
    _identify()

    status_code, body = await _post({"message": "carikan buku bisnis"})

    assert status_code == 200
    assert body["data"]["message_id"]
    assert len(ledger.rows_of_type("ai_chat_charge")) == 1


# ---------------------------------------------------------------------------
# 8. Autentikasi & otorisasi
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_unauthenticated_request_rejected_without_charge(billing, ledger):
    status_code, _ = await _post({"message": "carikan buku bisnis"})

    assert status_code == 401
    assert ledger.calls == []


@pytest.mark.asyncio
async def test_admin_role_rejected_without_charge(billing, ledger):
    # `require_user` asli tetap dipakai (tidak di-override) agar aturan peran
    # diuji sungguhan; token admin disuntik di `get_current_user`.
    from app.core.security import get_current_user

    app.dependency_overrides[get_current_user] = lambda: UserPayload(
        id=OTHER_USER_ID, email="admin@example.test", role="admin"
    )

    status_code, _ = await _post({"message": "carikan buku bisnis"})

    assert status_code == 403
    assert ledger.calls == []
    assert _ConfiguredModel.calls == 0


@pytest.mark.asyncio
async def test_pricing_endpoint_reports_rule_cost_and_balance(billing):
    _identify()

    status_code, body = await _get("/api/v1/book-advisor/pricing")

    assert status_code == 200
    assert body["data"] == {"points_cost": DEFAULT_COST, "points_balance": 500}


@pytest.mark.asyncio
async def test_pricing_endpoint_requires_auth(billing):
    status_code, _ = await _get("/api/v1/book-advisor/pricing")

    assert status_code == 401
