"""Audit regressions for the checkout -> order flow against the live Supabase schema.

The tests mock `supabase_admin`, so they never touch a real database.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

from app.main import app
from app.core.security import get_current_user, require_admin, UserPayload
from app.core.shipping import SHIPPING_OPTIONS
from app.schemas.order import OrderCreate
from app.services.order_service import _serialize_order

client = TestClient(app)

USER_ID = "11111111-1111-1111-1111-111111111111"
OTHER_USER_ID = "22222222-2222-2222-2222-222222222222"
ADMIN_ID = "33333333-3333-3333-3333-333333333333"
BOOK_ID = "e9f3509c-7def-4bd2-a1de-e4388daf92eb"
ORDER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

BOOK_ROW = {
    "id": BOOK_ID,
    "title": "Laskar Pelangi",
    "author": "Andrea Hirata",
    "price": 89000,
    "weight_gram": 300,
    "stock": 15,
}


def as_user(user_id: str = USER_ID):
    app.dependency_overrides[get_current_user] = lambda: UserPayload(id=user_id, role="user")


def as_admin():
    app.dependency_overrides[require_admin] = lambda: UserPayload(id=USER_ID, role="admin")


def as_admin_with_user_dependency():
    """Admin yang lolos `get_current_user` juga — untuk endpoint pengelolaan pesanan."""
    admin = UserPayload(id=ADMIN_ID, role="admin")
    app.dependency_overrides[get_current_user] = lambda: admin
    app.dependency_overrides[require_admin] = lambda: admin


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()


def legacy_order_payload() -> dict:
    """What the current checkout page sends."""
    return {
        "customer_name": "Budi Santoso",
        "customer_email": "budi@example.com",
        "customer_phone": "081234567890",
        "shipping_address": "Jl. Merdeka No. 1, Jakarta",
        "shipping_option_id": "jne-reg",
        "payment_method": "Transfer Bank",
        "items": [
            {
                "book_id": BOOK_ID,
                "quantity": 2,
            }
        ],
    }


def order_rows_response():
    """Rows as the live `orders` table returns them, plus joined items/payments."""
    return {
        "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "order_number": "INV/20261010/1234",
        "user_id": USER_ID,
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
        "tracking_number": None,
        "created_at": "2026-10-10T00:00:00Z",
        "updated_at": "2026-10-10T00:00:00Z",
        "items": [
            {
                "id": "iiiiiiii-1111-1111-1111-111111111111",
                "order_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                "book_id": BOOK_ID,
                "title_snapshot": "Laskar Pelangi",
                "quantity": 2,
                "price": 89000,
                "weight_gram": 300,
            }
        ],
        "payments": [
            {
                "id": "pppppppp-1111-1111-1111-111111111111",
                "order_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                "provider": "manual",
                "method": "Transfer Bank",
                "amount": 198000,
                "status": "pending",
            }
        ],
    }


def serialized_order(**overrides) -> dict:
    row = {**order_rows_response(), **overrides}
    # `_serialize_order` akan memanggil tabel `books`; mock di dalamnya.
    book_admin = MagicMock()
    book_admin.table.return_value.select.return_value.in_.return_value.execute.return_value.data = [
        {"id": BOOK_ID, "author": "Andrea Hirata", "cover_url": "https://example.com/cover.jpg"}
    ]
    with patch("app.services.order_service.supabase_admin", book_admin):
        return _serialize_order(row, row["items"], row["payments"][0])


def test_order_create_ignores_client_supplied_shipping_fields():
    """Client tidak boleh menentukan kurir atau ongkir."""
    payload = {
        **legacy_order_payload(),
        "courier": "GRATIS ONGKIR",
        "courier_service": "GRATIS",
        "shipping_fee": 0,
    }
    parsed = OrderCreate.model_validate(payload)

    assert parsed.shipping_option_id == "jne-reg"
    assert parsed.shipping_fee == 0
    assert not hasattr(parsed, "courier")


def test_create_order_is_bound_to_the_authenticated_user_and_ignores_client_price():
    as_user()
    orders_table = MagicMock()
    books_table = MagicMock()
    payments_table = MagicMock()
    order_items_table = MagicMock()

    books_table.select.return_value.in_.return_value.execute.return_value.data = [BOOK_ROW]
    books_table.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {"stock": 15}
    orders_table.insert.return_value.execute.return_value.data = [
        {**order_rows_response(), "items": [], "payments": []}
    ]
    order_items_table.insert.return_value.execute.return_value.data = []
    payments_table.insert.return_value.execute.return_value.data = []

    tables = {"orders": orders_table, "books": books_table, "payments": payments_table, "order_items": order_items_table}
    admin = MagicMock()
    admin.table.side_effect = lambda name: tables[name]

    with patch("app.services.order_service.supabase_admin", admin), patch(
        "app.services.order_service.OrderService.get_by_id", return_value=serialized_order()
    ):
        response = client.post("/api/v1/orders", json=legacy_order_payload())

    assert response.status_code == 201
    inserted = orders_table.insert.call_args.args[0]
    assert inserted["user_id"] == USER_ID
    # Harga dari server, bukan yang dikirim client.
    assert inserted["subtotal"] == 178000
    assert inserted["shipping_cost"] == 20000
    assert inserted["total"] == 198000
    # Kolom yang tidak ada di skema live tidak boleh dikirim.
    assert "customer_id" not in inserted
    assert "total_amount" not in inserted
    assert "payment_status" not in inserted
    assert inserted["shipping_address"]["full_address"] == "Jl. Merdeka No. 1, Jakarta"
    # Stok dipotong saat pesanan dibuat: 15 - 2.
    assert books_table.update.call_args.args[0] == {"stock": 13}


def test_create_order_clamps_total_at_zero():
    as_user()
    payload = {**legacy_order_payload(), "shipping_fee": -1}

    orders_table = MagicMock()
    books_table = MagicMock()
    books_table.select.return_value.in_.return_value.execute.return_value.data = [BOOK_ROW]
    books_table.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {"stock": 15}
    orders_table.insert.return_value.execute.return_value.data = [
        {**order_rows_response(), "items": [], "payments": []}
    ]

    tables = {"orders": orders_table, "books": books_table, "payments": MagicMock(), "order_items": MagicMock()}
    admin = MagicMock()
    admin.table.side_effect = lambda name: tables[name]

    with patch("app.services.order_service.supabase_admin", admin), patch(
        "app.services.order_service.OrderService.get_by_id", return_value=serialized_order()
    ):
        response = client.post("/api/v1/orders", json=payload)

    assert response.status_code == 422


def test_shipping_options_come_from_the_server_and_are_public():
    response = client.get("/api/v1/shipping-options")

    assert response.status_code == 200
    options = response.json()["data"]
    ids = {option["id"] for option in options}
    assert "jne-reg" in ids
    assert all({"id", "courier", "service", "fee"} == set(option) for option in options)


def test_checked_out_shipping_option_ids_are_all_offered_by_the_endpoint():
    """Id yang diterima `create()` harus muncul di daftar, kalau tidak UI menawarkan tarif mati."""
    offered = {option["id"] for option in client.get("/api/v1/shipping-options").json()["data"]}

    assert offered == set(SHIPPING_OPTIONS)


def test_expire_overdue_orders_cancels_pending_and_returns_stock():
    as_admin()
    orders_table = MagicMock()
    books_table = MagicMock()
    items_table = MagicMock()

    orders_table.select.return_value.eq.return_value.lt.return_value.execute.return_value.data = [
        {"id": ORDER_ID}
    ]
    items_table.select.return_value.eq.return_value.execute.return_value.data = [
        {"book_id": BOOK_ID, "quantity": 2}
    ]
    books_table.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {"stock": 10}

    tables = {"orders": orders_table, "books": books_table, "payments": MagicMock(), "order_items": items_table}
    admin = MagicMock()
    admin.table.side_effect = lambda name: tables[name]

    with patch("app.services.order_service.supabase_admin", admin):
        response = client.post("/api/v1/orders/expire-overdue")

    assert response.status_code == 200
    assert response.json()["data"]["expired_order_ids"] == [ORDER_ID]
    assert orders_table.update.call_args.args[0] == {"status": "expired"}
    assert books_table.update.call_args.args[0] == {"stock": 12}


def test_expire_overdue_orders_requires_admin():
    response = client.post("/api/v1/orders/expire-overdue")
    assert response.status_code in (401, 403)


def test_expire_overdue_orders_is_a_noop_when_nothing_is_overdue():
    as_admin()
    orders_table = MagicMock()
    orders_table.select.return_value.eq.return_value.lt.return_value.execute.return_value.data = []

    admin = MagicMock()
    admin.table.side_effect = lambda name: {"orders": orders_table}[name]

    with patch("app.services.order_service.supabase_admin", admin):
        response = client.post("/api/v1/orders/expire-overdue")

    assert response.status_code == 200
    assert response.json()["data"]["expired_order_ids"] == []
    orders_table.update.assert_not_called()


def test_order_create_rejects_a_client_supplied_shipping_fee():
    as_user()
    orders_table = MagicMock()
    books_table = MagicMock()
    books_table.select.return_value.in_.return_value.execute.return_value.data = [BOOK_ROW]

    admin = MagicMock()
    admin.table.side_effect = lambda name: {"orders": orders_table, "books": books_table}[name]

    with patch("app.services.order_service.supabase_admin", admin):
        response = client.post(
            "/api/v1/orders", json={**legacy_order_payload(), "shipping_fee": 1}
        )

    assert response.status_code == 400
    assert "Ongkos kirim" in response.json()["detail"]
    orders_table.insert.assert_not_called()


def test_create_order_retries_when_the_order_number_collides():
    """`orders.order_number` UNIQUE di DB live: bentrok harus dicoba ulang, bukan 500."""
    as_user()
    orders_table = MagicMock()
    books_table = MagicMock()
    items_table = MagicMock()
    books_table.select.return_value.in_.return_value.execute.return_value.data = [BOOK_ROW]
    books_table.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {"stock": 15}

    conflict = Exception('duplicate key value violates unique constraint "orders_order_number_key"')
    conflict.code = "23505"
    orders_table.insert.return_value.execute.side_effect = [
        conflict,
        MagicMock(data=[{**order_rows_response(), "items": [], "payments": []}]),
    ]

    tables = {"orders": orders_table, "books": books_table, "payments": MagicMock(), "order_items": items_table}
    admin = MagicMock()
    admin.table.side_effect = lambda name: tables[name]

    with patch("app.services.order_service.supabase_admin", admin), patch(
        "app.services.order_service.OrderService.get_by_id", return_value=serialized_order()
    ):
        response = client.post("/api/v1/orders", json=legacy_order_payload())

    assert response.status_code == 201
    assert orders_table.insert.call_count == 2
    first, _second = (call.args[0]["order_number"] for call in orders_table.insert.call_args_list)
    assert first.startswith("INV/")


def test_create_order_gives_up_after_repeated_order_number_collisions():
    as_user()
    orders_table = MagicMock()
    books_table = MagicMock()
    books_table.select.return_value.in_.return_value.execute.return_value.data = [BOOK_ROW]
    books_table.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {"stock": 15}

    conflict = Exception('duplicate key value violates unique constraint "orders_order_number_key"')
    conflict.code = "23505"
    orders_table.insert.return_value.execute.side_effect = conflict

    admin = MagicMock()
    admin.table.side_effect = lambda name: {"orders": orders_table, "books": books_table}[name]

    with patch("app.services.order_service.supabase_admin", admin):
        response = client.post("/api/v1/orders", json=legacy_order_payload())

    assert response.status_code == 400
    assert "unik" in response.json()["detail"].lower()
    assert orders_table.insert.call_count == 5


def test_create_order_does_not_retry_unrelated_database_errors():
    as_user()
    orders_table = MagicMock()
    books_table = MagicMock()
    books_table.select.return_value.in_.return_value.execute.return_value.data = [BOOK_ROW]

    orders_table.insert.return_value.execute.side_effect = Exception("permission denied")

    admin = MagicMock()
    admin.table.side_effect = lambda name: {"orders": orders_table, "books": books_table}[name]

    with patch("app.services.order_service.supabase_admin", admin):
        response = client.post("/api/v1/orders", json=legacy_order_payload())

    assert response.status_code == 400
    assert orders_table.insert.call_count == 1


def test_create_order_rejects_a_client_supplied_discount_or_promo():
    as_user()
    orders_table = MagicMock()
    books_table = MagicMock()
    books_table.select.return_value.in_.return_value.execute.return_value.data = [BOOK_ROW]

    admin = MagicMock()
    admin.table.side_effect = lambda name: {"orders": orders_table, "books": books_table}[name]

    with patch("app.services.order_service.supabase_admin", admin):
        discounted = client.post(
            "/api/v1/orders", json={**legacy_order_payload(), "discount_amount": 198000}
        )
        promo = client.post(
            "/api/v1/orders", json={**legacy_order_payload(), "promo_code": "GRATIS"}
        )

    assert discounted.status_code == 400
    assert promo.status_code == 400
    assert "promo" in discounted.json()["detail"].lower()
    orders_table.insert.assert_not_called()


def test_create_order_rejects_an_unknown_shipping_option():
    as_user()
    orders_table = MagicMock()
    books_table = MagicMock()
    books_table.select.return_value.in_.return_value.execute.return_value.data = [BOOK_ROW]

    admin = MagicMock()
    admin.table.side_effect = lambda name: {"orders": orders_table, "books": books_table}[name]

    with patch("app.services.order_service.supabase_admin", admin):
        response = client.post(
            "/api/v1/orders", json={**legacy_order_payload(), "shipping_option_id": "promo-gratis"}
        )

    assert response.status_code == 400
    assert "Tidak" in response.json()["detail"] or "tidak" in response.json()["detail"]
    orders_table.insert.assert_not_called()


def test_create_order_aggregates_duplicate_book_lines_before_checking_stock():
    """Dua baris buku yang sama harus digabung, bukan dicek stoknya satu per satu."""
    as_user()
    payload = legacy_order_payload()
    payload["items"] = [
        {"book_id": BOOK_ID, "quantity": 5},
        {"book_id": BOOK_ID, "quantity": 5},
    ]

    orders_table = MagicMock()
    books_table = MagicMock()
    books_table.select.return_value.in_.return_value.execute.return_value.data = [{**BOOK_ROW, "stock": 8}]

    admin = MagicMock()
    admin.table.side_effect = lambda name: {"orders": orders_table, "books": books_table}[name]

    with patch("app.services.order_service.supabase_admin", admin):
        response = client.post("/api/v1/orders", json=payload)

    assert response.status_code == 400
    assert "Stok" in response.json()["detail"]
    orders_table.insert.assert_not_called()


def test_create_order_deletes_the_order_when_items_fail():
    """Kegagalan setelah `orders` ter-insert tidak boleh meninggalkan pesanan orphan."""
    as_user()
    orders_table = MagicMock()
    books_table = MagicMock()
    items_table = MagicMock()
    books_table.select.return_value.in_.return_value.execute.return_value.data = [BOOK_ROW]
    orders_table.insert.return_value.execute.return_value.data = [
        {**order_rows_response(), "items": [], "payments": []}
    ]
    items_table.insert.return_value.execute.side_effect = RuntimeError("db down")

    tables = {"orders": orders_table, "books": books_table, "payments": MagicMock(), "order_items": items_table}
    admin = MagicMock()
    admin.table.side_effect = lambda name: tables[name]

    with patch("app.services.order_service.supabase_admin", admin):
        response = client.post("/api/v1/orders", json=legacy_order_payload())

    assert response.status_code == 400
    orders_table.delete.return_value.eq.return_value.execute.assert_called_once()
    # Stok tidak boleh tersentuh karena item gagal disimpan.
    books_table.update.assert_not_called()


def test_create_order_requires_authentication():
    response = client.post("/api/v1/orders", json=legacy_order_payload())
    assert response.status_code == 401


def test_create_order_rejects_insufficient_stock():
    as_user()
    orders_table = MagicMock()
    books_table = MagicMock()
    books_table.select.return_value.in_.return_value.execute.return_value.data = [{**BOOK_ROW, "stock": 1}]

    admin = MagicMock()
    admin.table.side_effect = lambda name: {"orders": orders_table, "books": books_table}[name]

    with patch("app.services.order_service.supabase_admin", admin):
        response = client.post("/api/v1/orders", json=legacy_order_payload())

    assert response.status_code == 400
    assert "Stok" in response.json()["detail"]
    orders_table.insert.assert_not_called()


def test_order_detail_hides_another_users_order():
    """Pesanan milik user lain dilaporkan 404 agar keberadaannya tidak bocor."""
    as_user(OTHER_USER_ID)
    with patch("app.services.order_service.OrderService.get_by_id", return_value=serialized_order()):
        response = client.get("/api/v1/orders/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    assert response.status_code == 404


def test_order_detail_allows_the_owner():
    as_user()
    with patch("app.services.order_service.OrderService.get_by_id", return_value=serialized_order()):
        response = client.get("/api/v1/orders/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["user_id"] == USER_ID
    assert data["total_amount"] == 198000
    assert data["payment_status"] == "pending"
    assert data["items"][0]["unit_price"] == 89000
    assert data["items"][0]["total_price"] == 178000


def test_payment_status_cannot_be_set_by_a_customer():
    as_user()
    response = client.patch(
        "/api/v1/orders/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/payment",
        json={"status": "success"},
    )
    assert response.status_code == 403


def test_payment_status_is_set_independently_of_order_status():
    as_admin()
    payments_table = MagicMock()
    payments_table.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = [
        {"id": "pppppppp-1111-1111-1111-111111111111", "status": "pending"}
    ]
    admin = MagicMock()
    admin.table.side_effect = lambda name: {"payments": payments_table}[name]

    with patch("app.services.order_service.supabase_admin", admin):
        response = client.patch(
            "/api/v1/orders/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/payment",
            json={"status": "success"},
        )

    assert response.status_code == 200
    update_payload = payments_table.update.call_args.args[0]
    assert update_payload["status"] == "success"
    assert "paid_at" in update_payload


def test_update_status_returns_stock_once_when_cancelled():
    as_admin()
    orders_table = MagicMock()
    books_table = MagicMock()
    items_table = MagicMock()

    items_table.select.return_value.eq.return_value.execute.return_value.data = [
        {"book_id": BOOK_ID, "quantity": 2}
    ]
    books_table.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {"stock": 10}

    tables = {"orders": orders_table, "books": books_table, "payments": MagicMock(), "order_items": items_table}
    admin = MagicMock()
    admin.table.side_effect = lambda name: tables[name]
    current = {**order_rows_response(), "status": "pending"}

    with patch("app.services.order_service.supabase_admin", admin), patch(
        "app.services.order_service.OrderService.get_by_id", return_value=serialized_order(**current)
    ):
        response = client.patch(
            "/api/v1/orders/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/status",
            json={"status": "cancelled"},
        )

    assert response.status_code == 200
    # Stok selalu dikembalikan saat dibatalkan, tergantung status sebelumnya.
    assert books_table.update.call_args.args[0] == {"stock": 12}

    # Pembatalan kedua tidak boleh menambah stok lagi (idempotent).
    books_table.update.reset_mock()
    current["status"] = "cancelled"
    with patch("app.services.order_service.supabase_admin", admin), patch(
        "app.services.order_service.OrderService.get_by_id", return_value=serialized_order(**current)
    ):
        client.patch(
            "/api/v1/orders/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/status",
            json={"status": "cancelled"},
        )

    books_table.update.assert_not_called()


# --- Pemisahan hak akses admin/user (RBAC) ---


def test_create_order_rejects_admin():
    """Admin tidak boleh checkout dengan akunnya; harus pakai akun pelanggan."""
    admin = UserPayload(id=ADMIN_ID, role="admin")
    app.dependency_overrides[get_current_user] = lambda: admin

    response = client.post("/api/v1/orders", json=legacy_order_payload())

    assert response.status_code == 403


def test_create_order_rejects_guest():
    response = client.post("/api/v1/orders", json=legacy_order_payload())
    assert response.status_code == 401


def test_update_order_status_rejects_user():
    as_user()
    response = client.patch(
        f"/api/v1/orders/{ORDER_ID}/status",
        json={"status": "cancelled"},
    )
    assert response.status_code == 403


def test_update_payment_status_rejects_user():
    as_user()
    response = client.patch(
        f"/api/v1/orders/{ORDER_ID}/payment",
        json={"status": "success"},
    )
    assert response.status_code == 403


def test_expire_overdue_rejects_user():
    as_user()
    response = client.post("/api/v1/orders/expire-overdue")
    assert response.status_code == 403


def test_list_orders_is_scoped_to_the_authenticated_user():
    """Pelanggan hanya melihat pesanannya sendiri; admin melihat semua."""
    captured: dict = {}

    def fake_get_list(**kwargs):
        captured.update(kwargs)
        return [], 0

    as_user()
    with patch("app.api.v1.orders.order_service.get_list", side_effect=fake_get_list):
        response = client.get("/api/v1/orders")

    assert response.status_code == 200
    assert captured["user_id"] == USER_ID

    captured.clear()
    as_admin_with_user_dependency()
    with patch("app.api.v1.orders.order_service.get_list", side_effect=fake_get_list):
        response = client.get("/api/v1/orders")

    assert response.status_code == 200
    assert captured["user_id"] is None


def test_get_order_detail_rejects_another_users_order():
    """Pesanan milik user lain tidak dapat dibuka — 404, bukan data bocor."""
    other_order = order_rows_response()
    other_order["user_id"] = OTHER_USER_ID

    as_user()
    with patch(
        "app.api.v1.orders.order_service.get_by_id",
        return_value=_serialize_order(other_order),
    ):
        response = client.get(f"/api/v1/orders/{ORDER_ID}")

    assert response.status_code == 404


def test_get_order_detail_allows_admin_to_read_any_order():
    other_order = order_rows_response()
    other_order["user_id"] = OTHER_USER_ID

    as_admin_with_user_dependency()
    with patch(
        "app.api.v1.orders.order_service.get_by_id",
        return_value=_serialize_order(other_order),
    ):
        response = client.get(f"/api/v1/orders/{ORDER_ID}")

    assert response.status_code == 200
