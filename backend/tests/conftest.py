from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.models import Decision

BACKEND = Path(__file__).resolve().parents[1]


@pytest.fixture
def app(tmp_path):
    settings = Settings(
        database_url=f"sqlite:///{tmp_path}/test.db",
        local_vector_path=str(tmp_path / "vectors.json"),
        knowledge_dir=str(BACKEND / "knowledge"),
        secret_key="test-secret-key-which-is-long-enough",
        openai_api_key="",
        pinecone_api_key="",
        tavily_api_key="",
    )
    return create_app(settings)


@pytest.fixture
def client(app):
    with TestClient(app) as test_client:
        yield test_client


def auth_header(client: TestClient, email: str = "ada@example.com") -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "display_name": "Ada"},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
