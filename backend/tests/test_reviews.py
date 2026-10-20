"""Pengujian ulasan buku — tanpa database, tanpa jaringan.

`OrmReviewRepository` diganti repository palsu di `get_review_service`,
sehingga aturan yang paling mudah rusak diam-diam diuji langsung:

1. **Identitas** — penulis dari token; `user_id` di body diabaikan.
2. **Satu ulasan per pengguna per buku** (409), termasuk balapan insert.
3. **Tampil hanya setelah disetujui**; ringkasan rating hanya menghitung
   ulasan tayang.
4. **Edit tidak membuka reward baru** — ulasan `rewarded` ditolak; ulasan
   `rejected` kembali `pending`.
5. **Keputusan moderasi final** — ulasan yang sudah disetujui bukan
   `rewarded` tidak bisa ditolak/diubah lagi.
6. **Hook reward** dipanggil di transaksi yang sama, sebelum `commit`.
7. **Batas anti-spam**: teks berulang dan terlalu banyak ulasan per hari.
"""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.api.v1.reviews import get_review_service
from app.core.security import UserPayload, get_current_user
from app.main import app
from app.models.review import Review
from app.services.review_repository import ReviewRow
from app.services.review_service import MAX_REVIEWS_PER_DAY, ReviewService

NOW = datetime(2026, 10, 19, 9, 0, tzinfo=UTC)

ADMIN = UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
ALICE = UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
BOB = UUID("cccccccc-cccc-4ccc-8ccc-cccccccccccc")

BOOK_A = UUID("11111111-1111-4111-8111-111111111111")
BOOK_B = UUID("22222222-2222-4222-8222-222222222222")
MISSING_BOOK = UUID("99999999-9999-4999-8999-999999999999")

GOOD_BODY = "Buku ini menarik dari awal sampai akhir dan layak dibaca ulang."

PROFILES = {
    ALICE: SimpleNamespace(
        id=ALICE, username="alice", full_name="Alice", avatar_url=None
    ),
    BOB: SimpleNamespace(id=BOB, username="bob", full_name="Bob", avatar_url="b.png"),
}


class FakeReviewRepository:
    """Menyimpan objek `Review` seperti ORM, lengkap dengan timestamp."""

    def __init__(self) -> None:
        self.reviews: dict[UUID, Review] = {}
        self.commits = 0

    # -- helper -------------------------------------------------------
    @staticmethod
    def _row(review: Review, *, with_author: bool = True) -> ReviewRow:
        author = PROFILES.get(review.user_id) if with_author else None
        return ReviewRow(review=review, author=author)

    def _make(self, user_id: UUID, book_id: UUID, **fields) -> Review:
        review = Review(user_id=user_id, book_id=book_id, **fields)
        review.id = uuid4()
        review.moderated_by = None
        review.moderated_at = None
        review.rejection_reason = None
        review.rewarded_at = None
        review.created_at = NOW
        review.updated_at = NOW
        self.reviews[review.id] = review
        return review

    def seed(self, user_id: UUID, book_id: UUID, **fields) -> Review:
        values = {"rating": 5, "title": None, "body": GOOD_BODY, "status": "pending"}
        values.update(fields)
        return self._make(user_id, book_id, **values)

    # -- ORM permukaan yang dipakai service ---------------------------
    async def commit(self) -> None:
        self.commits += 1

    async def rollback(self) -> None:
        pass

    async def book_exists(self, book_id: UUID) -> bool:
        return book_id in (BOOK_A, BOOK_B)

    async def get(self, review_id: UUID) -> Review | None:
        return self.reviews.get(review_id)

    async def get_for_update(self, review_id: UUID) -> Review | None:
        return self.reviews.get(review_id)

    async def get_for_user_book(self, user_id: UUID, book_id: UUID) -> Review | None:
        return next(
            (
                review
                for review in self.reviews.values()
                if review.user_id == user_id and review.book_id == book_id
            ),
            None,
        )

    async def create(self, *, user_id, book_id, rating, title, body):
        if await self.get_for_user_book(user_id, book_id) is not None:
            return None
        return self._make(user_id, book_id, rating=rating, title=title, body=body, status="pending")

    async def update_fields(self, review_id: UUID, changes) -> None:
        review = self.reviews[review_id]
        for field, value in changes.items():
            setattr(review, field, value)

    async def decide(self, review_id: UUID, *, status, moderator_id, reason) -> None:
        review = self.reviews[review_id]
        review.status = status
        review.moderated_by = moderator_id
        review.moderated_at = NOW
        review.rejection_reason = reason if status == "rejected" else None

    async def mark_rewarded(self, review_id: UUID) -> None:
        review = self.reviews[review_id]
        review.status = "rewarded"
        review.rewarded_at = NOW

    async def list_visible(self, book_id: UUID, *, page: int, limit: int):
        visible = [
            self._row(review)
            for review in self.reviews.values()
            if review.book_id == book_id and review.status in ("approved", "rewarded")
        ]
        average = (
            sum(row.review.rating for row in visible) / len(visible) if visible else None
        )
        start = (page - 1) * limit
        return visible[start : start + limit], len(visible), average

    async def list_mine(self, user_id: UUID):
        return [review for review in self.reviews.values() if review.user_id == user_id]

    async def list_for_moderation(self, *, status, page, limit):
        rows = [
            self._row(review)
            for review in self.reviews.values()
            if status is None or review.status == status
        ]
        start = (page - 1) * limit
        return rows[start : start + limit], len(rows)

    async def count_recent_by_user(self, user_id: UUID, *, since: datetime) -> int:
        return sum(1 for review in self.reviews.values() if review.user_id == user_id)


