"""Pembayaran manual: bukti transfer, verifikasi admin, dan jejak keputusan.

Alur singkat (lihat `docs/RENCANA-MANUAL-PAYMENT.md`):

    pending  --user unggah bukti-->  pending + bukti `pending`  (= under_review)
    under_review --admin approve-->  success                    (= paid)
    under_review --admin reject-->   failed + alasan             (= rejected)
    rejected --user unggah ulang-->  under_review

Aturan yang dijaga modul ini:

- **Total tagihan tidak pernah dari klien.** `payments.amount` ditulis saat
  checkout dari `orders.total`; approve hanya membandingkan keduanya.
- **Transisi memakai compare-and-set** (`UPDATE ... WHERE status = 'pending'`,
  satu bukti `pending` per pembayaran lewat unique index parsial). Dua klik
  approve bersamaan menghasilkan satu baris terupdate; yang kalah mendapat 409.
- **Status pesanan tidak diubah** oleh approve/reject. Penyelesaian pesanan
  tetap lewat `OrderService.update_status` dan aturannya sendiri.
- **Akses gambar** hanya lewat signed URL berumur pendek yang dibuat backend.
  Bucket `payment-proofs` privat dan browser tidak pernah menyentuhnya.
"""

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from postgrest.exceptions import APIError

from app.core import uploads
from app.core.config import settings
from app.core.supabase import supabase_admin
from app.schemas.order import OrderResponse
from app.schemas.payment import (
    PaymentAdminListItem,
    PaymentDetailRead,
    PaymentProofRead,
    PaymentRead,
    PaymentStatusView,
)
from app.services.order_service import _serialize_order

logger = logging.getLogger(__name__)

#: Pemetaan `payments.status` (+ apakah ada bukti menunggu) ke status yang dilihat UI.
_UNIQUE_VIOLATION = "23505"


class PaymentError(ValueError):
    """Kesalahan aturan bisnis pembayaran dengan status HTTP yang sesuai."""

    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def _not_found() -> PaymentError:
    # Sama dengan kebijakan pesanan: sumber daya milik orang lain = 404.
    return PaymentError("Pembayaran tidak ditemukan.", status.HTTP_404_NOT_FOUND)


def _conflict(detail: str) -> PaymentError:
    return PaymentError(detail, status.HTTP_409_CONFLICT)


def status_view(payment: dict[str, Any], proof_status: str | None = None) -> PaymentStatusView:
    """Terjemahkan status kolom + status bukti aktif ke kosakata UI."""
    raw = payment.get("status") or "pending"
    if raw == "pending":
        return "under_review" if proof_status == "pending" else "pending"
    if raw == "success":
        return "paid"
    if raw == "failed":
        return "rejected"
    if raw == "refunded":
        return "refunded"
    return "expired"


def _is_payment_migration_missing(error: Exception) -> bool:
    """Kolom `current_proof_id` belum ada → migrasi `20261024_13` belum dijalankan."""
    text = str(error)
    return "current_proof_id" in text and ("42703" in text or "does not exist" in text)


def _signed_urls(paths: list[str]) -> dict[str, str | None]:
    """Signed URL per path; kegagalan Storage tidak menggagalkan pembacaan data."""
    if not paths:
        return {}
    bucket = supabase_admin.storage.from_(settings.STORAGE_BUCKET_PAYMENT_PROOFS)
    result: dict[str, str | None] = {}
    for path in paths:
        try:
            res = bucket.create_signed_url(path, settings.PAYMENT_PROOF_SIGNED_URL_TTL)
            result[path] = res.get("signedURL") or res.get("signedUrl")
        except Exception:  # Storage opsional saat bucket belum dibuat
            logger.warning("Gagal membuat signed URL bukti pembayaran", exc_info=True)
            result[path] = None
    return result


def _proof_read(row: dict[str, Any], url: str | None) -> PaymentProofRead:
    return PaymentProofRead(
        id=row["id"],
        storage_path=row["storage_path"],
        original_filename=row.get("original_filename"),
        content_type=row.get("content_type") or "application/octet-stream",
        file_size=int(row.get("file_size") or 0),
        status=row.get("status") or "pending",
        uploaded_at=row.get("uploaded_at"),
        reviewed_at=row.get("reviewed_at"),
        review_note=row.get("review_note"),
        url=url,
    )


