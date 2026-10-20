"""Pengujian Book Rewards — tanpa database, tanpa jaringan.

Ledger asli (RPC `apply_point_transaction`) tidak dipanggil. Sebagai gantinya
`FakeLedger` meniru semantik yang dijamin database:

- **idempotensi**: key yang sama mengembalikan baris lama, bukan baris baru;
- **saldo tidak boleh negatif** (`INSUFFICIENT_POINTS`);
- **cap harian per jenis transaksi** (`DAILY_CAP_REACHED`).

Yang diuji di sini adalah keputusan aplikasi yang tidak terlihat dari SQL:

1. Rumus poin pembelian dan akses spoiler.
2. Reward pembelian sekali per pesanan; reversal saat dibatalkan.
3. Reward ulasan sekali per (pengguna, buku), walau review id berbeda.
4. Cap harian kontribusi dijawab sebagai `DAILY_CAP_REACHED`, bukan crash.
5. Generasi AI: tagih dulu, refund saat gagal, tidak menagih ulang saat dibuka.
6. Aturan admin divalidasi terhadap katalog.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from app.core.security import UserPayload
from app.schemas.ai_review import AIReviewResponse, SpoilerLevel
from app.schemas.rewards import RewardRulesUpdate
from app.services.rewards import access
from app.services.rewards.errors import RewardsError
from app.services.rewards.rule_catalog import DEFAULT_VALUES
from app.services.rewards.service import RewardsService

USER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
BOOK = "11111111-1111-4111-8111-111111111111"
NOW = datetime(2026, 10, 19, 9, 0, tzinfo=UTC)


def _user(role: str = "user", user_id: str = USER) -> UserPayload:
    return UserPayload(id=user_id, email="u@example.test", role=role)


class FakeLedger:
    def __init__(self) -> None:
        self.rows: dict[str, dict[str, Any]] = {}
        # Selaras dengan `FakeRepo.profiles[USER]["points"]`: saldo tersimpan.
        self.balance = 500
        self.calls: list[dict[str, Any]] = []
        self.fail_with: Exception | None = None
        self.daily_counts: dict[str, int] = {}

    def apply(self, **kwargs: Any) -> dict[str, Any] | None:
        self.calls.append(kwargs)
        if self.fail_with is not None:
            raise self.fail_with
        key = kwargs["idempotency_key"]
        if key in self.rows:
            return self.rows[key]
        delta = int(kwargs["delta"])
        cap_type = kwargs.get("cap_type")
        cap = kwargs.get("daily_cap")
        if (
            cap is not None
            and delta > 0
            and cap_type
            and self.daily_counts.get(cap_type, 0) >= cap
        ):
            raise _PgError("DAILY_CAP_REACHED", "P0003")
        if self.balance + delta < 0:
            raise _PgError("INSUFFICIENT_POINTS", "P0004")
        self.balance += delta
        if cap is not None and delta > 0 and cap_type:
            self.daily_counts[cap_type] = self.daily_counts.get(cap_type, 0) + 1
        row = {
            "id": str(uuid4()),
            "user_id": str(kwargs["user_id"]),
            "points_delta": delta,
            "balance_after": self.balance,
            "transaction_type": kwargs["transaction_type"],
            "source_type": kwargs["source_type"],
            "source_id": kwargs["source_id"],
            "idempotency_key": key,
            "metadata": kwargs.get("metadata") or {},
            "created_at": NOW.isoformat(),
        }
        self.rows[key] = row
        return row


class _PgError(Exception):
    """Meniru `psycopg`/`postgrest` error dengan `sqlstate`."""

    def __init__(self, message: str, sqlstate: str) -> None:
        super().__init__(message)
        self.sqlstate = sqlstate


class FakeRepo:
    def __init__(self) -> None:
        self.rules: dict[str, int] = {}
        self.profiles: dict[str, dict[str, Any]] = {USER: {"id": USER, "points": 500}}
        self.orders: dict[str, dict[str, Any]] = {}
        self.units: dict[tuple[str, str | None], int] = {}
        self.reviews: dict[str, dict[str, Any]] = {}
        self.messages: dict[str, dict[str, Any]] = {}
        self.marks: dict[str, int] = {}
        self.activities: dict[tuple, dict[str, Any]] = {}
        self.generations: dict[str, dict[str, Any]] = {}
        self.transactions: list[dict[str, Any]] = []
        self.set_rules_calls: list[dict[str, int]] = []
        self.reconcile_rows: list[dict[str, Any]] = []

    # -- aturan ---------------------------------------------------------
    def load_rules(self) -> dict[str, int]:
        return dict(self.rules)

    def set_rules(self, values: dict[str, int], *, actor_id) -> None:
        self.set_rules_calls.append(dict(values))
        self.rules.update(values)

    # -- profil & ledger ------------------------------------------------
    def get_profile(self, user_id):
        return self.profiles.get(str(user_id))

    def list_transactions(self, user_id, *, page, limit):
        rows = [r for r in self.transactions if str(r["user_id"]) == str(user_id)]
        return rows, len(rows)

    def find_transaction(self, *, idempotency_key=None, user_id=None, transaction_type=None,
                         source_type=None, source_id=None):
        for row in self.transactions:
            if idempotency_key is not None and row["idempotency_key"] != idempotency_key:
                continue
            if user_id is not None and str(row["user_id"]) != str(user_id):
                continue
            if transaction_type is not None and row["transaction_type"] != transaction_type:
                continue
            if source_type is not None and row["source_type"] != source_type:
                continue
            if source_id is not None and row["source_id"] != str(source_id):
                continue
            return row
        return None

    def find_transaction_by_id(self, transaction_id):
        return next((r for r in self.transactions if r["id"] == str(transaction_id)), None)

    def reconcile(self):
        return list(self.reconcile_rows)

    def count_profiles(self) -> int:
        return len(self.profiles)

    # -- pembelian ------------------------------------------------------
    def get_order(self, order_id):
        return self.orders.get(str(order_id))

    def list_completed_orders(self):
        return [o for o in self.orders.values() if o["status"] == "completed"]

    def count_books_bought(self, user_id, *, book_id=None):
        return self.units.get((str(user_id), str(book_id) if book_id else None), 0)

    # -- ulasan ---------------------------------------------------------
    def get_review(self, review_id):
        return self.reviews.get(str(review_id))

    def list_reviews(self, *, status):
        return [r for r in self.reviews.values() if r["status"] == status]

    def mark_review_rewarded(self, review_id):
        review = self.reviews.get(str(review_id))
        if review is not None:
            review["status"] = "rewarded"

    # -- komunitas ------------------------------------------------------
    def get_message(self, message_id):
        return self.messages.get(str(message_id))

    def count_helpful_marks(self, message_id):
        return self.marks.get(str(message_id), 0)

    def list_approved_messages(self):
        return [m for m in self.messages.values() if m.get("moderation_status") == "approved"]

    # -- aktivitas ------------------------------------------------------
    def upsert_activity(self, *, user_id, activity_type, source_type, source_id, **fields):
        key = (str(user_id), activity_type, source_type, str(source_id))
        self.activities[key] = {"user_id": str(user_id), **fields}

    def get_activity(self, *, user_id, activity_type, source_type, source_id):
        return self.activities.get((str(user_id), activity_type, source_type, str(source_id)))

    def list_activities(self, *, status, page, limit):
        rows = list(self.activities.values())
        return rows, len(rows)

    # -- generasi AI ----------------------------------------------------
    def create_generation(self, **kwargs):
        key = kwargs["idempotency_key"]
        if any(g["idempotency_key"] == key for g in self.generations.values()):
            return None
        if any(
            g["status"] == "pending"
            and g["user_id"] == str(kwargs["user_id"])
            and g["book_id"] == str(kwargs["book_id"])
            and g["spoiler_level"] == kwargs["spoiler_level"]
            for g in self.generations.values()
        ):
            return None
        row = {
            "id": str(kwargs["generation_id"]),
            "user_id": str(kwargs["user_id"]),
            "book_id": str(kwargs["book_id"]),
            "spoiler_level": kwargs["spoiler_level"],
            "access_method": kwargs["access_method"],
            "points_spent": kwargs["points_spent"],
            "status": "pending",
            "idempotency_key": key,
            "redemption_tx_id": None,
            "refund_tx_id": None,
            "result": None,
            "provider": None,
            "created_at": NOW.isoformat(),
            "completed_at": None,
        }
        self.generations[row["id"]] = row
        return dict(row)

    def get_generation(self, *, user_id, idempotency_key):
        return next(
            (
                g
                for g in self.generations.values()
                if g["user_id"] == str(user_id) and g["idempotency_key"] == idempotency_key
            ),
            None,
        )

    def get_unlocked_generation(self, *, user_id, book_id, spoiler_level):
        return self.find_success_generation(
            user_id=user_id, book_id=book_id, spoiler_level=spoiler_level
        )

    def find_success_generation(self, *, user_id, book_id, spoiler_level):
        return next(
            (
                g
                for g in self.generations.values()
                if g["user_id"] == str(user_id)
                and g["book_id"] == str(book_id)
                and g["spoiler_level"] == spoiler_level
                and g["status"] == "success"
            ),
            None,
        )

    def get_generation_by_id(self, generation_id):
        return self.generations.get(str(generation_id))

    def list_generations(self, user_id, *, page, limit):
        rows = [g for g in self.generations.values() if g["user_id"] == str(user_id)]
        return rows, len(rows)

    def update_generation(self, generation_id, **changes):
        self.generations[str(generation_id)].update(changes)

    def list_stale_pending(self, *, older_than):
        return [g for g in self.generations.values() if g["status"] == "pending"]


@pytest.fixture
def ledger() -> FakeLedger:
    return FakeLedger()


@pytest.fixture
def repo() -> FakeRepo:
    return FakeRepo()


@pytest.fixture
def service(ledger: FakeLedger, repo: FakeRepo) -> RewardsService:
    svc = RewardsService(ledger=ledger, repository=repo)  # type: ignore[arg-type]
    original = svc._apply

    def apply_and_record(**kwargs):
        result = original(**kwargs)
        repo.transactions.append(dict(ledger.rows[kwargs["idempotency_key"]]))
        return result

    svc._apply = apply_and_record  # type: ignore[method-assign]
    return svc


# ---------------------------------------------------------------------------
# Rumus murni
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("total", "expected"),
    [
        ("9999", 0),
        ("10000", 10),
        ("198000", 190),
        ("20000.50", 20),
        (0, 0),
        (None, 0),
        (-50000, 0),
        ("bukan-angka", 0),
    ],
)
def test_purchase_points_floor_per_10000(total, expected):
    assert access.purchase_points(total, 10) == expected


def test_access_free_levels_need_nothing():
    for level in ("no_spoiler", "low"):
        decision = access.evaluate_access(level=level, units_bought=0, rules=DEFAULT_VALUES)
        assert decision.method == access.ACCESS_FREE
        assert decision.cost == 0


def test_medium_heavy_follow_purchase_units_and_rules():
    medium = access.evaluate_access(level="medium", units_bought=0, rules=DEFAULT_VALUES)
    assert (medium.method, medium.cost) == (access.ACCESS_POINTS, 100)
    heavy = access.evaluate_access(level="heavy", units_bought=1, rules=DEFAULT_VALUES)
    assert (heavy.method, heavy.cost) == (access.ACCESS_POINTS, 300)
    purchased = access.evaluate_access(level="heavy", units_bought=3, rules=DEFAULT_VALUES)
    assert (purchased.method, purchased.cost, purchased.granted) == (
        access.ACCESS_PURCHASE,
        0,
        True,
    )


# ---------------------------------------------------------------------------
# Pembelian
# ---------------------------------------------------------------------------


def test_completed_order_rewards_once(service, ledger, repo):
    repo.orders["o1"] = {"id": "o1", "user_id": USER, "status": "completed", "total": "55000"}

    first = service.reward_order("o1")
    second = service.reward_order("o1")

    assert first is not None and first.points_delta == 50
    assert second is not None and second.transaction_id == first.transaction_id
    assert ledger.balance == 550
    assert len(ledger.calls) == 2  # idempotensi terjadi di ledger, bukan di app


def test_order_not_completed_earns_nothing(service, ledger, repo):
    repo.orders["o1"] = {"id": "o1", "user_id": USER, "status": "paid", "total": "55000"}
    assert service.reward_order("o1") is None
    assert ledger.calls == []


def test_small_order_earns_nothing(service, ledger, repo):
    repo.orders["o1"] = {"id": "o1", "user_id": USER, "status": "completed", "total": "9000"}
    assert service.reward_order("o1") is None
    assert ledger.calls == []


def test_cancel_reverses_purchase_once(service, ledger, repo):
    repo.orders["o1"] = {"id": "o1", "user_id": USER, "status": "completed", "total": "55000"}
    service.reward_order("o1")

    first = service.reverse_order("o1")
    second = service.reverse_order("o1")

    assert first is not None and first.points_delta == -50
    assert second is not None and second.transaction_id == first.transaction_id
    assert ledger.balance == 500


def test_cancel_without_purchase_does_nothing(service, ledger):
    assert service.reverse_order("never-rewarded") is None
    assert ledger.calls == []


# ---------------------------------------------------------------------------
# Ulasan
# ---------------------------------------------------------------------------


def test_review_reward_once_per_user_book(service, ledger, repo):
    old_id, new_id = str(uuid4()), str(uuid4())
    repo.reviews[old_id] = {"id": old_id, "user_id": USER, "book_id": BOOK, "status": "approved"}
    repo.reviews[new_id] = {"id": new_id, "user_id": USER, "book_id": BOOK, "status": "approved"}

    service.reward_review(review_id=old_id)
    second = service.reward_review(review_id=new_id)

    assert ledger.balance == 500 + DEFAULT_VALUES["review_points"]
    assert second is not None
    assert second.points_delta == DEFAULT_VALUES["review_points"]
    # Key ledger memakai buku, bukan id ulasan → hanya satu baris ledger.
    assert len(ledger.rows) == 1
    assert repo.reviews[new_id]["status"] == "rewarded"


def test_review_reward_reads_review_when_ids_omitted(service, ledger, repo):
    review_id = str(uuid4())
    repo.reviews[review_id] = {
        "id": review_id, "user_id": USER, "book_id": BOOK, "status": "approved"
    }

    result = service.reward_review(review_id=review_id, reviewer=ADMIN)

    assert result is not None
    assert ledger.calls[0]["user_id"] == USER
    assert ledger.calls[0]["book_id"] == BOOK
    assert ledger.calls[0]["created_by"] == ADMIN


def test_review_reward_unknown_review_is_404(service):
    with pytest.raises(RewardsError) as exc:
        service.reward_review(review_id=str(uuid4()))
    assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# Komunitas
# ---------------------------------------------------------------------------


def test_contribution_capped_per_day(service, repo):
    repo.rules["community_contribution_daily_cap"] = 2
    ids = [str(uuid4()) for _ in range(2)]

    results = [service.reward_contribution(message_id=m, author_id=USER) for m in ids]
    assert all(result is not None for result in results)

    # Pesan ketiga hari itu: cap dijawab RPC, hook moderasi menangkapnya dan
    # hanya mencatat log — moderasi tetap berhasil tanpa poin.
    with pytest.raises(RewardsError) as exc:
        service.reward_contribution(message_id=str(uuid4()), author_id=USER)
    assert exc.value.code == "DAILY_CAP_REACHED"
    assert exc.value.status_code == 429


def test_helpful_answer_waits_for_enough_marks(service, ledger, repo):
    reply = str(uuid4())
    repo.messages[reply] = {
        "id": reply,
        "sender_id": USER,
        "parent_message_id": str(uuid4()),
        "deleted_at": None,
    }
    repo.marks[reply] = 1
    assert service.reward_helpful_answer(message_id=reply) is None

    repo.marks[reply] = 2
    result = service.reward_helpful_answer(message_id=reply)
    assert result is not None and result.points_delta == DEFAULT_VALUES["helpful_answer_points"]
    activity = repo.activities[(USER, "helpful_answer", "chat_message", reply)]
    assert activity["status"] == "rewarded"
    assert activity["points_awarded"] == DEFAULT_VALUES["helpful_answer_points"]


def test_contribution_records_rewarded_activity(service, repo):
    message = str(uuid4())
    service.reward_contribution(message_id=message, author_id=USER, reviewer=ADMIN)
    activity = repo.activities[(USER, "community_contribution", "chat_message", message)]
    assert activity["status"] == "rewarded"
    assert activity["points_awarded"] == DEFAULT_VALUES["community_contribution_points"]


def test_capped_contribution_writes_no_activity(service, repo):
    repo.rules["community_contribution_daily_cap"] = 1
    service.reward_contribution(message_id=str(uuid4()), author_id=USER)
    with pytest.raises(RewardsError):
        service.reward_contribution(message_id=str(uuid4()), author_id=USER)
    assert len(repo.activities) == 1


def test_helpful_answer_ignores_top_level_and_deleted(service, ledger, repo):
    top = str(uuid4())
    repo.messages[top] = {"id": top, "sender_id": USER, "parent_message_id": None,
                          "deleted_at": None}
    repo.marks[top] = 5
    assert service.reward_helpful_answer(message_id=top) is None

    gone = str(uuid4())
    repo.messages[gone] = {"id": gone, "sender_id": USER, "parent_message_id": str(uuid4()),
                           "deleted_at": NOW.isoformat()}
    repo.marks[gone] = 5
    assert service.reward_helpful_answer(message_id=gone) is None
    assert ledger.calls == []


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------


def test_rules_validation_rejects_unknown_and_huge_values():
    with pytest.raises(ValidationError):
        RewardRulesUpdate(values={"tidak_ada": 1})
    with pytest.raises(ValidationError):
        RewardRulesUpdate(values={"review_points": 10**9})
    with pytest.raises(ValidationError):
        RewardRulesUpdate(values={})


def test_update_rules_uses_rpc_once(service, repo):
    result = service.update_rules(
        _user("admin", ADMIN), {"review_points": 25, "helpful_answer_min_marks": 3}
    )
    assert repo.set_rules_calls == [{"review_points": 25, "helpful_answer_min_marks": 3}]
    values = {rule.key: rule.value for rule in result.rules}
    assert values["review_points"] == 25
    assert values["helpful_answer_min_marks"] == 3


def test_rules_fall_back_to_catalog_defaults(service, repo):
    assert service.rules() == DEFAULT_VALUES
    repo.rules["review_points"] = 30
    assert service.rules()["review_points"] == 30


def test_admin_adjustment_is_signed_and_idempotent_with_reference(service, ledger):
    admin = _user("admin", ADMIN)
    first = service.adjust_points(
        admin, user_id=UUID(USER), delta=-100, reason="koreksi duplikat", reference="adj-1"
    )
    second = service.adjust_points(
        admin, user_id=UUID(USER), delta=-100, reason="koreksi duplikat", reference="adj-1"
    )
    assert first.transaction_id == second.transaction_id
    assert ledger.balance == 400


def test_admin_adjustment_cannot_overdraw(service):
    with pytest.raises(RewardsError) as exc:
        service.adjust_points(
            _user("admin", ADMIN), user_id=UUID(USER), delta=-10_000, reason="uji saldo minus",
            reference=None,
        )
    assert exc.value.code == "INSUFFICIENT_POINTS"


def test_rpc_error_from_postgrest_maps_to_rewards_error():
    """PostgREST menaruh sqlstate di `.json`, bukan `sqlstate`/`pgcode`.

    Tanpa jalur itu, saldo kurang di jalur produksi (`SupabaseLedger`) keluar
    sebagai HTTP 500 alih-alih 400 `INSUFFICIENT_POINTS`.
    """
    from postgrest.exceptions import APIError

    from app.services.rewards.errors import from_rpc_error

    exc = APIError(
        {"message": "INSUFFICIENT_POINTS", "code": "P0004", "hint": None, "details": None}
    )
    mapped = from_rpc_error(exc)
    assert mapped is not None
    assert mapped.status_code == 400
    assert mapped.code == "INSUFFICIENT_POINTS"

    unknown = APIError({"message": "duplicate key", "code": "23505", "hint": None})
    assert from_rpc_error(unknown) is None


# ---------------------------------------------------------------------------
# Generasi AI
# ---------------------------------------------------------------------------


def _review(book_id: str) -> AIReviewResponse:
    return AIReviewResponse(
        book_id=book_id,
        title="Judul",
        author="Penulis",
        spoiler_level=SpoilerLevel.HEAVY,
        overview="o",
        writing_style="w",
        characters="c",
        strengths=["a"],
        weaknesses=["b"],
        who_should_read="semua",
        verdict="v",
    )


def test_paid_generation_charges_then_refunds_on_failure(service, ledger):
    def broken(**_kwargs):
        raise RuntimeError("model down")

    generation, reused = service.generate_ai_review(
        _user(),
        book_id=UUID(BOOK),
        spoiler_level=SpoilerLevel.HEAVY,
        book={"id": BOOK},
        generator=broken,
    )

    assert reused is False
    assert generation.status == "failed"
    assert generation.points_spent == DEFAULT_VALUES["spoiler_heavy_points"]
    # Tagih 300 lalu refund 300 → saldo kembali.
    assert [c["transaction_type"] for c in ledger.calls] == ["ai_redemption", "refund"]
    assert ledger.balance == 500


def test_paid_generation_success_and_reopen_is_free(service, ledger, repo):
    generation, _ = service.generate_ai_review(
        _user(),
        book_id=UUID(BOOK),
        spoiler_level=SpoilerLevel.MEDIUM,
        book={"id": BOOK},
        generator=lambda **_: _review(BOOK),
    )
    assert generation.status == "success"
    assert ledger.balance == 500 - DEFAULT_VALUES["spoiler_medium_points"]  # 400

    calls_before = len(ledger.calls)
    again, reused = service.generate_ai_review(
        _user(),
        book_id=UUID(BOOK),
        spoiler_level=SpoilerLevel.MEDIUM,
        book={"id": BOOK},
        generator=lambda **_: pytest.fail("tidak boleh memanggil model lagi"),
    )
    assert reused is True
    assert again.id == generation.id
    assert len(ledger.calls) == calls_before


def test_purchase_eligibility_does_not_charge(service, ledger, repo):
    repo.units[(USER, BOOK)] = 3
    generation, _ = service.generate_ai_review(
        _user(),
        book_id=UUID(BOOK),
        spoiler_level=SpoilerLevel.HEAVY,
        book={"id": BOOK},
        generator=lambda **_: _review(BOOK),
    )
    assert generation.access_method == access.ACCESS_PURCHASE
    assert generation.points_spent == 0
    assert ledger.calls == []


def test_insufficient_points_leaves_no_charge(service, ledger, repo):
    ledger.balance = 10
    with pytest.raises(RewardsError) as exc:
        service.generate_ai_review(
            _user(),
            book_id=UUID(BOOK),
            spoiler_level=SpoilerLevel.HEAVY,
            book={"id": BOOK},
            generator=lambda **_: _review(BOOK),
        )
    assert exc.value.code == "INSUFFICIENT_POINTS"
    failed = [g for g in repo.generations.values() if g["status"] == "failed"]
    assert len(failed) == 1
    assert ledger.balance == 10


def test_idempotency_key_reuses_generation(service, ledger):
    first, _ = service.generate_ai_review(
        _user(),
        book_id=UUID(BOOK),
        spoiler_level=SpoilerLevel.MEDIUM,
        book={"id": BOOK},
        generator=lambda **_: _review(BOOK),
        idempotency_key="client-key-1234",
    )
    calls = len(ledger.calls)
    second, reused = service.generate_ai_review(
        _user(),
        book_id=UUID(BOOK),
        spoiler_level=SpoilerLevel.MEDIUM,
        book={"id": BOOK},
        generator=lambda **_: _review(BOOK),
        idempotency_key="client-key-1234",
    )
    assert reused is True
    assert second.id == first.id
    assert len(ledger.calls) == calls


def test_stale_pending_is_refunded(service, ledger, repo):
    generation, _ = service.generate_ai_review(
        _user(),
        book_id=UUID(BOOK),
        spoiler_level=SpoilerLevel.MEDIUM,
        book={"id": BOOK},
        generator=lambda **_: (_ for _ in ()).throw(RuntimeError("proses mati")),
        idempotency_key="crash-1",
    )
    # Simulasikan proses yang mati setelah tagihan tersimpan.
    row = repo.generations[str(generation.id)]
    row["status"] = "pending"
    row["redemption_tx_id"] = None

    recovered = service.recover_stale_generations()

    assert recovered == 1
    assert repo.generations[str(generation.id)]["status"] == "failed"
    assert ledger.balance == 500


def test_other_users_generation_is_hidden(service):
    generation, _ = service.generate_ai_review(
        _user(),
        book_id=UUID(BOOK),
        spoiler_level=SpoilerLevel.LOW,
        book={"id": BOOK},
        generator=lambda **_: _review(BOOK),
    )
    other = _user(user_id=str(uuid4()))
    with pytest.raises(RewardsError) as exc:
        service.get_generation(other, generation.id)
    assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# Ringkasan
# ---------------------------------------------------------------------------


def test_me_reports_balance_and_access(service, repo):
    repo.units[(USER, None)] = 2
    me = service.get_me(_user(), book_id=UUID(BOOK))
    assert me.points == 500
    assert me.total_books_bought == 2
    assert me.spoiler_access["no_spoiler"].unlocked is True
    assert me.spoiler_access["medium"].method == access.ACCESS_POINTS
    assert me.spoiler_access["heavy"].cost == DEFAULT_VALUES["spoiler_heavy_points"]