@pytest.fixture
def repo() -> FakeReviewRepository:
    return FakeReviewRepository()


@pytest_asyncio.fixture
async def client() -> AsyncClient:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http:
        yield http


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()


def _install(repo: FakeReviewRepository, service: ReviewService | None = None) -> ReviewService:
    service = service or ReviewService(repo)  # type: ignore[arg-type]
    app.dependency_overrides[get_review_service] = lambda: service
    return service


def _login(user_id: UUID, *, role: str = "user") -> None:
    app.dependency_overrides[get_current_user] = lambda: UserPayload(
        id=str(user_id), email=f"{user_id}@example.test", role=role
    )


# ---------------------------------------------------------------------------
# Menulis ulasan
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_review_uses_token_identity_and_starts_pending(client, repo):
    _install(repo)
    _login(ALICE)

    response = await client.post(
        f"/api/v1/books/{BOOK_A}/reviews",
        json={"rating": 4, "body": GOOD_BODY, "user_id": str(BOB)},
    )

    assert response.status_code == 201, response.text
    data = response.json()["data"]
    assert data["status"] == "pending"
    assert data["author"] is None  # penulis sendiri tidak dikirim balik
    stored = next(iter(repo.reviews.values()))
    assert stored.user_id == ALICE
    assert stored.book_id == BOOK_A


@pytest.mark.asyncio
async def test_create_review_rejects_unknown_book(client, repo):
    _install(repo)
    _login(ALICE)

    response = await client.post(
        f"/api/v1/books/{MISSING_BOOK}/reviews", json={"rating": 4, "body": GOOD_BODY}
    )

    assert response.status_code == 404
    assert repo.reviews == {}


