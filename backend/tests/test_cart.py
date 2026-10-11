"""Regresi untuk keranjang server (poin 8: AUD-13 + AUD-17).

`supabase_admin` di-mock, jadi tes ini tidak pernah menyentuh database nyata.
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.security import UserPayload, get_current_user
from app.main import app
from app.services.cart_service import _is_uuid

client = TestClient(app)

USER_ID = "11111111-1111-1111-1111-111111111111"
OTHER_USER_ID = "22222222-2222-2222-2222-222222222222"
BOOK_ID = "e9f3509c-7def-4bd2-a1de-e4388daf92eb"
OTHER_BOOK_ID = "b1b1b1b1-2222-3333-4444-555555555555"
CART_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"
ITEM_ID = "iiiiiiii-1111-1111-1111-111111111111"

BOOK_ROW = {
    "id": BOOK_ID,
    "title": "Laskar Pelangi",
    "author": "Andrea Hirata",
    "price": 89000,
    "stock": 15,
    "cover_url": "https://example.com/laskar.jpg",
}

# Harga yang sengaja salah, untuk membuktikan client tidak dipercaya.
CLIENT_SUPPLIED_PRICE = 1000


def as_user(user_id: str = USER_ID):
    app.dependency_overrides[get_current_user] = lambda: UserPayload(id=user_id, role="user")


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()


def build_admin(*, item_rows=None, book_rows=None, cart_rows=None, cart_owner=None):
    """Mock `supabase_admin` untuk tabel carts/cart_items/books.

    `cart_items` di-query dengan dua bentuk filter berbeda — `.eq("cart_id", ...)`
    lalu `.order(...)` untuk daftar, dan `.eq("id", ...)` untuk satu item — jadi
    tiap bentuk dapat mock-nya sendiri.
    """
    carts_table = MagicMock()
    cart_items_table = MagicMock()
    books_table = MagicMock()

    carts_table.select.return_value.eq.return_value.execute.return_value.data = (
        [{"id": CART_ID, "user_id": USER_ID}] if cart_rows is None else cart_rows
    )
    carts_table.insert.return_value.execute.return_value.data = [
        {"id": CART_ID, "user_id": USER_ID}
    ]

    rows = [] if item_rows is None else item_rows
    cart_items_table.select.return_value.eq.return_value.order.return_value.execute.return_value.data = rows
    # Satu item diambil lewat id; cart_id di sini adalah pemilik sebenarnya.
    cart_items_table.select.return_value.eq.return_value.execute.return_value.data = [
        {**row, "cart_id": cart_owner or CART_ID} for row in rows
    ]
    cart_items_table.upsert.return_value.execute.return_value.data = []
    cart_items_table.update.return_value.eq.return_value.execute.return_value.data = []
    cart_items_table.delete.return_value.eq.return_value.execute.return_value.data = []

    book_data = [BOOK_ROW] if book_rows is None else book_rows
    books_table.select.return_value.in_.return_value.execute.return_value.data = book_data
    books_table.select.return_value.eq.return_value.execute.return_value.data = book_data

    tables = {"carts": carts_table, "cart_items": cart_items_table, "books": books_table}
    admin = MagicMock()
    admin.table.side_effect = lambda name: tables[name]
    return admin, tables


def test_uuid_guard_rejects_non_uuid_ids():
    """ID dari data mock (non-UUID) tidak boleh lolos ke FK `cart_items.book_id`."""
    assert _is_uuid(BOOK_ID)
    assert not _is_uuid("1")
    assert not _is_uuid("abc")
    assert not _is_uuid(None)


def test_get_cart_uses_price_and_stock_from_books_not_client():
    """AUD-13: harga dan stok keranjang berasal dari `books`."""
    as_user()
    admin, _ = build_admin(item_rows=[{"id": ITEM_ID, "book_id": BOOK_ID, "quantity": 2}])

    with patch("app.services.cart_service.supabase_admin", admin):
        response = client.get("/api/v1/cart")

    assert response.status_code == 200
    item = response.json()["data"]["items"][0]
    assert item["unit_price"] == 89000
    assert item["stock"] == 15
    assert item["subtotal"] == 178000
    assert item["available"] is True


def test_get_cart_is_scoped_to_the_authenticated_user():
    """AUD-17: keranjang diambil lewat `user_id` dari token, bukan dari client."""
    as_user(OTHER_USER_ID)
    admin, tables = build_admin()

    with patch("app.services.cart_service.supabase_admin", admin):
        response = client.get("/api/v1/cart")

    assert response.status_code == 200
    # Filter `.eq("user_id", ...)` memakai id dari token.
    assert tables["carts"].select.return_value.eq.call_args.args == ("user_id", OTHER_USER_ID)


def test_add_item_ignores_client_supplied_price():
    """Harga di body diabaikan total: hanya `book_id` + `quantity` yang dibaca."""
    as_user()
    admin, tables = build_admin(
        item_rows=[{"id": ITEM_ID, "book_id": BOOK_ID, "quantity": 1}]
    )

    with patch("app.services.cart_service.supabase_admin", admin):
        response = client.post(
            "/api/v1/cart/items",
            json={"book_id": BOOK_ID, "quantity": 1, "unit_price": CLIENT_SUPPLIED_PRICE},
        )

    assert response.status_code == 201
    upserted = tables["cart_items"].upsert.call_args.args[0]
    # 1 (yang sudah ada) + 1 (tambahan) = 2, dan tidak ada kolom harga.
    assert upserted == {"cart_id": CART_ID, "book_id": BOOK_ID, "quantity": 2}
    assert "unit_price" not in upserted
    assert "price" not in upserted


def test_add_item_accumulates_quantity_on_existing_row():
    """Menambah buku yang sama menjumlahkan quantity, bukan menimpanya."""
    as_user()
    admin, tables = build_admin(
        item_rows=[{"id": ITEM_ID, "book_id": BOOK_ID, "quantity": 3}]
    )

    with patch("app.services.cart_service.supabase_admin", admin):
        response = client.post("/api/v1/cart/items", json={"book_id": BOOK_ID, "quantity": 2})

    assert response.status_code == 201
    assert tables["cart_items"].upsert.call_args.args[0]["quantity"] == 5
    assert tables["cart_items"].upsert.call_args.kwargs["on_conflict"] == "cart_id,book_id"


def test_add_item_rejects_quantity_above_server_stock():
    """Stok server yang menentukan, bukan angka yang dikirim client."""
    as_user()
    admin, tables = build_admin()

    with patch("app.services.cart_service.supabase_admin", admin):
        response = client.post("/api/v1/cart/items", json={"book_id": BOOK_ID, "quantity": 99})

    assert response.status_code == 400
    assert "tidak mencukupi" in response.json()["detail"]
    tables["cart_items"].upsert.assert_not_called()


def test_add_item_rejects_accumulated_quantity_above_stock():
    """Isi keranjang lama + tambahan baru yang melebihi stok harus ditolak."""
    as_user()
    admin, tables = build_admin(
        item_rows=[{"id": ITEM_ID, "book_id": BOOK_ID, "quantity": 14}]
    )

    with patch("app.services.cart_service.supabase_admin", admin):
        response = client.post("/api/v1/cart/items", json={"book_id": BOOK_ID, "quantity": 2})

    assert response.status_code == 400
    tables["cart_items"].upsert.assert_not_called()


def test_add_item_rejects_unknown_book():
    as_user()
    admin, tables = build_admin(book_rows=[])

    with patch("app.services.cart_service.supabase_admin", admin):
        response = client.post("/api/v1/cart/items", json={"book_id": BOOK_ID, "quantity": 1})

    assert response.status_code == 400
    tables["cart_items"].upsert.assert_not_called()


def test_add_item_rejects_non_uuid_book_id_at_the_schema_boundary():
    """Payload yang jelas rusak ditolak Pydantic/guard, bukan diteruskan ke DB."""
    as_user()
    admin, tables = build_admin()

    with patch("app.services.cart_service.supabase_admin", admin):
        response = client.post("/api/v1/cart/items", json={"book_id": "1", "quantity": 0})

    assert response.status_code == 422
    tables["cart_items"].upsert.assert_not_called()


def test_update_item_rejects_item_from_another_users_cart():
    """Item milik user lain tidak boleh disentuh; kode statusnya sama dengan 'tidak ada'."""
    as_user(OTHER_USER_ID)
    admin, tables = build_admin(
        item_rows=[{"id": ITEM_ID, "book_id": BOOK_ID, "quantity": 2}],
        cart_owner=USER_ID,
    )

    with patch("app.services.cart_service.supabase_admin", admin):
        response = client.patch(f"/api/v1/cart/items/{ITEM_ID}", json={"quantity": 1})

    assert response.status_code == 404
    tables["cart_items"].update.assert_not_called()


def test_remove_item_rejects_item_from_another_users_cart():
    as_user(OTHER_USER_ID)
    admin, tables = build_admin(
        item_rows=[{"id": ITEM_ID, "book_id": BOOK_ID, "quantity": 2}],
        cart_owner=USER_ID,
    )

    with patch("app.services.cart_service.supabase_admin", admin):
        response = client.delete(f"/api/v1/cart/items/{ITEM_ID}")

    assert response.status_code == 404
    tables["cart_items"].delete.assert_not_called()


def test_update_item_uses_server_stock_as_the_upper_bound():
    as_user()
    admin, tables = build_admin(item_rows=[{"id": ITEM_ID, "book_id": BOOK_ID, "quantity": 2}])

    with patch("app.services.cart_service.supabase_admin", admin):
        too_many = client.patch(f"/api/v1/cart/items/{ITEM_ID}", json={"quantity": 50})
        ok = client.patch(f"/api/v1/cart/items/{ITEM_ID}", json={"quantity": 4})

    assert too_many.status_code == 400
    assert ok.status_code == 200
    assert tables["cart_items"].update.call_args.args[0] == {"quantity": 4}


def test_remove_and_clear_delete_only_the_users_own_rows():
    as_user()
    admin, tables = build_admin(item_rows=[{"id": ITEM_ID, "book_id": BOOK_ID, "quantity": 2}])
    delete_eq = tables["cart_items"].delete.return_value.eq

    with patch("app.services.cart_service.supabase_admin", admin):
        removed = client.delete(f"/api/v1/cart/items/{ITEM_ID}")
        cleared = client.delete("/api/v1/cart")

    assert removed.status_code == 200
    assert cleared.status_code == 200
    filters = [call.args for call in delete_eq.call_args_list]
    assert ("id", ITEM_ID) in filters
    # `clear` selalu terikat ke cart milik user, tidak pernah "delete all".
    assert ("cart_id", CART_ID) in filters


def test_merge_clamps_to_stock_and_skips_invalid_rows():
    """Merge keranjang tamu tidak boleh menggagalkan login."""
    as_user()
    admin, tables = build_admin()

    with patch("app.services.cart_service.supabase_admin", admin):
        response = client.post(
            "/api/v1/cart/merge",
            json={"items": [
                {"book_id": "123", "quantity": 1},
                {"book_id": BOOK_ID, "quantity": 5},
            ]},
        )

    assert response.status_code == 200
    # Baris non-UUID dilewati; hanya buku valid yang di-upsert.
    assert tables["cart_items"].upsert.call_count == 1
    assert tables["cart_items"].upsert.call_args.args[0]["book_id"] == BOOK_ID


def test_cart_reports_missing_book_as_unavailable_instead_of_crashing():
    """Buku yang dihapus setelah masuk keranjang ditandai, bukan 500."""
    as_user()
    admin, _ = build_admin(
        item_rows=[{"id": ITEM_ID, "book_id": BOOK_ID, "quantity": 2}],
        book_rows=[],
    )

    with patch("app.services.cart_service.supabase_admin", admin):
        response = client.get("/api/v1/cart")

    assert response.status_code == 200
    item = response.json()["data"]["items"][0]
    assert item["available"] is False
    assert item["unit_price"] == 0


def test_cart_requires_authentication():
    """Tanpa token, keranjang tidak dapat diakses."""
    response = client.get("/api/v1/cart")
    assert response.status_code == 401


def test_cart_rejects_admin_on_every_endpoint():
    """Admin mengelola toko, bukan berbelanja; seluruh endpoint cart ditolak."""
    app.dependency_overrides[get_current_user] = lambda: UserPayload(id=USER_ID, role="admin")
    build_admin()

    requests = [
        client.get("/api/v1/cart"),
        client.post("/api/v1/cart/items", json={"book_id": BOOK_ID, "quantity": 1}),
        client.patch(f"/api/v1/cart/items/{ITEM_ID}", json={"quantity": 2}),
        client.delete(f"/api/v1/cart/items/{ITEM_ID}"),
        client.delete("/api/v1/cart"),
        client.post("/api/v1/cart/merge", json={"items": [{"book_id": BOOK_ID, "quantity": 1}]}),
    ]

    for response in requests:
        assert response.status_code == 403, response.text
