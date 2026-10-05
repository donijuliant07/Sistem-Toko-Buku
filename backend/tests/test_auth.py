import jwt
import pytest
from datetime import datetime, timedelta, timezone
from app.core import security
from app.core.security import get_current_user, require_admin, UserPayload
from fastapi import HTTPException

TEST_SECRET = "test-secret-with-at-least-32-bytes-long"
USER_ID = "00000000-0000-0000-0000-000000000001"


def make_token(role: str = "customer") -> str:
    return jwt.encode(
        {
            "sub": USER_ID,
            "email": "user@example.com",
            "aud": "authenticated",
            "app_metadata": {"role": role},
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
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
async def test_require_admin_rejects_customer():
    cust_user = UserPayload(id=USER_ID, email="cust@example.com", role="customer")
    with pytest.raises(HTTPException) as err:
        await require_admin(cust_user)
    assert err.value.status_code == 403
