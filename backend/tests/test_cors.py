"""Kebijakan CORS: origin dev eksplisit + IP LAN (hanya saat development)."""

import pytest

PREFLIGHT_HEADERS = {
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "authorization,content-type",
}


async def _preflight(client, origin: str):
    return await client.options("/api/v1/books", headers={"Origin": origin, **PREFLIGHT_HEADERS})


@pytest.mark.asyncio
@pytest.mark.parametrize("origin", ["http://localhost:3000", "http://127.0.0.1:3000"])
async def test_loopback_origins_allowed(client, origin):
    response = await _preflight(client, origin)
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["access-control-allow-credentials"] == "true"
    assert "POST" in response.headers["access-control-allow-methods"]


@pytest.mark.asyncio
@pytest.mark.parametrize("origin", ["http://192.168.1.10:3000", "http://10.0.0.5:3000", "http://172.16.3.4:3000"])
async def test_private_lan_origins_allowed_in_development(client, origin):
    """Dev server Next bisa dibuka lewat IP LAN; origin-nya tak mungkin di-hardcode."""
    response = await _preflight(client, origin)
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


@pytest.mark.asyncio
@pytest.mark.parametrize("origin", ["https://evil.example", "http://192.168.1.10:3001"])
async def test_unknown_origins_rejected(client, origin):
    response = await _preflight(client, origin)
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


@pytest.mark.asyncio
async def test_simple_request_gets_allow_origin(client):
    response = await client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
