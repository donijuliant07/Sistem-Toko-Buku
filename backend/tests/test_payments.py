"""Verifikasi pembayaran manual: kepemilikan, status, unggah bukti, approve/reject.

Seluruh `supabase_admin` di-mock; tidak ada akses ke database atau Storage nyata.
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.security import UserPayload, get_current_user, require_admin, require_user
from app.main import app
from app.services.payment_service import PaymentService, status_view

client = TestClient(app)

USER_ID = "11111111-1111-1111-1111-111111111111"
OTHER_USER_ID = "22222222-2222-2222-2222-222222222222"
ADMIN_ID = "33333333-3333-3333-3333-333333333333"
ORDER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
PAYMENT_ID = "pppppppp-1111-1111-1111-111111111111"
PROOF_ID = "ffffffff-1111-1111-1111-111111111111"

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def as_user(user_id: str = USER_ID) -> None:
    app.dependency_overrides[require_user] = lambda: UserPayload(id=user_id, role="user")


def as_admin() -> None:
    app.dependency_overrides[require_admin] = lambda: UserPayload(id=ADMIN_ID, role="admin")


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()


def order_row(user_id: str = USER_ID) -> dict:
    return {
        "id": ORDER_ID,
        "order_number": "INV/20261024/0001",
        "user_id": user_id,
        "status": "pending",
        "subtotal": 178000,
        "shipping_cost": 20000,
        "total": 198000,
        "shipping_address": {
            "recipient_name": "Budi Santoso",
            "phone": "081234567890",
            "full_address": "Jl. Merdeka No. 1, Jakarta",
            "customer": {"name": "Budi Santoso", "email": "budi@example.com", "phone": "081234567890"},
        },
        "courier": "JNE",
        "courier_service": "REG",
        "created_at": "2026-10-24T00:00:00Z",
        "updated_at": "2026-10-24T00:00:00Z",
        "items": [],
        "payments": [],
    }


def payment_row(status: str = "pending", **overrides) -> dict:
    return {
        "id": PAYMENT_ID,
        "order_id": ORDER_ID,
        "provider": "manual",
        "method": "Transfer Bank",
        "amount": 198000,
        "status": status,
        "rejection_reason": None,
        "verified_at": None,
        "verified_by": None,
        "current_proof_id": None,
        "created_at": "2026-10-24T00:00:00Z",
        **overrides,
    }


def proof_row(status: str = "pending", **overrides) -> dict:
    return {
        "id": PROOF_ID,
        "payment_id": PAYMENT_ID,
        "order_id": ORDER_ID,
        "storage_path": f"orders/{ORDER_ID}/abc.png",
        "original_filename": "bukti.png",
        "content_type": "image/png",
        "file_size": 128,
        "status": status,
        "uploaded_at": "2026-10-24T00:00:00Z",
        "reviewed_at": None,
        "review_note": None,
        **overrides,
    }


def admin_mock(order: dict | None, payment: dict | None, proofs: list[dict] | None = None):
    """`supabase_admin` palsu untuk satu pesanan + satu pembayaran."""
    admin = MagicMock()
    order = order or {}
    payment = payment or {}
    order = {**order, "payments": [payment] if payment else []}

    orders_table = MagicMock()
    orders_table.select.return_value.eq.return_value.single.return_value.execute.return_value.data = (
        order or None
    )
    payments_table = MagicMock()
    payments_table.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = (
        [payment] if payment else []
    )
    proof_table = MagicMock()
    proof_table.select.return_value.in_.return_value.order.return_value.execute.return_value.data = (
        proofs or []
    )
    audit_table = MagicMock()

    tables = {
        "orders": orders_table,
        "payments": payments_table,
        "payment_proofs": proof_table,
        "payment_audit_logs": audit_table,
        "books": MagicMock(),
    }
    tables["books"].select.return_value.in_.return_value.execute.return_value.data = []
    # Approval/reject membaca ulang baris pembayaran setelah update.
    payments_table.select.return_value.eq.return_value.single.return_value.execute.return_value.data = (
        payment or None
    )
    # Pembacaan bukti yang menunggu (`_current_pending_proof`) memakai rantai
    # berbeda; hanya baris `pending` yang dikembalikan... kecuali `pending`
    # lebih dari satu, yang memang tidak seharusnya terjadi.
    # Pembacaan bukti yang menunggu (`_current_pending_proof`).
    proof_table.select.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = (
        [row for row in (proofs or []) if row["status"] == "pending"][:1]
    )
    admin.table.side_effect = lambda name: tables[name]
    admin.storage.from_.return_value.create_signed_url.return_value = {
        "signedURL": "https://example.com/signed"
    }
    return admin, tables


# ------------------------------------------------------------------ status_view


@pytest.mark.parametrize(
    ("raw", "proof", "expected"),
    [
        ("pending", None, "pending"),
        ("pending", "pending", "under_review"),
        ("pending", "rejected", "pending"),
        ("success", "approved", "paid"),
        ("failed", "rejected", "rejected"),
        ("expired", None, "expired"),
        ("refunded", None, "refunded"),
    ],
)
def test_status_view_maps_db_vocabulary_to_api(raw, proof, expected):
    assert status_view({"status": raw}, proof) == expected


# ------------------------------------------------------------------ akses user


def test_other_users_payment_is_404_not_403():
    as_user(OTHER_USER_ID)
    admin, _ = admin_mock(order_row(USER_ID), payment_row())
    with patch("app.services.payment_service.supabase_admin", admin):
        response = client.get(f"/api/v1/orders/{ORDER_ID}/payment")
    assert response.status_code == 404


def test_owner_sees_payment_instructions_with_amount_from_server():
    as_user()
    admin, _ = admin_mock(order_row(), payment_row())
    with patch("app.services.payment_service.supabase_admin", admin):
        response = client.get(f"/api/v1/orders/{ORDER_ID}/payment")

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["amount"] == 198000
    assert data["status"] == "pending"
    assert data["can_submit"] is True


def test_admin_cannot_use_customer_endpoint():
    """`require_user` menolak admin; endpoint pelanggan bukan jalan pintas."""
    app.dependency_overrides[get_current_user] = lambda: UserPayload(id=ADMIN_ID, role="admin")
    admin, _ = admin_mock(order_row(ADMIN_ID), payment_row())
    with patch("app.services.payment_service.supabase_admin", admin):
        response = client.get(f"/api/v1/orders/{ORDER_ID}/payment")
    assert response.status_code == 403


# ------------------------------------------------------------------ unggah bukti


def test_upload_rejects_non_image_content():
    as_user()
    admin, _ = admin_mock(order_row(), payment_row())
    with patch("app.services.payment_service.supabase_admin", admin):
        response = client.post(
            f"/api/v1/orders/{ORDER_ID}/payment/proof",
            files={"file": ("bukti.png", b"<html>not an image</html>", "image/png")},
        )
    assert response.status_code == 415


def test_upload_rejects_oversized_file():
    as_user()
    admin, _ = admin_mock(order_row(), payment_row())
    with patch("app.services.payment_service.supabase_admin", admin):
        response = client.post(
            f"/api/v1/orders/{ORDER_ID}/payment/proof",
            files={"file": ("bukti.png", PNG_BYTES + b"\x00" * (5 * 1024 * 1024), "image/png")},
        )
    assert response.status_code == 413


def test_upload_sets_under_review_never_paid():
    as_user()
    admin, tables = admin_mock(order_row(), payment_row())
    payments_table = tables["payments"]
    proof_table = tables["payment_proofs"]
    payments_table.update.return_value.eq.return_value.in_.return_value.execute.return_value.data = [
        payment_row()
    ]
    proof_table.insert.return_value.execute.return_value.data = [proof_row()]
    proof_table.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = []

    with patch("app.services.payment_service.supabase_admin", admin):
        response = client.post(
            f"/api/v1/orders/{ORDER_ID}/payment/proof",
            files={"file": ("bukti.png", PNG_BYTES, "image/png")},
        )

    assert response.status_code == 200
    stored = proof_table.insert.call_args.args[0]
    assert stored["status"] == "pending"
    assert stored["storage_path"].startswith(f"orders/{ORDER_ID}/")
    assert stored["storage_path"].endswith(".png")

    # `payments.status` ditulis `pending` — tidak pernah `success`.
    written = payments_table.update.call_args.args[0]
    assert written["status"] == "pending"
    assert written["current_proof_id"] == PROOF_ID
    assert "success" not in written.values()

    # Disimpan di bucket privat lewat backend, bukan URL publik.
    bucket = admin.storage.from_.return_value
    assert bucket.get_public_url.call_count == 0


def test_upload_blocked_while_under_review():
    as_user()
    admin, _ = admin_mock(order_row(), payment_row(), [proof_row("pending")])
    with patch("app.services.payment_service.supabase_admin", admin):
        response = client.post(
            f"/api/v1/orders/{ORDER_ID}/payment/proof",
            files={"file": ("bukti.png", PNG_BYTES, "image/png")},
        )
    assert response.status_code == 409


def test_upload_blocked_after_payment_is_paid():
    as_user()
    admin, _ = admin_mock(order_row(), payment_row("success"), [proof_row("approved")])
    with patch("app.services.payment_service.supabase_admin", admin):
        response = client.post(
            f"/api/v1/orders/{ORDER_ID}/payment/proof",
            files={"file": ("bukti.png", PNG_BYTES, "image/png")},
        )
    assert response.status_code == 409


# ------------------------------------------------------------------ keputusan admin


def test_approve_writes_success_and_never_changes_order_status():
    as_admin()
    admin, tables = admin_mock(order_row(), payment_row(), [proof_row("pending")])
    payments_table = tables["payments"]
    payments_table.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
        payment_row("success")
    ]
    tables["payment_proofs"].update.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
        proof_row("approved")
    ]

    with patch("app.services.payment_service.supabase_admin", admin):
        response = client.post(f"/api/v1/admin/payments/{PAYMENT_ID}/approve")

    assert response.status_code == 200
    written = payments_table.update.call_args.args[0]
    assert written["status"] == "success"
    assert written["verified_by"] == ADMIN_ID
    # Status pesanan bukan tanggung jawab approve.
    tables["orders"].update.assert_not_called()


def test_approve_twice_is_409():
    as_admin()
    admin, tables = admin_mock(order_row(), payment_row(), [proof_row("pending")])
    # Compare-and-set tidak menemukan baris `pending` lagi.
    tables["payments"].update.return_value.eq.return_value.eq.return_value.execute.return_value.data = []

    with patch("app.services.payment_service.supabase_admin", admin):
        response = client.post(f"/api/v1/admin/payments/{PAYMENT_ID}/approve")

    assert response.status_code == 409


def test_approve_requires_a_pending_proof():
    as_admin()
    admin, _ = admin_mock(order_row(), payment_row())
    with patch("app.services.payment_service.supabase_admin", admin):
        response = client.post(f"/api/v1/admin/payments/{PAYMENT_ID}/approve")
    assert response.status_code == 409


def test_approve_rejects_amount_mismatch():
    as_admin()
    payment = payment_row(amount=1000)
    admin, _ = admin_mock(order_row(), payment, [proof_row("pending")])
    with patch("app.services.payment_service.supabase_admin", admin):
        response = client.post(f"/api/v1/admin/payments/{PAYMENT_ID}/approve")
    assert response.status_code == 409


def test_reject_requires_a_meaningful_reason():
    as_admin()
    admin, _ = admin_mock(order_row(), payment_row(), [proof_row("pending")])
    with patch("app.services.payment_service.supabase_admin", admin):
        response = client.post(
            f"/api/v1/admin/payments/{PAYMENT_ID}/reject", json={"reason": "salah"}
        )
    assert response.status_code == 422


def test_reject_stores_reason_and_sets_failed():
    as_admin()
    admin, tables = admin_mock(order_row(), payment_row(), [proof_row("pending")])
    payments_table = tables["payments"]
    payments_table.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
        payment_row("failed")
    ]
    tables["payment_proofs"].update.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
        proof_row("rejected")
    ]
    reason = "Nominal transfer tidak sesuai dengan total pesanan."

    with patch("app.services.payment_service.supabase_admin", admin):
        response = client.post(
            f"/api/v1/admin/payments/{PAYMENT_ID}/reject", json={"reason": reason}
        )

    assert response.status_code == 200
    written = payments_table.update.call_args.args[0]
    assert written["status"] == "failed"
    assert written["rejection_reason"] == reason


def test_reject_then_user_can_upload_again():
    admin, tables = admin_mock(order_row(), payment_row("failed", rejection_reason="Bukti buram."))
    payments_table = tables["payments"]
    payments_table.update.return_value.eq.return_value.in_.return_value.execute.return_value.data = [
        payment_row()
    ]
    tables["payment_proofs"].insert.return_value.execute.return_value.data = [proof_row()]
    # Setelah unggahan, pembacaan ulang melihat baris `pending` + bukti baru.
    payments_table.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = [
        payment_row()
    ]
    tables["payment_proofs"].select.return_value.in_.return_value.order.return_value.execute.return_value.data = [
        proof_row()
    ]

    with patch("app.services.payment_service.supabase_admin", admin):
        result = PaymentService().submit_proof(ORDER_ID, USER_ID, PNG_BYTES, "bukti2.png", "image/png")

    assert result.status == "under_review"
    # Alasan penolakan lama dibersihkan saat bukti baru dikirim.
    written = payments_table.update.call_args.args[0]
    assert written["rejection_reason"] is None
