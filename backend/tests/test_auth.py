from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import UUID

import jwt
import pytest

from app.core import security
from app.db.session import get_db
from app.main import app

TEST_SECRET = "test-secret-with-at-least-32-bytes-long"
TEST_URL = "https://test-project.supabase.co"
USER_ID = UUID("00000000-0000-0000-0000-000000000001")


class FakeResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeSession:
    def __init__(self, value):
        self.value = value

    async def execute(self, _statement):
        return FakeResult(self.value)


def make_token(issuer: str = f"{TEST_URL}/auth/v1") -> str:
    return jwt.encode(
        {
            "sub": str(USER_ID),
            "email": "user@example.com",
            "aud": "authenticated",
            "iss": issuer,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        },
        TEST_SECRET,
        algorithm="HS256",
    )


@pytest.fixture
def auth_setup(monkeypatch):
    monkeypatch.setattr(security.settings, "supabase_jwt_secret", TEST_SECRET)
    monkeypatch.setattr(security.settings, "supabase_url", TEST_URL)

    yield

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_current_user_returns_profile(auth_setup, client):
    profile = SimpleNamespace(id=USER_ID, role="user")
    app.dependency_overrides[get_db] = lambda: FakeSession(profile)

    response = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {make_token()}"})

    assert response.status_code == 200
    assert response.json() == {
        "id": str(USER_ID),
        "email": "user@example.com",
        "role": "user",
    }


@pytest.mark.asyncio
async def test_current_user_returns_404_when_profile_missing(auth_setup, client):
    app.dependency_overrides[get_db] = lambda: FakeSession(None)

    response = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {make_token()}"})

    assert response.status_code == 404
    assert response.json() == {"detail": "Profile not found"}


@pytest.mark.asyncio
async def test_admin_check_allows_admin(auth_setup, client):
    app.dependency_overrides[get_db] = lambda: FakeSession("admin")

    response = await client.get("/api/v1/admin/check", headers={"Authorization": f"Bearer {make_token()}"})

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_admin_check_rejects_non_admin(auth_setup, client):
    app.dependency_overrides[get_db] = lambda: FakeSession("user")

    response = await client.get("/api/v1/admin/check", headers={"Authorization": f"Bearer {make_token()}"})

    assert response.status_code == 403
    assert response.json() == {"detail": "Admin access required"}


@pytest.mark.asyncio
async def test_other_project_token_is_rejected(auth_setup, client):
    app.dependency_overrides[get_db] = lambda: FakeSession(SimpleNamespace(id=USER_ID, role="user"))

    response = await client.get(
        "/api/v1/me",
        headers={"Authorization": f"Bearer {make_token('https://other-project.supabase.co/auth/v1')}"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid or expired token"}
