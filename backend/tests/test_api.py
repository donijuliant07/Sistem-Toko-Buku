import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from app.main import app
from app.core.security import get_current_user, require_staff_or_admin, UserPayload

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "Gramedia" in data["pesan"]


def test_public_categories_list():
    mock_categories = [
        {"id": "c1", "name": "Fiksi", "slug": "fiksi", "type": "Buku", "created_at": "2026-10-01T00:00:00Z"},
        {"id": "c2", "name": "Alat Tulis", "slug": "alat-tulis", "type": "Non-Buku", "created_at": "2026-10-01T00:00:00Z"},
    ]
    with patch("app.services.category_service.category_service.get_all", return_value=mock_categories):
        response = client.get("/api/v1/categories")
        assert response.status_code == 200
        json_data = response.json()
        assert json_data["sukses"] is True
        assert len(json_data["data"]) == 2
        assert json_data["data"][0]["name"] == "Fiksi"


def test_protected_create_category_without_auth():
    response = client.post("/api/v1/categories", json={
        "name": "Komik",
        "slug": "komik",
        "type": "Buku"
    })
    assert response.status_code == 401


def test_protected_create_category_with_admin_auth():
    admin_user = UserPayload(id="u1", email="admin@gramedia.id", role="admin")

    app.dependency_overrides[get_current_user] = lambda: admin_user
    app.dependency_overrides[require_staff_or_admin] = lambda: admin_user

    mock_created = {
        "id": "c3",
        "name": "Komik",
        "slug": "komik",
        "type": "Buku",
        "created_at": "2026-10-05T00:00:00Z"
    }

    with patch("app.services.category_service.category_service.create", return_value=mock_created):
        response = client.post("/api/v1/categories", json={
            "name": "Komik",
            "slug": "komik",
            "type": "Buku"
        })
        assert response.status_code == 201
        json_data = response.json()
        assert json_data["sukses"] is True
        assert json_data["data"]["id"] == "c3"

    app.dependency_overrides.clear()
