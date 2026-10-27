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


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "origin",
    [
        "https://readr.vercel.app",
        "https://readr-abc123.vercel.app",
        "https://readr-git-main-r3nddy.vercel.app",
    ],
)
async def test_vercel_origins_allowed_in_production(origin):
    """URL preview berubah tiap deploy; project name + pola itulah yang didaftarkan."""
    from httpx import ASGITransport, AsyncClient
    from starlette.applications import Starlette
    from starlette.middleware.cors import CORSMiddleware
    from starlette.responses import PlainTextResponse
    from starlette.routing import Route

    from app.core.config import Settings

    regex = Settings(VERCEL_FRONTEND_PROJECTS="readr").vercel_origins_regex
    app = Starlette(routes=[Route("/x", lambda request: PlainTextResponse("ok"))])
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[],
        allow_origin_regex=regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/x", headers={"Origin": origin})
    assert response.headers.get("access-control-allow-origin") == origin


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "origin",
    ["https://readrx.vercel.app", "https://readr.vercel.app.evil.com", "http://readr.vercel.app"],
)
async def test_vercel_lookalike_origins_rejected(origin):
    from httpx import ASGITransport, AsyncClient
    from starlette.applications import Starlette
    from starlette.middleware.cors import CORSMiddleware
    from starlette.responses import PlainTextResponse
    from starlette.routing import Route

    from app.core.config import Settings

    app = Starlette(routes=[Route("/x", lambda request: PlainTextResponse("ok"))])
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[],
        allow_origin_regex=Settings(VERCEL_FRONTEND_PROJECTS="readr").vercel_origins_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/x", headers={"Origin": origin})
    assert "access-control-allow-origin" not in response.headers


def test_cors_origins_trims_trailing_slash():
    """Browser mengirim origin tanpa `/`; nilai ber-slash tidak boleh lolos."""
    from app.core.config import Settings

    assert Settings(FRONTEND_ORIGINS="https://a.example/, ,https://b.example").cors_origins == [
        "https://a.example",
        "https://b.example",
    ]


def test_vercel_origins_regex_none_without_projects():
    from app.core.config import Settings

    assert Settings(VERCEL_FRONTEND_PROJECTS=" , ").vercel_origins_regex is None