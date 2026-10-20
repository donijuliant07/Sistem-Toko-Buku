"""RewardsService — satu pintu untuk seluruh perubahan poin.

Prinsip
-------
1. **Saldo hanya berubah lewat ledger.** Setiap metode memanggil RPC
   `apply_point_transaction` (migrasi `20261019_11`) dengan *idempotency key*
   deterministik; memanggil ulang dengan key yang sama mengembalikan baris
   lama, bukan menambah poin. Tabel lain (ulasan, pesan, generasi AI) hanya
   menyimpan status/jejak, tidak pernah saldo.
2. **Aturan dibaca dari `reward_rules`** dengan fallback ke
   `rule_catalog.DEFAULT_VALUES`, sehingga admin bisa mengubah nilai tanpa
   deploy dan tabel yang belum termigrasi tidak membuat reward jadi nol
   diam-diam.
3. **Kegagalan ledger tidak boleh membawa akibat sampingan.** Metode
   mengembalikan `None` untuk "tidak ada yang perlu dilakukan" (idempoten,
   belum memenuhi syarat), dan melempar `RewardsError` hanya untuk kesalahan
   yang perlu dilihat pemanggil.

Batas transaksi (penting)
-------------------------
Ledger berjalan di PostgREST (sinkron), sedangkan ulasan dan komunitas memakai
ORM async. Keduanya **tidak** bisa berada dalam satu transaksi database. Yang
dijamin:

- ledger sendiri atomic dan idempoten;
- penanda "sudah dibayar/direward" baru diset **setelah** ledger sukses;
- `backfill` dan `reconcile` dapat memperbaiki keadaan bila proses mati di
  antara langkah.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from app.core.security import UserPayload
from app.schemas.ai_review import SpoilerLevel
from app.schemas.rewards import (
    AIReviewGenerationRead,
    AIReviewSummary,
    BackfillReport,
    PointTransactionPage,
    PointTransactionRead,
    ReconcileReport,
    RewardActivityPage,
    RewardActivityRead,
    RewardRuleRead,
    RewardRulesRead,
    RewardsMe,
    SpoilerAccessRead,
)
from app.services.rewards import access
from app.services.rewards.errors import RewardsError, from_rpc_error, invalid_request
from app.services.rewards.repository import (
    LedgerGateway,
    RewardsRepository,
    SupabaseLedger,
)
from app.services.rewards.rule_catalog import DEFAULT_VALUES, RULES_BY_KEY

logger = logging.getLogger(__name__)

#: Generasi `pending` lebih tua dari ini dianggap mati (proses crash) dan
#: direfund oleh job pemulihan.
STALE_GENERATION_AFTER = timedelta(minutes=10)

#: Jumlah baris "reward terbaru" di ringkasan `me`.
RECENT_REWARDS_LIMIT = 5

_REWARD_TYPES = (
    "purchase_reward",
    "review_reward",
    "community_reward",
    "admin_adjustment",
)

#: Pemanggil model AI: `(book=..., spoiler_level=...) -> AIReviewResponse`.
ReviewGenerator = Callable[..., Any]


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


@dataclass(frozen=True)
class LedgerResult:
    """Hasil satu panggilan ledger yang sudah dinormalisasi."""

    transaction_id: UUID
    points_delta: int
    balance_after: int


class RewardsService:
    def __init__(
        self,
        ledger: LedgerGateway | None = None,
        repository: RewardsRepository | None = None,
    ) -> None:
        self._ledger: LedgerGateway = ledger or SupabaseLedger()
        self._repo: RewardsRepository = repository or RewardsRepository()

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------
    def rules(self) -> dict[str, int]:
        return {**DEFAULT_VALUES, **self._repo.load_rules()}

    @staticmethod
    def _ledger_result(row: dict[str, Any] | None) -> LedgerResult | None:
        if not row:
            return None
        return LedgerResult(
            transaction_id=UUID(str(row["id"])),
            points_delta=int(row.get("points_delta") or 0),
            balance_after=int(row.get("balance_after") or 0),
        )

    def _apply(self, **kwargs: Any) -> LedgerResult | None:
        """Bungkus RPC dan terjemahkan kode error PostgreSQL ke `RewardsError`."""
        try:
            return self._ledger_result(self._ledger.apply(**kwargs))
        except RewardsError:
            raise
        except Exception as exc:
            mapped = from_rpc_error(exc)
            if mapped is not None:
                raise mapped from exc
            raise

    # ------------------------------------------------------------------
    # Ringkasan pengguna
    # ------------------------------------------------------------------
    def get_me(self, user: UserPayload, *, book_id: UUID | None = None) -> RewardsMe:
        profile = self._repo.get_profile(user.id)
        if profile is None:
            raise RewardsError(404, "PROFILE_NOT_FOUND", "Profil tidak ditemukan.")
        rules = self.rules()
        total_units = self._repo.count_books_bought(user.id)
        units = (
            self._repo.count_books_bought(user.id, book_id=book_id)
            if book_id is not None
            else total_units
        )
        levels: dict[str, SpoilerAccessRead] = {}
        for level in ("no_spoiler", "low", *access.PAID_LEVELS):
            decision = access.evaluate_access(level=level, units_bought=units, rules=rules)
            unlocked = decision.granted
            if not unlocked and book_id is not None:
                unlocked = (
                    self._repo.find_success_generation(
                        user_id=user.id, book_id=book_id, spoiler_level=level
                    )
                    is not None
                )
            levels[level] = SpoilerAccessRead(
                level=SpoilerLevel(level),
                method=decision.method,
                cost=decision.cost,
                units_bought=units,
                min_units=decision.min_units,
                unlocked=unlocked,
            )

        recent, _ = self._repo.list_transactions(user.id, page=1, limit=50)
        rewards = [
            row
            for row in recent
            if row.get("transaction_type") in _REWARD_TYPES
            and int(row.get("points_delta") or 0) > 0
        ][:RECENT_REWARDS_LIMIT]
        return RewardsMe(
            points=int(profile.get("points") or 0),
            total_books_bought=total_units,
            spoiler_access=levels,
            recent_rewards=[
                {
                    "transaction_type": row["transaction_type"],
                    "points_delta": int(row["points_delta"]),
                    "created_at": row["created_at"],
                }
                for row in rewards
            ],
        )

    def list_transactions(
        self, user: UserPayload, *, page: int, limit: int
    ) -> PointTransactionPage:
        rows, total = self._repo.list_transactions(user.id, page=page, limit=limit)
        return PointTransactionPage(
            items=[
                PointTransactionRead(
                    id=UUID(str(row["id"])),
                    points_delta=int(row["points_delta"]),
                    balance_after=int(row["balance_after"]),
                    transaction_type=row["transaction_type"],
                    source_type=row["source_type"],
                    source_id=row["source_id"],
                    book_id=UUID(str(row["book_id"])) if row.get("book_id") else None,
                    metadata=dict(row.get("metadata") or {}),
                    created_at=row["created_at"],
                )
                for row in rows
            ],
            total=total,
            page=page,
            limit=limit,
            total_pages=(total + limit - 1) // limit if total else 1,
        )

    # ------------------------------------------------------------------
    # Pembelian
    # ------------------------------------------------------------------
    def reward_order(self, order_id: str) -> LedgerResult | None:
        """Beri poin bila pesanan berstatus `completed`. Idempoten per pesanan.

        Catatan: index `uq_point_tx_purchase_per_order` membatasi satu reward
        pembelian per pesanan seumur hidup. Pesanan selesai → dibatalkan (poin
        ditarik) → selesai lagi **tidak** mendapat poin kedua; koreksi semacam
        itu dilakukan admin lewat penyesuaian manual yang tercatat.
        """
        order = self._repo.get_order(order_id)
        if order is None or order.get("status") != "completed":
            return None
        if not order.get("user_id"):
            return None
        per_unit = self.rules().get("purchase_points_per_10000", 0)
        delta = access.purchase_points(order.get("total"), per_unit)
        if delta <= 0:
            return None
        return self._apply(
            user_id=order["user_id"],
            delta=delta,
            transaction_type="purchase_reward",
            source_type="order",
            source_id=str(order_id),
            idempotency_key=f"order:{order_id}:purchase",
            metadata={
                "total_paid": str(Decimal(str(order.get("total") or 0))),
                "per_10000": per_unit,
            },
        )

    def reverse_order(self, order_id: str) -> LedgerResult | None:
        """Tarik kembali poin pembelian saat pesanan dibatalkan.

        Keberadaan transaksi pembelian di ledger dijadikan syarat (bukan
        `old_status`), sehingga pembatalan berulang atau proses yang mati di
        tengah jalan tidak pernah menghasilkan reversal ganda — index unik
        `uq_point_tx_reversal_per_order` menjadi jaring pengaman terakhir.
        """
        purchase = self._repo.find_transaction(
            transaction_type="purchase_reward", source_type="order", source_id=str(order_id)
        )
        if purchase is None:
            return None
        return self._apply(
            user_id=purchase["user_id"],
            delta=-abs(int(purchase["points_delta"])),
            transaction_type="order_reversal",
            source_type="order",
            source_id=str(order_id),
            idempotency_key=f"order:{order_id}:reversal",
            metadata={"reason": "order_cancelled", "purchase_tx": str(purchase["id"])},
        )

    # ------------------------------------------------------------------
    # Ulasan
    # ------------------------------------------------------------------
    def reward_review(
        self,
        *,
        review_id: UUID | str,
        user_id: UUID | str | None = None,
        book_id: UUID | str | None = None,
        reviewer: UUID | str | None = None,
    ) -> LedgerResult | None:
        """Beri poin untuk ulasan yang baru disetujui.

        Maksimal sekali per pengguna per buku: key ledger memakai `book_id`
        (selaras index `uq_point_tx_review_per_book`), bukan `review_id`,
        sehingga ulasan yang dihapus lalu ditulis ulang tidak menghasilkan poin
        kedua. Bila `user_id`/`book_id` tidak diberikan (hook router hanya punya
        `ReviewRead`), keduanya dibaca ulang dari tabel `reviews`.
        """
        if user_id is None or book_id is None:
            stored = self._repo.get_review(review_id)
            if stored is None:
                raise RewardsError(404, "REVIEW_NOT_FOUND", "Ulasan tidak ditemukan.")
            user_id = user_id or stored["user_id"]
            book_id = book_id or stored["book_id"]

        points = self.rules().get("review_points", 0)
        result: LedgerResult | None = None
        if points > 0:
            result = self._apply(
                user_id=user_id,
                delta=points,
                transaction_type="review_reward",
                source_type="review",
                source_id=str(review_id),
                idempotency_key=f"review:{user_id}:{book_id}",
                created_by=reviewer,
                book_id=book_id,
                metadata={"review_id": str(review_id)},
            )
        self._repo.mark_review_rewarded(review_id)
        self._repo.upsert_activity(
            user_id=user_id,
            activity_type="review",
            source_type="review",
            source_id=review_id,
            status="rewarded",
            points_awarded=result.points_delta if result else 0,
            reviewed_by=reviewer,
            reviewed_at=_now_iso(),
            approved_at=_now_iso(),
        )
        return result

    # ------------------------------------------------------------------
    # Komunitas
    # ------------------------------------------------------------------
    def reward_contribution(
        self, *, message_id: UUID | str, author_id: UUID | str, reviewer: UUID | str | None = None
    ) -> LedgerResult | None:
        """Poin kontribusi setelah moderator menyetujui pesan (cap harian).

        Cap ditegakkan RPC (`p_daily_cap` + `p_cap_type`) memakai zona
        Asia/Jakarta, sehingga dua request paralel tidak bisa melewatinya.
        """
        rules = self.rules()
        points = rules.get("community_contribution_points", 0)
        if points <= 0:
            return None
        result = self._apply(
            user_id=author_id,
            delta=points,
            transaction_type="community_reward",
            source_type="chat_message",
            source_id=str(message_id),
            idempotency_key=f"community:{message_id}:contribution",
            created_by=reviewer,
            daily_cap=rules.get("community_contribution_daily_cap"),
            cap_type="community_reward",
            metadata={"kind": "contribution"},
        )
        self._mark_activity(
            user_id=author_id,
            activity_type="community_contribution",
            source_id=message_id,
            result=result,
            reviewer=reviewer,
        )
        return result

    def reward_helpful_answer(self, *, message_id: UUID | str) -> LedgerResult | None:
        """Poin penulis balasan setelah jumlah penanda "membantu" cukup.

        Idempotensi ganda: key ledger per pesan dan index unik
        `uq_point_tx_community (user_id, source_type, source_id)`.
        """
        message = self._repo.get_message(message_id)
        if message is None or message.get("deleted_at") or not message.get("parent_message_id"):
            return None
        rules = self.rules()
        minimum = rules.get("helpful_answer_min_marks", 0)
        if minimum <= 0 or self._repo.count_helpful_marks(message_id) < minimum:
            return None
        points = rules.get("helpful_answer_points", 0)
        if points <= 0:
            return None
        result = self._apply(
            user_id=message["sender_id"],
            delta=points,
            transaction_type="community_reward",
            source_type="chat_message",
            source_id=str(message_id),
            idempotency_key=f"community:{message_id}:helpful",
            daily_cap=rules.get("helpful_answer_daily_cap"),
            cap_type="community_reward",
            metadata={"kind": "helpful_answer"},
        )
        self._mark_activity(
            user_id=message["sender_id"],
            activity_type="helpful_answer",
            source_id=message_id,
            result=result,
        )
        return result

    def _mark_activity(
        self,
        *,
        user_id: UUID | str,
        activity_type: str,
        source_id: UUID | str,
        result: LedgerResult | None,
        reviewer: UUID | str | None = None,
    ) -> None:
        """Catat baris `rewarded` di `reward_activities` untuk audit admin.

        Ditulis **setelah** ledger sukses; bila proses mati di antara keduanya,
        ledger sudah idempoten dan backfill menuliskan baris yang tertinggal.
        """
        if result is None:
            return
        now = _now_iso()
        self._repo.upsert_activity(
            user_id=user_id,
            activity_type=activity_type,
            source_type="chat_message",
            source_id=source_id,
            status="rewarded",
            points_awarded=result.points_delta,
            reviewed_by=reviewer,
            reviewed_at=now,
            approved_at=now,
        )

    # ------------------------------------------------------------------
    # Admin: aturan dan penyesuaian
    # ------------------------------------------------------------------
    def list_rules(self) -> RewardRulesRead:
        values = self.rules()
        return RewardRulesRead(
            rules=[
                RewardRuleRead(
                    key=definition.key,
                    value=values[definition.key],
                    default=definition.default,
                    max_value=definition.max_value,
                )
                for definition in RULES_BY_KEY.values()
            ]
        )

    def update_rules(self, admin: UserPayload, values: dict[str, int]) -> RewardRulesRead:
        """Ubah aturan lewat RPC `set_reward_rules` (UPDATE + audit satu transaksi)."""
        for key, value in values.items():
            definition = RULES_BY_KEY.get(key)
            if definition is None:
                raise invalid_request(f"Aturan tidak dikenal: {key}")
            if value < 0 or value > definition.max_value:
                raise invalid_request(
                    f"Nilai aturan {key} harus di antara 0 dan {definition.max_value}."
                )
        self._repo.set_rules(values, actor_id=admin.id)
        return self.list_rules()

    def adjust_points(
        self, admin: UserPayload, *, user_id: UUID, delta: int, reason: str, reference: str | None
    ) -> LedgerResult:
        if delta == 0:
            raise invalid_request("Perubahan poin tidak boleh nol.")
        idem = f"admin:{admin.id}:{reference}" if reference else f"admin:{admin.id}:{uuid4()}"
        result = self._apply(
            user_id=user_id,
            delta=delta,
            transaction_type="admin_adjustment",
            source_type="admin",
            source_id=str(admin.id),
            idempotency_key=idem,
            created_by=admin.id,
            metadata={"reason": reason.strip(), "reference": reference},
        )
        if result is None:  # pragma: no cover - RPC tidak pernah mengembalikan kosong
            raise RewardsError(500, "LEDGER_UNAVAILABLE", "Ledger tidak mengembalikan transaksi.")
        return result

    # ------------------------------------------------------------------
    # Backfill dan rekonsiliasi
    # ------------------------------------------------------------------
    def backfill(self, admin: UserPayload) -> BackfillReport:
        """Beri reward susulan untuk data lama yang memenuhi syarat.

        Aman diulang: seluruh panggilan ledger memakai key deterministik, jadi
        baris yang sudah ada hanya dikembalikan, tidak ditambahkan.
        """
        orders = 0
        rewarded = 0
        total = 0
        for order in self._repo.list_completed_orders():
            orders += 1
            result = self.reward_order(str(order["id"]))
            if result is not None:
                rewarded += 1
                total += result.points_delta

        reviews = 0
        for review in self._repo.list_reviews(status="approved"):
            reviews += 1
            try:
                self.reward_review(
                    review_id=review["id"],
                    user_id=review["user_id"],
                    book_id=review["book_id"],
                    reviewer=admin.id,
                )
            except RewardsError as exc:
                logger.warning("Backfill ulasan %s gagal: %s", review["id"], exc)

        messages = 0
        for message in self._repo.list_approved_messages():
            messages += 1
            activity = self._repo.get_activity(
                user_id=message["sender_id"],
                activity_type="community_contribution",
                source_type="chat_message",
                source_id=message["id"],
            )
            if activity is not None and activity.get("status") == "rewarded":
                continue
            try:
                self.reward_contribution(
                    message_id=message["id"],
                    author_id=message["sender_id"],
                    reviewer=admin.id,
                )
            except RewardsError as exc:
                logger.info("Backfill kontribusi %s dilewati: %s", message["id"], exc)

        return BackfillReport(
            scanned_orders=orders,
            rewarded_orders=rewarded,
            total_points=total,
            reviewed_reviews=reviews,
            approved_messages=messages,
        )

    def reconcile(self) -> ReconcileReport:
        """Bandingkan `profiles.points` dengan jumlah ledger.

        Saldo yang berbeda **dilaporkan**, tidak diperbaiki otomatis — koreksi
        harus lewat penyesuaian admin yang tercatat.
        """
        rows = self._repo.reconcile()
        return ReconcileReport(
            users_checked=self._repo.count_profiles(),
            mismatched=[
                {
                    "user_id": str(row["user_id"]),
                    "profile_points": int(row["cached_points"]),
                    "ledger_sum": int(row["ledger_points"]),
                }
                for row in rows
            ],
        )

    def list_activities(
        self, *, status: str | None, page: int, limit: int
    ) -> RewardActivityPage:
        rows, total = self._repo.list_activities(status=status, page=page, limit=limit)
        return RewardActivityPage(
            items=[
                RewardActivityRead(
                    id=UUID(str(row["id"])),
                    user_id=UUID(str(row["user_id"])),
                    activity_type=row["activity_type"],
                    source_type=row["source_type"],
                    source_id=UUID(str(row["source_id"])),
                    status=row["status"],
                    points_awarded=row.get("points_awarded"),
                    reviewed_by=UUID(str(row["reviewed_by"])) if row.get("reviewed_by") else None,
                    reviewed_at=row.get("reviewed_at"),
                    approved_at=row.get("approved_at"),
                    rejection_reason=row.get("rejection_reason"),
                    created_at=row["created_at"],
                )
                for row in rows
            ],
            total=total,
            page=page,
            limit=limit,
            total_pages=(total + limit - 1) // limit if total else 1,
        )

    # ------------------------------------------------------------------
    # AI Book Advisor berbayar
    # ------------------------------------------------------------------
    def advisor_message_cost(self) -> int:
        """Biaya satu pesan advisor dari `reward_rules` (fallback 10 poin)."""
        return max(0, int(self.rules().get("advisor_message_points", 0)))

    def get_balance(self, user: UserPayload) -> int:
        """Saldo terkini dari `profiles.points`; `PROFILE_NOT_FOUND` bila tak ada."""
        profile = self._repo.get_profile(user.id)
        if profile is None:
            raise RewardsError(404, "PROFILE_NOT_FOUND", "Profil tidak ditemukan.")
        return int(profile.get("points") or 0)

    def charge_advisor_message(
        self, user: UserPayload, *, message_id: UUID | str, cost: int
    ) -> LedgerResult:
        """Potong biaya satu pesan advisor, tepat sekali per `message_id`.

        Pemotongan dilakukan **sebelum** model dipanggil (reservasi): RPC
        mengunci baris profil dan menolak saldo negatif, sehingga dua request
        bersamaan tidak bisa menembus saldo. RPC selesai dalam satu transaksi
        singkat — tidak ada transaksi database yang terbuka selama menunggu
        provider AI. Key deterministik `advisor:<message_id>:charge` membuat
        kirim ulang request tidak memotong dua kali.
        """
        if cost <= 0:
            raise invalid_request("Biaya pesan advisor harus lebih dari nol.")
        result = self._apply(
            user_id=user.id,
            delta=-cost,
            transaction_type="ai_chat_charge",
            source_type="ai_chat",
            source_id=str(message_id),
            idempotency_key=f"advisor:{message_id}:charge",
            metadata={"kind": "advisor_chat"},
        )
        if result is None:  # pragma: no cover - RPC tidak pernah mengembalikan kosong
            raise RewardsError(503, "LEDGER_UNAVAILABLE", "Ledger tidak mengembalikan transaksi.")
        return result

    def refund_advisor_message(
        self,
        user: UserPayload,
        *,
        message_id: UUID | str,
        charged: int,
        reason: str,
    ) -> LedgerResult | None:
        """Kembalikan poin pesan yang gagal diproses provider, tepat sekali.

        Key `advisor:<message_id>:refund` menjadikan refund idempoten: retry
        atau dua request paralel tidak menambah saldo dua kali.
        """
        if charged <= 0:
            return None
        return self._apply(
            user_id=user.id,
            delta=abs(charged),
            transaction_type="refund",
            source_type="ai_chat",
            source_id=str(message_id),
            idempotency_key=f"advisor:{message_id}:refund",
            metadata={"reason": reason[:200]},
        )

    def find_advisor_charge(self, *, message_id: UUID | str) -> dict[str, Any] | None:
        """Transaksi tagihan yang sudah ada untuk pesan ini (cek retry)."""
        return self._repo.find_transaction(
            transaction_type="ai_chat_charge",
            source_type="ai_chat",
            source_id=str(message_id),
        )

    # ------------------------------------------------------------------
    # AI Book Review berbayar
    # ------------------------------------------------------------------
    def spoiler_access(
        self, user: UserPayload, book_id: UUID
    ) -> dict[str, SpoilerAccessRead]:
        return self.get_me(user, book_id=book_id).spoiler_access

    def get_generation(self, user: UserPayload, generation_id: UUID) -> AIReviewGenerationRead:
        row = self._repo.get_generation_by_id(generation_id)
        if row is None or str(row["user_id"]) != user.id:
            # Milik orang lain dilaporkan 404, bukan 403.
            raise RewardsError(404, "GENERATION_NOT_FOUND", "Ulasan AI tidak ditemukan.")
        return self._generation_read(row)

    def list_generations(
        self, user: UserPayload, *, page: int, limit: int
    ) -> tuple[list[AIReviewSummary], int]:
        rows, total = self._repo.list_generations(user.id, page=page, limit=limit)
        return [self._generation_summary(row) for row in rows], total

    @staticmethod
    def _generation_summary(row: dict[str, Any]) -> AIReviewSummary:
        return AIReviewSummary(
            id=UUID(str(row["id"])),
            book_id=UUID(str(row["book_id"])),
            spoiler_level=SpoilerLevel(row["spoiler_level"]),
            access_method=row["access_method"],
            points_spent=int(row.get("points_spent") or 0),
            status=row["status"],
            provider=row.get("provider"),
            created_at=row["created_at"],
            completed_at=row.get("completed_at"),
        )

    @classmethod
    def _generation_read(cls, row: dict[str, Any]) -> AIReviewGenerationRead:
        return AIReviewGenerationRead(
            **cls._generation_summary(row).model_dump(),
            result=row.get("result"),
            failure_reason=row.get("failure_reason"),
        )

    def generate_ai_review(
        self,
        user: UserPayload,
        *,
        book_id: UUID,
        spoiler_level: SpoilerLevel,
        book: dict[str, Any],
        generator: ReviewGenerator,
        idempotency_key: str | None = None,
    ) -> tuple[AIReviewGenerationRead, bool]:
        """Siklus hidup satu generasi AI, tanpa biaya kedua.

        1. Key idempotensi sudah ada → kembalikan baris lama (`reused=True`).
        2. Level yang sama sudah pernah sukses → pakai ulang hasilnya, tanpa
           baris baru dan tanpa biaya.
        3. Hitung akses. Bila berbiaya, sisipkan baris `pending` **dulu**, lalu
           tagih ledger dengan key `ai:<generation_id>`; bila tagihan gagal,
           baris ditandai `failed`.
        4. Panggil generator. Sukses → simpan hasil. Gagal → refund otomatis.
        """
        key = idempotency_key or f"ai:{uuid4()}"
        existing = self._repo.get_generation(user_id=user.id, idempotency_key=key)
        if existing is not None:
            return self._generation_read(existing), True

        prior = self._repo.find_success_generation(
            user_id=user.id, book_id=book_id, spoiler_level=spoiler_level.value
        )
        if prior is not None:
            return self._generation_read(prior), True

        rules = self.rules()
        units = self._repo.count_books_bought(user.id, book_id=book_id)
        decision = access.evaluate_access(
            level=spoiler_level.value, units_bought=units, rules=rules
        )
        generation_id = uuid4()
        created = self._repo.create_generation(
            generation_id=generation_id,
            user_id=user.id,
            book_id=book_id,
            spoiler_level=spoiler_level.value,
            access_method=decision.method,
            points_spent=decision.cost if decision.method == access.ACCESS_POINTS else 0,
            idempotency_key=key,
        )
        if created is None:
            # Request paralel dengan key/level yang sama menang lebih dulu.
            winner = self._repo.get_generation(user_id=user.id, idempotency_key=key)
            if winner is None:
                winner = self._repo.get_unlocked_generation(
                    user_id=user.id, book_id=book_id, spoiler_level=spoiler_level.value
                )
            if winner is not None:
                return self._generation_read(winner), True
            raise RewardsError(
                409, "GENERATION_CONFLICT", "Permintaan ulasan AI yang sama sedang diproses."
            )

        if decision.method == access.ACCESS_POINTS:
            try:
                charge = self._apply(
                    user_id=user.id,
                    delta=-decision.cost,
                    transaction_type="ai_redemption",
                    source_type="ai_generation",
                    source_id=str(generation_id),
                    idempotency_key=f"ai:{generation_id}",
                    book_id=book_id,
                    metadata={"level": spoiler_level.value},
                )
            except RewardsError:
                self._repo.update_generation(
                    generation_id,
                    status="failed",
                    failure_reason="charge_failed",
                    completed_at=_now_iso(),
                )
                raise
            if charge is not None:
                self._repo.update_generation(
                    generation_id, redemption_tx_id=str(charge.transaction_id)
                )
                created["redemption_tx_id"] = str(charge.transaction_id)

        return self._finish_generation(created, book=book, generator=generator), False

    def _finish_generation(
        self,
        generation: dict[str, Any],
        *,
        book: dict[str, Any],
        generator: ReviewGenerator,
    ) -> AIReviewGenerationRead:
        """Panggil generator untuk baris `pending`; refund bila gagal."""
        generation_id = str(generation["id"])
        self._repo.update_generation(generation_id, started_at=_now_iso())
        try:
            review = generator(
                book=book, spoiler_level=SpoilerLevel(generation["spoiler_level"])
            )
        except Exception as exc:
            logger.exception("Generasi AI review %s gagal", generation_id)
            self._refund_generation(generation, reason=f"generation_failed: {exc}")
            return self._generation_read(
                self._repo.get_generation_by_id(generation["id"]) or generation
            )

        self._repo.update_generation(
            generation_id,
            status="success",
            result=review.model_dump(mode="json"),
            provider="cache" if getattr(review, "cached", False) else "openrouter",
            completed_at=_now_iso(),
        )
        return self._generation_read(
            self._repo.get_generation_by_id(generation["id"]) or generation
        )

    def _refund_generation(self, generation: dict[str, Any], *, reason: str) -> None:
        """Kembalikan poin generasi gagal, tepat sekali.

        Bila proses mati setelah tagihan tetapi sebelum `redemption_tx_id`
        tersimpan, transaksi dicari lewat ledger (`source_id = generation.id`)
        sehingga refund tetap bisa dilakukan.
        """
        if generation.get("refund_tx_id"):
            return
        redemption = None
        if generation.get("redemption_tx_id"):
            redemption = self._repo.find_transaction_by_id(generation["redemption_tx_id"])
        if redemption is None:
            redemption = self._repo.find_transaction(
                transaction_type="ai_redemption",
                source_type="ai_generation",
                source_id=str(generation["id"]),
            )
        if redemption is not None:
            self._apply(
                user_id=generation["user_id"],
                delta=abs(int(redemption["points_delta"])),
                transaction_type="refund",
                source_type="ai_generation",
                source_id=str(generation["id"]),
                idempotency_key=f"ai:{generation['id']}:refund",
                book_id=generation.get("book_id"),
                metadata={"reason": reason[:200]},
            )
        self._repo.update_generation(
            generation["id"],
            status="failed",
            failure_reason=reason[:500],
            completed_at=_now_iso(),
        )

    def recover_stale_generations(
        self, *, older_than: timedelta = STALE_GENERATION_AFTER
    ) -> int:
        """Job pemulihan: generasi `pending` yang mati di tengah jalan direfund."""
        cutoff = (datetime.now(UTC) - older_than).isoformat()
        count = 0
        for generation in self._repo.list_stale_pending(older_than=cutoff):
            self._refund_generation(generation, reason="stale_pending")
            count += 1
        return count


rewards_service = RewardsService()

__all__ = [
    "RECENT_REWARDS_LIMIT",
    "STALE_GENERATION_AFTER",
    "LedgerResult",
    "ReviewGenerator",
    "RewardsService",
    "rewards_service",
]