def _proofs_for(payment_ids: list[str]) -> dict[str, list[dict[str, Any]]]:
    if not payment_ids:
        return {}
    res = (
        supabase_admin.table("payment_proofs")
        .select("*")
        .in_("payment_id", payment_ids)
        .order("uploaded_at", desc=True)
        .execute()
    )
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in res.data or []:
        grouped.setdefault(row["payment_id"], []).append(row)
    return grouped


def _current_proof(payment: dict[str, Any], proofs: list[dict[str, Any]]) -> dict[str, Any] | None:
    current_id = payment.get("current_proof_id")
    if current_id:
        for row in proofs:
            if row["id"] == current_id:
                return row
    # Data lama (sebelum migrasi) atau pointer hilang: bukti terbaru adalah konteks yang masuk akal.
    return proofs[0] if proofs else None


def _serialize_payment(
    payment: dict[str, Any], proofs: list[dict[str, Any]], urls: dict[str, str | None]
) -> PaymentRead:
    current = _current_proof(payment, proofs)
    view = status_view(payment, current.get("status") if current else None)
    return PaymentRead(
        id=payment["id"],
        order_id=payment["order_id"],
        amount=float(payment.get("amount") or 0),
        payment_method=payment.get("method"),
        status=view,
        rejection_reason=payment.get("rejection_reason"),
        verified_at=payment.get("verified_at"),
        current_proof=_proof_read(current, urls.get(current["storage_path"])) if current else None,
        history=[_proof_read(row, urls.get(row["storage_path"])) for row in proofs],
        can_submit=view in ("pending", "rejected"),
    )


def _audit(
    payment: dict[str, Any],
    action: str,
    actor_id: str,
    actor_role: str,
    **details: Any,
) -> None:
    """Catat aksi penting. Kegagalan audit tidak membatalkan aksi bisnis yang
    sudah tersimpan, tetapi selalu tercatat di log server."""
    try:
        supabase_admin.table("payment_audit_logs").insert({
            "payment_id": payment["id"],
            "order_id": payment["order_id"],
            "proof_id": details.get("proof_id"),
            "action": action,
            "actor_id": actor_id,
            "actor_role": actor_role,
            "details": {k: v for k, v in details.items() if k != "proof_id"},
        }).execute()
    except Exception:
        logger.exception("Gagal mencatat audit pembayaran %s (%s)", payment["id"], action)


