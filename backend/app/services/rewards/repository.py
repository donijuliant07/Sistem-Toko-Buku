"""Akses data untuk Book Rewards.

Dua jalur sengaja dipisah:

- **`LedgerGateway`** — satu-satunya jalur perubahan saldo: RPC
  `apply_point_transaction` lewat PostgREST (`supabase_admin`). RPC-nya
  atomic (kunci baris profil + tulis ledger dalam satu transaksi), jadi
  idempotensi, cap harian, dan saldo tidak bisa dilewati dari aplikasi.
- **`RewardsRepository`** — tabel lain yang dibaca/ditulis backend
  (`reward_rules`, `reward_activities`, `ai_review_generations`,
  `point_transactions`) dan kueri turunan dari tabel milik fitur lain
  (`orders`, `order_items`, `books`, `reviews`, `chat_messages`,
  `chat_message_helpful_marks`, `profiles`).

Alasan tidak memakai ORM async untuk ledger: `orders`/`payments` sudah dikelola
`OrderService` lewat PostgREST, dan reward pembelian harus memakai source of
truth yang sama. Konsekuensinya, hook reward dari service async (ulasan,
komunitas) berjalan di **transaksi terpisah** — lihat catatan di
`RewardsService`.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Protocol
from uuid import UUID

from app.core.supabase import supabase_admin
from supabase import Client


class LedgerGateway(Protocol):
    """Permukaan minimal ledger yang dipakai service dan tes."""

    def apply(
        self,
        *,
        user_id: UUID | str,
        delta: int,
        transaction_type: str,
        source_type: str,
        source_id: str,
        idempotency_key: str,
        metadata: dict[str, Any] | None = None,
        created_by: UUID | str | None = None,
        book_id: UUID | str | None = None,
        daily_cap: int | None = None,
        cap_type: str | None = None,
    ) -> dict[str, Any] | None:
        """Terapkan satu transaksi; `None` bila RPC tidak tersedia di DB."""


class SupabaseLedger(LedgerGateway):
    """Pemanggil RPC `apply_point_transaction` (migrasi `20261019_11`)."""

    def __init__(self, client: Client | None = None) -> None:
        self._client = client or supabase_admin

    def apply(
        self,
        *,
        user_id: UUID | str,
        delta: int,
        transaction_type: str,
        source_type: str,
        source_id: str,
        idempotency_key: str,
        metadata: dict[str, Any] | None = None,
        created_by: UUID | str | None = None,
        book_id: UUID | str | None = None,
        daily_cap: int | None = None,
        cap_type: str | None = None,
    ) -> dict[str, Any] | None:
        response = self._client.rpc(
            "apply_point_transaction",
            {
                "p_user": str(user_id),
                "p_delta": int(delta),
                "p_type": transaction_type,
                "p_source_type": source_type,
                "p_source_id": str(source_id),
                "p_idem": idempotency_key,
                "p_metadata": metadata or {},
                "p_created_by": str(created_by) if created_by else None,
                "p_book_id": str(book_id) if book_id else None,
                "p_daily_cap": daily_cap,
                "p_cap_type": cap_type,
            },
        ).execute()
        data = response.data
        # Fungsi mengembalikan satu baris `point_transactions` (komposit).
        if isinstance(data, list):
            return data[0] if data else None
        return data


def _rows(response: Any) -> list[dict[str, Any]]:
    return list(getattr(response, "data", None) or [])


def _is_unique_violation(error: Exception) -> bool:
    """Deteksi pelanggaran UNIQUE dari PostgREST tanpa bergantung library-nya."""
    code = getattr(error, "code", None)
    if code in ("23505", "PGRST23505"):
        return True
    text = str(error)
    return "23505" in text or "duplicate key" in text.lower()


class RewardsRepository:
    """Kueri pendukung ledger. Tidak pernah menulis `point_transactions` langsung."""

    def __init__(self, client: Client | None = None) -> None:
        self._client = client or supabase_admin

    # -- profil & saldo -------------------------------------------------
    def get_profile(self, user_id: UUID | str) -> dict[str, Any] | None:
        for row in _rows(
            self._client.table("profiles")
            .select("id, points")
            .eq("id", str(user_id))
            .limit(1)
            .execute()
        ):
            return row
        return None

    # -- aturan ---------------------------------------------------------
    def load_rules(self) -> dict[str, int]:
        return {
            str(row["key"]): int(row["value"])
            for row in _rows(self._client.table("reward_rules").select("key, value").execute())
        }

    def set_rules(self, values: dict[str, int], *, actor_id: UUID | str) -> None:
        """Ubah beberapa aturan sekaligus lewat RPC `set_reward_rules`.

        RPC ini menulis audit dan `UPDATE reward_rules` dalam satu transaksi
        dengan sinyal `app.rewards_rules_ok` — satu-satunya jalur yang lolos
        trigger `guard_reward_rules_write`.
        """
        self._client.rpc(
            "set_reward_rules",
            {"p_values": {key: int(value) for key, value in values.items()},
             "p_actor": str(actor_id)},
        ).execute()

    # -- ledger ---------------------------------------------------------
    def list_transactions(
        self, user_id: UUID | str, *, page: int, limit: int
    ) -> tuple[list[dict[str, Any]], int]:
        start = (page - 1) * limit
        response = (
            self._client.table("point_transactions")
            .select("*", count="exact")
            .eq("user_id", str(user_id))
            .order("created_at", desc=True)
            .order("id", desc=True)
            .range(start, start + limit - 1)
            .execute()
        )
        return _rows(response), int(getattr(response, "count", 0) or 0)

    def find_transaction(
        self,
        *,
        idempotency_key: str | None = None,
        user_id: UUID | str | None = None,
        transaction_type: str | None = None,
        source_type: str | None = None,
        source_id: str | None = None,
    ) -> dict[str, Any] | None:
        query = self._client.table("point_transactions").select("*")
        if idempotency_key is not None:
            query = query.eq("idempotency_key", idempotency_key)
        if user_id is not None:
            query = query.eq("user_id", str(user_id))
        if transaction_type is not None:
            query = query.eq("transaction_type", transaction_type)
        if source_type is not None:
            query = query.eq("source_type", source_type)
        if source_id is not None:
            query = query.eq("source_id", str(source_id))
        rows = _rows(query.limit(1).execute())
        return rows[0] if rows else None

    def find_transaction_by_id(self, transaction_id: UUID | str) -> dict[str, Any] | None:
        rows = _rows(
            self._client.table("point_transactions")
            .select("*")
            .eq("id", str(transaction_id))
            .limit(1)
            .execute()
        )
        return rows[0] if rows else None

    def reconcile(self) -> list[dict[str, Any]]:
        """Baris `profiles.points` yang berbeda dari jumlah ledger."""
        return _rows(self._client.rpc("reconcile_reward_points", {}).execute())

    def count_profiles(self) -> int:
        response = self._client.table("profiles").select("id", count="exact").limit(1).execute()
        return int(getattr(response, "count", 0) or 0)

    # -- pembelian ------------------------------------------------------
    def get_order(self, order_id: str) -> dict[str, Any] | None:
        rows = _rows(
            self._client.table("orders")
            .select("id, user_id, status, total")
            .eq("id", str(order_id))
            .limit(1)
            .execute()
        )
        return rows[0] if rows else None

    def list_completed_orders(self) -> list[dict[str, Any]]:
        return _rows(
            self._client.table("orders")
            .select("id, user_id, status, total")
            .eq("status", "completed")
            .execute()
        )

    def count_books_bought(self, user_id: UUID | str, *, book_id: UUID | str | None = None) -> int:
        """Total unit buku dari pesanan selesai (seluruhnya, atau satu buku)."""
        data = self._client.rpc(
            "reward_units_bought",
            {"p_user": str(user_id), "p_book": str(book_id) if book_id else None},
        ).execute().data
        if isinstance(data, list):
            data = data[0] if data else 0
        return int(data or 0)

    # -- ulasan ---------------------------------------------------------
    def get_review(self, review_id: UUID | str) -> dict[str, Any] | None:
        rows = _rows(
            self._client.table("reviews")
            .select("id, user_id, book_id, status")
            .eq("id", str(review_id))
            .limit(1)
            .execute()
        )
        return rows[0] if rows else None

    def list_reviews(self, *, status: str) -> list[dict[str, Any]]:
        return _rows(
            self._client.table("reviews")
            .select("id, user_id, book_id, status")
            .eq("status", status)
            .execute()
        )

    def mark_review_rewarded(self, review_id: UUID | str) -> None:
        self._client.table("reviews").update(
            {"status": "rewarded"}
        ).eq("id", str(review_id)).eq("status", "approved").execute()

    # -- komunitas ------------------------------------------------------
    def get_message(self, message_id: UUID | str) -> dict[str, Any] | None:
        rows = _rows(
            self._client.table("chat_messages")
            .select("id, sender_id, moderation_status, deleted_at, parent_message_id")
            .eq("id", str(message_id))
            .limit(1)
            .execute()
        )
        return rows[0] if rows else None

    def count_helpful_marks(self, message_id: UUID | str) -> int:
        response = (
            self._client.table("chat_message_helpful_marks")
            .select("user_id", count="exact")
            .eq("message_id", str(message_id))
            .limit(1)
            .execute()
        )
        return int(getattr(response, "count", 0) or 0)

    def list_approved_messages(self) -> list[dict[str, Any]]:
        return _rows(
            self._client.table("chat_messages")
            .select("id, sender_id")
            .eq("moderation_status", "approved")
            .execute()
        )

    # -- aktivitas ------------------------------------------------------
    def upsert_activity(
        self,
        *,
        user_id: UUID | str,
        activity_type: str,
        source_type: str,
        source_id: UUID | str,
        status: str,
        points_awarded: int | None = None,
        reviewed_by: UUID | str | None = None,
        reviewed_at: str | None = None,
        approved_at: str | None = None,
        rejection_reason: str | None = None,
    ) -> None:
        """Catat/ubah status aktivitas; kunci uniknya `uq_reward_activity_source`."""
        self._client.table("reward_activities").upsert(
            {
                "user_id": str(user_id),
                "activity_type": activity_type,
                "source_type": source_type,
                "source_id": str(source_id),
                "status": status,
                "points_awarded": points_awarded,
                "reviewed_by": str(reviewed_by) if reviewed_by else None,
                "reviewed_at": reviewed_at,
                "approved_at": approved_at,
                "rejection_reason": rejection_reason,
            },
            on_conflict="user_id,activity_type,source_type,source_id",
        ).execute()

    def get_activity(
        self, *, user_id: UUID | str, activity_type: str, source_type: str, source_id: UUID | str
    ) -> dict[str, Any] | None:
        rows = _rows(
            self._client.table("reward_activities")
            .select("*")
            .eq("user_id", str(user_id))
            .eq("activity_type", activity_type)
            .eq("source_type", source_type)
            .eq("source_id", str(source_id))
            .limit(1)
            .execute()
        )
        return rows[0] if rows else None

    def list_activities(
        self, *, status: str | None, page: int, limit: int
    ) -> tuple[list[dict[str, Any]], int]:
        start = (page - 1) * limit
        query = self._client.table("reward_activities").select("*", count="exact")
        if status is not None:
            query = query.eq("status", status)
        response = query.order("created_at", desc=True).range(start, start + limit - 1).execute()
        return _rows(response), int(getattr(response, "count", 0) or 0)

    # -- generasi AI ----------------------------------------------------
    def create_generation(
        self,
        *,
        generation_id: UUID,
        user_id: UUID | str,
        book_id: UUID | str,
        spoiler_level: str,
        access_method: str,
        points_spent: int,
        idempotency_key: str,
    ) -> dict[str, Any] | None:
        """Sisipkan baris `pending`; `None` bila key/level itu sudah pending (UNIQUE)."""
        try:
            rows = _rows(
                self._client.table("ai_review_generations")
                .insert(
                    {
                        "id": str(generation_id),
                        "user_id": str(user_id),
                        "book_id": str(book_id),
                        "spoiler_level": spoiler_level,
                        "access_method": access_method,
                        "points_spent": points_spent,
                        "status": "pending",
                        "idempotency_key": idempotency_key,
                        "started_at": datetime.now(UTC).isoformat(),
                    }
                )
                .execute()
            )
        except Exception as exc:
            if _is_unique_violation(exc):
                return None
            raise
        return rows[0] if rows else None

    def get_generation(
        self, *, user_id: UUID | str, idempotency_key: str
    ) -> dict[str, Any] | None:
        rows = _rows(
            self._client.table("ai_review_generations")
            .select("*")
            .eq("user_id", str(user_id))
            .eq("idempotency_key", idempotency_key)
            .limit(1)
            .execute()
        )
        return rows[0] if rows else None

    def get_unlocked_generation(
        self, *, user_id: UUID | str, book_id: UUID | str, spoiler_level: str
    ) -> dict[str, Any] | None:
        """Generasi sukses atau yang pernah dibayar — akses tidak ditagih ulang."""
        rows = _rows(
            self._client.table("ai_review_generations")
            .select("*")
            .eq("user_id", str(user_id))
            .eq("book_id", str(book_id))
            .eq("spoiler_level", spoiler_level)
            .in_("status", ["success", "pending"])
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return rows[0] if rows else None

    def find_success_generation(
        self, *, user_id: UUID | str, book_id: UUID | str, spoiler_level: str
    ) -> dict[str, Any] | None:
        """Hasil sukses terakhir untuk (pengguna, buku, level) — dipakai ulang gratis."""
        rows = _rows(
            self._client.table("ai_review_generations")
            .select("*")
            .eq("user_id", str(user_id))
            .eq("book_id", str(book_id))
            .eq("spoiler_level", spoiler_level)
            .eq("status", "success")
            .order("completed_at", desc=True)
            .limit(1)
            .execute()
        )
        return rows[0] if rows else None

    def get_generation_by_id(self, generation_id: UUID | str) -> dict[str, Any] | None:
        rows = _rows(
            self._client.table("ai_review_generations")
            .select("*")
            .eq("id", str(generation_id))
            .limit(1)
            .execute()
        )
        return rows[0] if rows else None

    def list_generations(
        self, user_id: UUID | str, *, page: int, limit: int
    ) -> tuple[list[dict[str, Any]], int]:
        start = (page - 1) * limit
        response = (
            self._client.table("ai_review_generations")
            .select("*", count="exact")
            .eq("user_id", str(user_id))
            .order("created_at", desc=True)
            .range(start, start + limit - 1)
            .execute()
        )
        return _rows(response), int(getattr(response, "count", 0) or 0)

    def update_generation(self, generation_id: UUID | str, **changes: Any) -> None:
        self._client.table("ai_review_generations").update(changes).eq(
            "id", str(generation_id)
        ).execute()

    def list_stale_pending(self, *, older_than: str) -> list[dict[str, Any]]:
        return _rows(
            self._client.table("ai_review_generations")
            .select("*")
            .eq("status", "pending")
            .lt("created_at", older_than)
            .execute()
        )


__all__ = ["LedgerGateway", "RewardsRepository", "SupabaseLedger", "ledger_gateway"]

#: Instans default; tes mengganti lewat injeksi `RewardsService`.
ledger_gateway: LedgerGateway = SupabaseLedger()
