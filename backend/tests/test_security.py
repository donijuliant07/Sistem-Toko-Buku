import jwt
import pytest
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.core import security
from app.core.security import get_current_user, require_admin, require_user, UserPayload

TEST_SECRET = "test-secret-with-at-least-32-bytes-long"


@pytest.fixture
def jwt_secret(monkeypatch):
    monkeypatch.setattr(security.settings, "SUPABASE_JWT_SECRET", TEST_SECRET)


def make_token(**claims: object) -> str:
    claims.setdefault("aud", "authenticated")
    claims.setdefault("sub", "user-123")
    claims.setdefault("exp", datetime.now(timezone.utc) + timedelta(minutes=5))
    return jwt.encode(claims, TEST_SECRET, algorithm="HS256")


def mock_role(monkeypatch, role: str | None):
    """Ganti lookup `profiles` dengan nilai tetap — tidak menyentuh DB sungguhan."""
    async def fake_resolve(user_id: str) -> str:
        if role is None:
            raise HTTPException(status_code=403, detail="Akun tidak memiliki peran yang sah.")
        return role

    monkeypatch.setattr(security, "resolve_user_role", fake_resolve)


@pytest.mark.asyncio
async def test_get_current_user_accepts_valid_token(jwt_secret, monkeypatch):
    mock_role(monkeypatch, "user")
    token = make_token(sub="user-123", email="user@example.com")
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    user = await get_current_user(credentials)
    assert user.id == "user-123"
    assert user.email == "user@example.com"
    assert user.role == "user"


@pytest.mark.asyncio
async def test_get_current_user_ignores_user_metadata_role(jwt_secret, monkeypatch):
    """Metadata JWT dapat diubah sendiri oleh user, jadi tidak pernah dipercaya."""
    mock_role(monkeypatch, "user")
    token = make_token(
        user_metadata={"role": "admin"},
        app_metadata={"role": "admin"},
    )
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    user = await get_current_user(credentials)
    assert user.role == "user"


@pytest.mark.asyncio
async def test_get_current_user_reads_admin_role_from_profiles(jwt_secret, monkeypatch):
    mock_role(monkeypatch, "admin")
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=make_token())

    user = await get_current_user(credentials)
    assert user.role == "admin"


@pytest.mark.asyncio
async def test_get_current_user_rejects_missing_profile(jwt_secret, monkeypatch):
    mock_role(monkeypatch, None)
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=make_token())

    with pytest.raises(HTTPException) as error:
        await get_current_user(credentials)

    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_resolve_user_role_rejects_unknown_role(monkeypatch):
    class FakeQuery:
        def select(self, *_): return self
        def eq(self, *_): return self
        def maybe_single(self): return self
        def execute(self):
            return type("Res", (), {"data": {"role": "superuser"}})()

    class FakeAdmin:
        def table(self, _): return FakeQuery()

    import app.core.supabase as supabase_module
    monkeypatch.setattr(supabase_module, "supabase_admin", FakeAdmin())

    with pytest.raises(HTTPException) as error:
        await security.resolve_user_role("user-123")

    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_resolve_user_role_fails_closed_when_lookup_errors(monkeypatch):
    class BrokenAdmin:
        def table(self, _):
            raise RuntimeError("connection reset")

    import app.core.supabase as supabase_module
    monkeypatch.setattr(supabase_module, "supabase_admin", BrokenAdmin())

    with pytest.raises(HTTPException) as error:
        await security.resolve_user_role("user-123")

    assert error.value.status_code == 503


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


@pytest.mark.asyncio
async def test_require_admin_rejects_user():
    with pytest.raises(HTTPException) as error:
        await require_admin(UserPayload(id="u1", role="user"))
    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_require_admin_allows_admin():
    user = await require_admin(UserPayload(id="u1", role="admin"))
    assert user.id == "u1"


@pytest.mark.asyncio
async def test_require_user_rejects_admin():
    """Admin mengelola toko lewat dashboard; bertransaksi harus akun pelanggan."""
    with pytest.raises(HTTPException) as error:
        await require_user(UserPayload(id="u1", role="admin"))
    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_require_user_allows_user():
    user = await require_user(UserPayload(id="u1", role="user"))
    assert user.id == "u1"
