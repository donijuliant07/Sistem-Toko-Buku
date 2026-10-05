import jwt
import pytest
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.core import security
from app.core.security import get_current_user, require_admin, UserPayload

TEST_SECRET = "test-secret-with-at-least-32-bytes-long"


@pytest.fixture
def jwt_secret(monkeypatch):
    monkeypatch.setattr(security.settings, "SUPABASE_JWT_SECRET", TEST_SECRET)


def make_token(**claims: object) -> str:
    claims.setdefault("aud", "authenticated")
    claims.setdefault("sub", "user-123")
    claims.setdefault("exp", datetime.now(timezone.utc) + timedelta(minutes=5))
    return jwt.encode(claims, TEST_SECRET, algorithm="HS256")


@pytest.mark.asyncio
async def test_get_current_user_accepts_valid_token(jwt_secret):
    token = make_token(sub="user-123", email="user@example.com")
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    user = await get_current_user(credentials)
    assert user.id == "user-123"
    assert user.email == "user@example.com"


@pytest.mark.asyncio
async def test_get_current_user_rejects_expired_token(jwt_secret):
    token = make_token(exp=datetime.now(timezone.utc) - timedelta(minutes=5))
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with pytest.raises(HTTPException) as error:
        await get_current_user(credentials)

    assert error.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_rejects_missing_credentials():
    with pytest.raises(HTTPException) as error:
        await get_current_user(None)

    assert error.value.status_code == 401
