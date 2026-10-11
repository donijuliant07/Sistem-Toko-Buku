"""Unit tests for the promo CRUD added with the `promos` table.

`supabase_admin` is mocked, so these never touch the live database.
"""

from datetime import date, timedelta
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.security import get_current_user, require_admin, UserPayload
from app.main import app
from app.schemas.promo import PromoCreate, PromoUpdate
from app.services.promo_service import _serialize

client = TestClient(app)

STAFF_ID = "33333333-3333-3333-3333-333333333333"
PROMO_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
TODAY = date.today()


def as_staff() -> None:
    app.dependency_overrides[require_admin] = lambda: UserPayload(id=STAFF_ID, role="admin")


def as_customer() -> None:
    app.dependency_overrides[get_current_user] = lambda: UserPayload(id=STAFF_ID, role="user")


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()


def promo_row(**overrides):
    row = {
        "id": PROMO_ID,
        "code": "LITERASI10",
        "name": "Pesta Literasi",
        "discount_type": "Persentase",
        "discount_value": "20.00",
        "min_purchase": "100000.00",
        "max_discount": "40000.00",
        "quota": 500,
        "used_count": 0,
        "is_active": True,
        "start_date": TODAY.isoformat(),
        "end_date": (TODAY + timedelta(days=5)).isoformat(),
        "created_at": "2026-10-01T00:00:00+00:00",
        "updated_at": "2026-10-01T00:00:00+00:00",
    }
    row.update(overrides)
    return row


# --- derived status (AUD: status must not be a stored, staleable column) -----


def test_status_is_derived_from_active_flag_and_dates():
    assert _serialize(promo_row())["status"] == "Aktif"
    assert _serialize(promo_row(is_active=False))["status"] == "Nonaktif"
    assert _serialize(promo_row(start_date=(TODAY + timedelta(days=3)).isoformat()))["status"] == "Jadwal"
    assert _serialize(promo_row(end_date=(TODAY - timedelta(days=1)).isoformat()))["status"] == "Kadaluarsa"


def test_inactive_wins_over_dates():
    """A promo that is off but still inside its window must read as Nonaktif."""
    row = promo_row(is_active=False)
    assert _serialize(row)["status"] == "Nonaktif"


def test_numeric_strings_become_numbers():
    """PostgREST returns numeric columns as strings; the API must not leak them."""
    parsed = _serialize(promo_row())
    assert parsed["discount_value"] == 20.0
    assert parsed["min_purchase"] == 100000.0
    assert parsed["max_discount"] == 40000.0


def test_null_max_discount_stays_none():
    assert _serialize(promo_row(max_discount=None))["max_discount"] is None


# --- validation -------------------------------------------------------------


def test_rejects_end_date_before_start_date():
    with pytest.raises(ValueError):
        PromoCreate(
            code="X1",
            name="Promo Salah",
            discount_type="Persentase",
            discount_value=10,
            start_date=TODAY,
            end_date=TODAY - timedelta(days=1),
        )


def test_rejects_percentage_above_100():
    with pytest.raises(ValueError):
        PromoCreate(
            code="X2",
            name="Promo Berlebih",
            discount_type="Persentase",
            discount_value=120,
            start_date=TODAY,
            end_date=TODAY,
        )


def test_code_is_normalized_to_uppercase():
    payload = PromoCreate(
        code=" literasi10 ",
        name="Pesta Literasi",
        discount_type="Persentase",
        discount_value=20,
        start_date=TODAY,
        end_date=TODAY,
    )
    assert payload.code == "LITERASI10"


def test_update_allows_partial_payload():
    payload = PromoUpdate(is_active=False)
    assert payload.model_dump(exclude_unset=True) == {"is_active": False}


# --- endpoints --------------------------------------------------------------


def test_staff_can_list_promos():
    as_staff()
    fake = MagicMock()
    fake.execute.return_value = MagicMock(data=[promo_row()])
    with patch("app.services.promo_service.supabase_admin") as sb:
        sb.table.return_value.select.return_value.order.return_value = fake
        res = client.get("/api/v1/promos")

    assert res.status_code == 200
    body = res.json()
    assert body["sukses"] is True
    assert body["data"][0]["code"] == "LITERASI10"
    assert body["data"][0]["status"] == "Aktif"


def test_customer_cannot_list_promos():
    """Promo CRUD is staff/admin only; a customer token must be rejected."""
    as_customer()
    res = client.get("/api/v1/promos")
    assert res.status_code in (401, 403)


def test_duplicate_promo_code_returns_400():
    as_staff()
    payload = {
        "code": "LITERASI10",
        "name": "Duplikat",
        "discount_type": "Persentase",
        "discount_value": 20,
        "start_date": TODAY.isoformat(),
        "end_date": TODAY.isoformat(),
    }
    with patch("app.services.promo_service.supabase_admin") as sb:
        sb.table.return_value.insert.return_value.execute.side_effect = Exception(
            "duplicate key value violates unique constraint \"uq_promos_code\""
        )
        res = client.post("/api/v1/promos", json=payload)

    assert res.status_code == 400
    assert "uq_promos_code" in res.json()["detail"]


def test_patch_missing_promo_returns_404():
    as_staff()
    with patch("app.services.promo_service.supabase_admin") as sb:
        sb.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
        res = client.patch(f"/api/v1/promos/{PROMO_ID}", json={"is_active": False})

    assert res.status_code == 404


def test_patch_swapping_dates_that_invert_the_range_is_rejected():
    """Patching only `start_date` past the stored `end_date` must not be written."""
    as_staff()
    with patch("app.services.promo_service.supabase_admin") as sb:
        sb.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[promo_row(end_date=(TODAY + timedelta(days=1)).isoformat())]
        )
        res = client.patch(
            f"/api/v1/promos/{PROMO_ID}",
            json={"start_date": (TODAY + timedelta(days=10)).isoformat()},
        )

    assert res.status_code == 400  # invalid date range after patch
    assert "berakhir" in res.json()["detail"]
