"""Skema pembayaran manual dan bukti pembayaran.

Nilai status di database tetap kosakata CHECK `payments_status_check`
(`pending, success, failed, expired, refunded`). Brief memakai nama lain
(`under_review`, `paid`, `rejected`), jadi API menerjemahkannya:

    pending  + belum ada bukti   -> pending
    pending  + bukti menunggu    -> under_review
    success                      -> paid
    failed                       -> rejected
    expired / refunded           -> expired / refunded

Terjemahan itu satu-satunya tempat: `app.services.payment_service.status_view`.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.order import OrderResponse

#: Status yang dilihat user/admin. Bukan nilai kolom `payments.status`.
PaymentStatusView = Literal[
    "pending", "under_review", "paid", "rejected", "expired", "refunded"
]

#: Status satu baris `payment_proofs`. `superseded` = bukti lama yang digantikan.
PaymentProofStatus = Literal["pending", "approved", "rejected", "superseded"]


class PaymentProofRead(BaseModel):
    id: str
    storage_path: str
    original_filename: str | None = None
    content_type: str
    file_size: int
    status: PaymentProofStatus
    uploaded_at: str | datetime
    reviewed_at: str | datetime | None = None
    review_note: str | None = None
    #: Signed URL berumur pendek; `None` bila gagal dibuat (bucket belum ada).
    url: str | None = None


class PaymentRead(BaseModel):
    id: str
    order_id: str
    amount: float
    payment_method: str | None = None
    status: PaymentStatusView
    rejection_reason: str | None = None
    verified_at: str | datetime | None = None
    current_proof: PaymentProofRead | None = None
    history: list[PaymentProofRead] = []
    #: `true` bila user boleh mengirim (atau mengganti) bukti sekarang.
    can_submit: bool = False


class PaymentAdminListItem(BaseModel):
    id: str
    order_id: str
    order_number: str | None = None
    customer_name: str | None = None
    order_created_at: str | datetime | None = None
    amount: float
    payment_method: str | None = None
    status: PaymentStatusView
    order_status: str
    proof_uploaded_at: str | datetime | None = None


class PaymentDetailRead(BaseModel):
    """Ringkasan pembelian + bukti, supaya admin tidak perlu pindah halaman."""

    payment: PaymentRead
    order: OrderResponse
    order_status: str
    buyer: dict[str, str | None] = {}


class RejectPaymentRequest(BaseModel):
    """Alasan wajib: keputusan admin harus bisa dipertanggungjawabkan ke user."""

    reason: str = Field(min_length=10, max_length=500)