class PaymentService:
    # ---------------------------------------------------------------- pembacaan

    @staticmethod
    def _order(order_id: str) -> dict[str, Any] | None:
        res = (
            supabase_admin.table("orders")
            .select("*, items:order_items(*), payments(*)")
            .eq("id", order_id)
            .single()
            .execute()
        )
        return res.data or None

    @staticmethod
    def _payment_of_order(order_id: str) -> dict[str, Any] | None:
        res = (
            supabase_admin.table("payments")
            .select("*")
            .eq("order_id", order_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return (res.data or [None])[0]

    @staticmethod
    def get_for_owner(order_id: str, user_id: str) -> PaymentRead:
        """Pembayaran milik `user_id`; pesanan orang lain dilaporkan 404."""
        order = PaymentService._order(order_id)
        if not order or order.get("user_id") != user_id:
            raise _not_found()
        payment = PaymentService._payment_of_order(order_id)
        if not payment:
            raise _not_found()
        try:
            proofs = _proofs_for([payment["id"]]).get(payment["id"], [])
        except Exception as exc:
            if not _is_payment_migration_missing(exc):
                raise
            proofs = []
        urls = _signed_urls([row["storage_path"] for row in proofs])
        return _serialize_payment(payment, proofs, urls)

    @staticmethod
    def list_for_admin(
        page: int, limit: int, status_filter: PaymentStatusView | None, search: str | None
    ) -> tuple[list[PaymentAdminListItem], int]:
        """Daftar pembayaran untuk dashboard admin, filter di database."""
        query = supabase_admin.table("payments").select(
            "*, order:orders!inner(order_number, created_at, status, shipping_address, total)",
            count="exact",
        )
        # `under_review`, `rejected`, ... adalah turunan; di database cukup
        # filter kolom status lalu saring "punya bukti pending" di memori untuk
        # under_review (jumlah baris per halaman kecil).
        if status_filter in ("paid", "expired", "refunded"):
            query = query.eq("status", {"paid": "success"}.get(status_filter, status_filter))
        elif status_filter == "rejected":
            query = query.eq("status", "failed")
        elif status_filter == "pending":
            query = query.eq("status", "pending")

        query = query.order("created_at", desc=True)
        if not search:
            offset = (page - 1) * limit
            query = query.range(offset, offset + limit - 1)
        res = query.execute()
        rows = res.data or []
        total = res.count if res.count is not None else len(rows)

        proofs = _proofs_for([row["id"] for row in rows])
        items: list[PaymentAdminListItem] = []
        for row in rows:
            order = row.get("order") or {}
            current = _current_proof(row, proofs.get(row["id"], []))
            view = status_view(row, current.get("status") if current else None)
            if status_filter and view != status_filter:
                continue
            address = order.get("shipping_address") or {}
            customer = address.get("customer") if isinstance(address, dict) else {}
            items.append(PaymentAdminListItem(
                id=row["id"],
                order_id=row["order_id"],
                order_number=order.get("order_number"),
                customer_name=(customer or {}).get("name") or address.get("recipient_name"),
                order_created_at=order.get("created_at"),
                amount=float(row.get("amount") or 0),
                payment_method=row.get("method"),
                status=view,
                order_status=order.get("status") or "pending",
                proof_uploaded_at=current.get("uploaded_at") if current else None,
            ))

        if search:
            needle = search.lower()
            items = [
                item for item in items
                if needle in (item.order_number or "").lower()
                or needle in (item.customer_name or "").lower()
            ]
            total = len(items)
            start = (page - 1) * limit
            items = items[start:start + limit]

        return items, total

    @staticmethod
    def get_for_admin(payment_id: str) -> PaymentDetailRead:
        res = supabase_admin.table("payments").select("*").eq("id", payment_id).single().execute()
        payment = res.data
        if not payment:
            raise _not_found()
        order = PaymentService._order(payment["order_id"])
        if not order:
            raise _not_found()
        try:
            proofs = _proofs_for([payment["id"]]).get(payment["id"], [])
        except Exception as exc:
            if not _is_payment_migration_missing(exc):
                raise
            proofs = []
        urls = _signed_urls([row["storage_path"] for row in proofs])
        order_payments = order.get("payments") or [payment]
        serialized = _serialize_order(order, order.get("items") or [], order_payments[0])
        return PaymentDetailRead(
            payment=_serialize_payment(payment, proofs, urls),
            order=OrderResponse(**serialized),
            order_status=order.get("status") or "pending",
            buyer={
                "name": serialized.get("customer_name"),
                "email": serialized.get("customer_email"),
                "phone": serialized.get("customer_phone"),
            },
        )

    # ---------------------------------------------------------------- penulisan

    @staticmethod
    def submit_proof(
        order_id: str,
        user_id: str,
        file_bytes: bytes,
        filename: str | None,
        declared_content_type: str | None,
    ) -> PaymentRead:
        """Unggah (atau ganti) bukti pembayaran untuk pesanan milik `user_id`.

        Status akhirnya selalu `pending` (under_review) — tidak pernah `success`.
        """
        order = PaymentService._order(order_id)
        if not order or order.get("user_id") != user_id:
            raise _not_found()

        payment = PaymentService._payment_of_order(order_id)
        if not payment:
            raise _not_found()

        # Bukti `pending` yang masih terbuka berarti admin sedang memeriksa;
        # unggahan kedua hanya akan membuat dua bukti bersaing.
        current_view = status_view(
            payment, "pending" if PaymentService._current_pending_proof(payment) else None
        )
        if current_view == "under_review":
            raise _conflict("Bukti pembayaran sedang diperiksa admin. Tunggu keputusannya.")
        if current_view not in ("pending", "rejected"):
            raise _conflict(
                "Bukti pembayaran tidak dapat dikirim untuk pesanan yang sudah lunas atau kedaluwarsa."
            )

        try:
            content_type, extension = uploads.validate_image(file_bytes, declared_content_type)
        except ValueError as exc:
            code = (
                status.HTTP_413_CONTENT_TOO_LARGE
                if "terlalu besar" in str(exc)
                else status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
            )
            raise PaymentError(str(exc), code) from None

        storage_path = f"orders/{order_id}/{uuid.uuid4().hex}.{extension}"
        bucket = supabase_admin.storage.from_(settings.STORAGE_BUCKET_PAYMENT_PROOFS)
        try:
            bucket.upload(
                path=storage_path,
                file=file_bytes,
                file_options={"content-type": content_type, "upsert": "false"},
            )
        except Exception as exc:
            logger.exception("Gagal mengunggah bukti pembayaran untuk %s", order_id)
            raise PaymentError(
                "Bukti pembayaran gagal disimpan. Pastikan bucket penyimpanan bukti sudah dibuat.",
                status.HTTP_503_SERVICE_UNAVAILABLE,
            ) from exc

        # Bukti lama milik pembayaran yang sama digantikan; riwayat tetap utuh.
        try:
            supabase_admin.table("payment_proofs").update({"status": "superseded"}).eq(
                "payment_id", payment["id"]
            ).eq("status", "pending").execute()
        except Exception:  # noqa: BLE001 - belum ada bukti lama = tidak ada yang diganti
            logger.debug("Tidak ada bukti pending sebelumnya untuk %s", order_id)

        was_rejected = payment.get("status") == "failed"
        try:
            new_proof = supabase_admin.table("payment_proofs").insert({
                "payment_id": payment["id"],
                "order_id": order_id,
                "storage_path": storage_path,
                "original_filename": (filename or "bukti")[:255],
                "content_type": content_type,
                "file_size": len(file_bytes),
                "uploaded_by": user_id,
                "status": "pending",
            }).execute().data[0]
        except APIError as exc:
            if _UNIQUE_VIOLATION in str(exc):
                raise _conflict("Bukti pembayaran lain sedang diperiksa admin.") from None
            raise

        try:
            # Compare-and-set: hanya mengubah baris yang masih boleh menerima bukti.
            updated = (
                supabase_admin.table("payments")
                .update({
                    "status": "pending",
                    "current_proof_id": new_proof["id"],
                    "verified_by": None,
                    "verified_at": None,
                    "rejection_reason": None,
                    "updated_at": datetime.now(UTC).isoformat(),
                })
                .eq("id", payment["id"])
                .in_("status", ["pending", "failed"])
                .execute()
                .data
            )
        except APIError as exc:
            if "42703" in str(exc) or "current_proof_id" in str(exc):
                raise PaymentError(
                    "Kolom verifikasi pembayaran belum tersedia. Jalankan migrasi 20261024_13.",
                    status.HTTP_503_SERVICE_UNAVAILABLE,
                ) from exc
            raise
        if not updated:
            # Balapan dengan admin/penghapusan: buang berkas yatim.
            try:
                bucket.remove([storage_path])
            except Exception:  # noqa: BLE001 - pembersihan terbaik-usaha
                logger.warning("Bukti yatim tidak dapat dihapus: %s", storage_path)
            raise _conflict("Status pembayaran berubah. Muat ulang halaman lalu coba lagi.")

        _audit(
            payment,
            "proof_resubmitted" if was_rejected else "proof_submitted",
            user_id,
            "user",
            proof_id=new_proof["id"],
            filename=new_proof.get("original_filename"),
        )
        return PaymentService.get_for_owner(order_id, user_id)

    @staticmethod
    def approve(payment_id: str, admin_id: str) -> PaymentRead:
        payment = PaymentService._payment(payment_id)
        order_total = PaymentService._order_total(payment["order_id"])
        if abs(float(payment.get("amount") or 0) - order_total) > 0.01:
            raise _conflict(
                "Nominal pembayaran tidak sama dengan total tagihan pesanan. Periksa ulang."
            )

        current = PaymentService._current_pending_proof(payment)
        if not current:
            raise _conflict("Tidak ada bukti pembayaran yang menunggu verifikasi.")

        now = datetime.now(UTC).isoformat()
        # `WHERE status='pending'` = pengaman approve ganda.
        updated = PaymentService._update_payment_decision(payment_id, {
            "status": "success",
            "verified_by": admin_id,
            "verified_at": now,
            "rejection_reason": None,
            "paid_at": now,
            "updated_at": now,
        })
        if not updated:
            raise _conflict("Pembayaran ini sudah diproses. Muat ulang halaman.")

        approved = (
            supabase_admin.table("payment_proofs")
            .update({"status": "approved", "reviewed_by": admin_id, "reviewed_at": now})
            .eq("id", current["id"])
            .eq("status", "pending")
            .execute()
            .data
        )
        if not approved:
            logger.warning("Bukti %s sudah berubah saat approve %s", current["id"], payment_id)

        _audit(
            payment, "payment_approved", admin_id, "admin",
            proof_id=current["id"], amount=float(payment.get("amount") or 0),
        )
        return PaymentService.get_for_admin(payment_id).payment

    @staticmethod
    def reject(payment_id: str, admin_id: str, reason: str) -> PaymentRead:
        reason = reason.strip()
        if len(reason) < 10:
            raise PaymentError("Alasan penolakan minimal 10 karakter.")

        payment = PaymentService._payment(payment_id)
        current = PaymentService._current_pending_proof(payment)
        if not current:
            raise _conflict("Tidak ada bukti pembayaran yang menunggu verifikasi.")

        now = datetime.now(UTC).isoformat()
        updated = PaymentService._update_payment_decision(payment_id, {
            "status": "failed",
            "rejection_reason": reason,
            "verified_by": admin_id,
            "verified_at": now,
            "updated_at": now,
        })
        if not updated:
            raise _conflict("Pembayaran ini sudah diproses. Muat ulang halaman.")

        supabase_admin.table("payment_proofs").update({
            "status": "rejected", "reviewed_by": admin_id, "reviewed_at": now, "review_note": reason,
        }).eq("id", current["id"]).eq("status", "pending").execute()

        _audit(
            payment, "payment_rejected", admin_id, "admin",
            proof_id=current["id"], reason=reason,
        )
        return PaymentService.get_for_admin(payment_id).payment

    # ------------------------------------------------------------------ helpers

    @staticmethod
    def _payment(payment_id: str) -> dict[str, Any]:
        res = supabase_admin.table("payments").select("*").eq("id", payment_id).single().execute()
        if not res.data:
            raise _not_found()
        return res.data

    @staticmethod
    def _order_total(order_id: str) -> float:
        res = supabase_admin.table("orders").select("total").eq("id", order_id).single().execute()
        if not res.data:
            raise _not_found()
        return float(res.data.get("total") or 0)

    @staticmethod
    def _current_pending_proof(payment: dict[str, Any]) -> dict[str, Any] | None:
        """Bukti yang menunggu review: hanya baris berstatus `pending`.

        Tidak memakai `current_proof_id` sebagai syarat — pointer bisa basi;
        unique index parsial menjamin maksimal satu baris `pending`.
        """
        try:
            res = (
                supabase_admin.table("payment_proofs")
                .select("*")
                .eq("payment_id", payment["id"])
                .eq("status", "pending")
                .order("uploaded_at", desc=True)
                .limit(1)
                .execute()
            )
        except Exception as exc:
            if not _is_payment_migration_missing(exc):
                raise
            return None
        return (res.data or [None])[0]

    @staticmethod
    def _update_payment_decision(payment_id: str, data: dict[str, Any]) -> bool:
        """Tulis keputusan admin dengan compare-and-set; `False` bila sudah diproses.

        Jika kolom `verified_*`/`rejection_reason` belum ada (migrasi belum
        dijalankan), pesan menyebut migrasinya alih-alih error 500 mentah.
        """
        try:
            updated = (
                supabase_admin.table("payments")
                .update(data)
                .eq("id", payment_id)
                .eq("status", "pending")
                .execute()
                .data
            )
        except APIError as exc:
            if "42703" in str(exc):
                raise PaymentError(
                    "Kolom verifikasi pembayaran belum tersedia. Jalankan migrasi 20261024_13.",
                    status.HTTP_503_SERVICE_UNAVAILABLE,
                ) from exc
            raise
        return bool(updated)


payment_service = PaymentService()


def http_error(exc: PaymentError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)
