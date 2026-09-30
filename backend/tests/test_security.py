from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.core import security

TEST_SECRET = "test-secret-with-at-least-32-bytes-long"
TEST_ISSUER = "https://test-project.supabase.co/auth/v1"


@pytest.fixture
def jwt_secret(monkeypatch):
    monkeypatch.setattr(security.settings, "supabase_jwt_secret", TEST_SECRET)
    monkeypatch.setattr(security.settings, "supabase_url", "https://test-project.supabase.co")


def make_token(**claims: object) -> str:
    claims.setdefault("iss", TEST_ISSUER)
    return jwt.encode(claims, TEST_SECRET, algorithm="HS256")


@pytest.mark.asyncio
async def test_verify_supabase_token_accepts_valid_token(jwt_secret):
    token = make_token(
        sub="user-123",
        email="user@example.com",
        aud="authenticated",
        exp=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    payload = await security.verify_supabase_token(credentials)

    assert payload["sub"] == "user-123"
    assert payload["email"] == "user@example.com"
    assert payload["aud"] == "authenticated"


@pytest.mark.asyncio
async def test_verify_supabase_token_rejects_expired_token(jwt_secret):
    token = make_token(
        sub="user-123",
        aud="authenticated",
        exp=datetime.now(timezone.utc) - timedelta(minutes=5),
    )
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with pytest.raises(HTTPException) as error:
        await security.verify_supabase_token(credentials)

    assert error.value.status_code == 401
    assert error.value.detail == "Invalid or expired token"


@pytest.mark.asyncio
async def test_verify_supabase_token_rejects_invalid_token(jwt_secret):
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="not-a-jwt")

    with pytest.raises(HTTPException) as error:
        await security.verify_supabase_token(credentials)

    assert error.value.status_code == 401
    assert error.value.detail == "Invalid or expired token"


@pytest.mark.asyncio
async def test_verify_supabase_token_rejects_wrong_project_issuer(jwt_secret):
    token = make_token(
        sub="user-123",
        aud="authenticated",
        iss="https://other-project.supabase.co/auth/v1",
    )
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with pytest.raises(HTTPException) as error:
        await security.verify_supabase_token(credentials)

    assert error.value.status_code == 401
    assert error.value.detail == "Invalid or expired token"


@pytest.mark.asyncio
async def test_verify_supabase_token_rejects_missing_authorization():
    with pytest.raises(HTTPException) as error:
        await security.verify_supabase_token(None)

    assert error.value.status_code == 401
    assert error.value.detail == "Missing bearer token"
