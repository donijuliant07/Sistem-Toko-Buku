from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import jwt
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core import security
from app.core.security import UserPayload, require_admin
from app.main import app

TEST_SECRET = "test-secret-with-at-least-32-bytes-long"
USER_ID = "00000000-0000-0000-0000-000000000001"

client = TestClient(app)


def make_token(role: str = "user") -> str:
    return jwt.encode(
        {
            "sub": USER_ID,
            "email": "user@example.com",
            "aud": "authenticated",
            "app_metadata": {"role": role},
            "exp": datetime.now(UTC) + timedelta(minutes=5),
        },
        TEST_SECRET,
        algorithm="HS256",
    )


@pytest.fixture
def auth_setup(monkeypatch):
    monkeypatch.setattr(security.settings, "SUPABASE_JWT_SECRET", TEST_SECRET)


@pytest.mark.asyncio
async def test_require_admin_allows_admin():
    admin_user = UserPayload(id=USER_ID, email="admin@example.com", role="admin")
    result = await require_admin(admin_user)
    assert result.id == USER_ID


@pytest.mark.asyncio
async def test_require_admin_rejects_user():
    user_account = UserPayload(id=USER_ID, email="cust@example.com", role="user")
    with pytest.raises(HTTPException) as err:
        await require_admin(user_account)
    assert err.value.status_code == 403


def _call_me(monkeypatch, *, role: str, profile_row: dict):
    """`GET /me` dengan tabel `profiles` di-mock — tidak menyentuh DB sungguhan."""
    async def fake_resolve(user_id: str) -> str:
        return role

    monkeypatch.setattr(security, "resolve_user_role", fake_resolve)

    table = MagicMock()
    table.select.return_value.eq.return_value.single.return_value.execute.return_value.data = profile_row
    admin = MagicMock()
    admin.table.return_value = table

    with patch("app.api.v1.auth.supabase_admin", admin):
        return client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {make_token(role=role)}"},
        )


def test_me_returns_role_nested_inside_data_envelope(auth_setup, monkeypatch):
    """Kontrak `GET /me`: profil ada di dalam `data`, bukan di tingkat atas.

    Klien (`frontend/lib/api.ts` `getCurrentUser`) pernah membaca amplop ini
    langsung sebagai objek profil, sehingga `role` selalu `undefined` dan setiap
    admin diperlakukan sebagai pelanggan di seluruh guard UI. Tes ini mengunci
    bentuk balasannya supaya regresi yang sama tertangkap di sisi backend.
    """
    response = _call_me(
        monkeypatch,
        role="admin",
        profile_row={"id": USER_ID, "role": "admin", "created_at": "2026-10-11T00:00:00Z"},
    )

    assert response.status_code == 200
    body = response.json()

    assert body["sukses"] is True
    assert body["data"]["role"] == "admin"
    # `id`/`email` diambil dari klaim token, bukan dari baris `profiles`.
    assert body["data"]["id"] == USER_ID
    assert body["data"]["email"] == "user@example.com"
    # Penjaga regresi: `role` tidak boleh muncul di tingkat atas amplop.
    assert "role" not in body


def test_me_reports_user_role_for_regular_customer(auth_setup, monkeypatch):
    """Role pelanggan dilaporkan apa adanya — bukan nilai yang di-hardcode."""
    response = _call_me(
        monkeypatch,
        role="user",
        profile_row={"id": USER_ID, "role": "user", "created_at": "2026-10-11T00:00:00Z"},
    )

    assert response.status_code == 200
    assert response.json()["data"]["role"] == "user"