@pytest.mark.asyncio
async def test_short_body_is_rejected_by_schema(client, repo):
    _install(repo)
    _login(ALICE)

    response = await client.post(
        f"/api/v1/books/{BOOK_A}/reviews", json={"rating": 4, "body": "  bagus  "}
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_second_review_for_same_book_conflicts(client, repo):
    repo.seed(ALICE, BOOK_A, status="approved")
    _install(repo)
    _login(ALICE)

    response = await client.post(
        f"/api/v1/books/{BOOK_A}/reviews", json={"rating": 3, "body": GOOD_BODY}
    )

    assert response.status_code == 409
    assert len(repo.reviews) == 1


@pytest.mark.asyncio
async def test_lost_insert_race_is_reported_as_conflict(client, repo, monkeypatch):
    _install(repo)
    _login(ALICE)

    async def racing_create(**kwargs):
        return None  # baris lain menyisipkan lebih dulu

    monkeypatch.setattr(repo, "create", racing_create)
    response = await client.post(
        f"/api/v1/books/{BOOK_A}/reviews", json={"rating": 3, "body": GOOD_BODY}
    )

    assert response.status_code == 409


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "body",
    [
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaa",  # huruf berulang
        "bagus bagus bagus bagus bagus bagus bagus bagus",  # kata berulang
    ],
)
async def test_spam_heuristics_reject_low_quality_body(client, repo, body):
    _install(repo)
    _login(ALICE)

    response = await client.post(
        f"/api/v1/books/{BOOK_A}/reviews", json={"rating": 3, "body": body}
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_daily_review_limit(client, repo):
    for index in range(MAX_REVIEWS_PER_DAY):
        repo.seed(ALICE, uuid4(), rating=4)
    _install(repo)
    _login(ALICE)

    response = await client.post(
        f"/api/v1/books/{BOOK_A}/reviews", json={"rating": 3, "body": GOOD_BODY}
    )

    assert response.status_code == 429


@pytest.mark.asyncio
async def test_admin_cannot_write_customer_review(client, repo):
    _install(repo)
    _login(ADMIN, role="admin")

    response = await client.post(
        f"/api/v1/books/{BOOK_A}/reviews", json={"rating": 5, "body": GOOD_BODY}
    )

    assert response.status_code == 403


# ---------------------------------------------------------------------------
# Membaca
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_shows_only_approved_and_computes_average(client, repo):
    repo.seed(BOB, BOOK_A, rating=5, status="approved")
    repo.seed(ALICE, BOOK_A, rating=3, status="rewarded")
    repo.seed(uuid4(), BOOK_A, rating=1, status="pending")
    repo.seed(uuid4(), BOOK_A, rating=1, status="rejected")
    _install(repo)
    _login(BOB)

    response = await client.get(f"/api/v1/books/{BOOK_A}/reviews")

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 2
    assert data["summary"]["average_rating"] == 4.0
    assert {item["status"] for item in data["items"]} == {"approved", "rewarded"}
    assert data["items"][0]["author"]["username"] in {"alice", "bob"}


@pytest.mark.asyncio
async def test_my_reviews_include_pending_and_rejected(client, repo):
    repo.seed(ALICE, BOOK_A, status="pending")
    repo.seed(ALICE, BOOK_B, status="rejected", rejection_reason="spam")
    repo.seed(BOB, BOOK_A, status="approved")
    _install(repo)
    _login(ALICE)

    response = await client.get("/api/v1/reviews/me")

    assert response.status_code == 200
    items = response.json()["data"]
    assert {item["status"] for item in items} == {"pending", "rejected"}


# ---------------------------------------------------------------------------
# Edit
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_edit_own_review(client, repo):
    review = repo.seed(ALICE, BOOK_A, status="approved")
    _install(repo)
    _login(ALICE)

    response = await client.patch(
        f"/api/v1/reviews/{review.id}", json={"rating": 2, "body": GOOD_BODY + " Sayang."}
    )

    assert response.status_code == 200
    assert response.json()["data"]["rating"] == 2


@pytest.mark.asyncio
async def test_edit_other_users_review_is_hidden_as_404(client, repo):
    review = repo.seed(BOB, BOOK_A, status="pending")
    _install(repo)
    _login(ALICE)

    response = await client.patch(f"/api/v1/reviews/{review.id}", json={"rating": 1})

    assert response.status_code == 404
    assert review.rating == 5


@pytest.mark.asyncio
async def test_rewarded_review_cannot_be_edited(client, repo):
    review = repo.seed(ALICE, BOOK_A, status="rewarded")
    _install(repo)
    _login(ALICE)

    response = await client.patch(f"/api/v1/reviews/{review.id}", json={"rating": 1})

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_editing_rejected_review_returns_it_to_queue(client, repo):
    review = repo.seed(ALICE, BOOK_A, status="rejected", rejection_reason="kurang jelas")
    _install(repo)
    _login(ALICE)

    response = await client.patch(
        f"/api/v1/reviews/{review.id}", json={"body": GOOD_BODY + " Versi yang lebih jelas."}
    )

    assert response.status_code == 200
    assert review.status == "pending"
    assert review.rejection_reason is None
    assert review.rewarded_at is None


# ---------------------------------------------------------------------------
# Moderasi
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_only_admin_can_moderate(client, repo):
    review = repo.seed(ALICE, BOOK_A)
    _install(repo)
    _login(BOB)

    response = await client.post(
        f"/api/v1/admin/reviews/{review.id}/moderate", json={"status": "approved"}
    )

    assert response.status_code == 403
    assert review.status == "pending"


@pytest.mark.asyncio
async def test_approve_runs_reward_hook_before_commit(client, repo):
    review = repo.seed(ALICE, BOOK_A)
    calls: list[tuple[UUID, int]] = []

    async def hook(_admin: UserPayload, approved) -> None:
        calls.append((approved.id, repo.commits))

    _install(repo, ReviewService(repo, on_approved=hook))  # type: ignore[arg-type]
    _login(ADMIN, role="admin")

    response = await client.post(
        f"/api/v1/admin/reviews/{review.id}/moderate", json={"status": "approved"}
    )

    assert response.status_code == 200, response.text
    # Hook berjalan sebelum commit moderasi: bila reward gagal, "approved" batal.
    assert calls == [(review.id, 0)]
    # Ledger tidak se-transaksi dengan ORM, jadi `rewarded` disimpan setelah
    # commit — keputusan akhir yang terlihat pengguna adalah `rewarded`.
    assert response.json()["data"]["status"] == "rewarded"
    assert review.status == "rewarded"
    assert review.rewarded_at is not None
    assert repo.commits == 2


@pytest.mark.asyncio
async def test_reject_records_reason_and_skips_hook(client, repo):
    review = repo.seed(ALICE, BOOK_A)
    calls = []

    async def hook(admin, approved):  # pragma: no cover - tidak boleh dipanggil
        calls.append(approved)

    _install(repo, ReviewService(repo, on_approved=hook))  # type: ignore[arg-type]
    _login(ADMIN, role="admin")

    response = await client.post(
        f"/api/v1/admin/reviews/{review.id}/moderate",
        json={"status": "rejected", "reason": "Tidak relevan"},
    )

    assert response.status_code == 200
    assert review.status == "rejected"
    assert review.rejection_reason == "Tidak relevan"
    assert calls == []


@pytest.mark.parametrize("status", ["rewarded", "approved"])
@pytest.mark.asyncio
async def test_final_moderation_decision_cannot_be_changed(client, repo, status):
    review = repo.seed(ALICE, BOOK_A, status=status)
    _install(repo)
    _login(ADMIN, role="admin")

    response = await client.post(
        f"/api/v1/admin/reviews/{review.id}/moderate", json={"status": "rejected"}
    )

    assert response.status_code == 409
    assert review.status == status


@pytest.mark.asyncio
async def test_moderation_queue_defaults_to_pending(client, repo):
    pending = repo.seed(ALICE, BOOK_A)
    repo.seed(BOB, BOOK_B, status="approved")
    _install(repo)
    _login(ADMIN, role="admin")

    response = await client.get("/api/v1/admin/reviews")

    assert response.status_code == 200
    data = response.json()["data"]
    assert [item["id"] for item in data["items"]] == [str(pending.id)]
    assert data["total"] == 1
