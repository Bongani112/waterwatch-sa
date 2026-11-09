import os
import tempfile

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://waterwatch:waterwatch@localhost:5432/waterwatch_test")
os.environ["JWT_SECRET"] = "test-secret-key-that-is-long-enough-for-hs256"
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp(prefix="ww-uploads-")
os.environ["ADMIN_EMAIL"] = "admin@example.com"
os.environ["ADMIN_PASSWORD"] = "adminpass123"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed_reference  # noqa: E402

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TABLES = "notifications, attachments, confirmations, incident_updates, incidents, locations, users, categories"


@pytest.fixture(scope="session", autouse=True)
def migrated_db():
    cfg = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(BACKEND_DIR, "alembic"))
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    yield


@pytest.fixture(autouse=True)
def clean_db(migrated_db):
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {TABLES} RESTART IDENTITY CASCADE"))
    with SessionLocal() as db:
        seed_reference(db)
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def register(client):
    def _register(email: str = "resident@example.com", name: str = "Test Resident") -> dict:
        r = client.post("/api/auth/register", json={"name": name, "email": email, "password": "password123"})
        assert r.status_code == 201, r.text
        return _auth(r.json()["access_token"])

    return _register


@pytest.fixture
def admin_headers(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "adminpass123"})
    assert r.status_code == 200, r.text
    return _auth(r.json()["access_token"])


@pytest.fixture
def incident_payload():
    def _payload(**overrides) -> dict:
        body = {
            "category_id": 1,
            "title": "No water on Main Road",
            "description": "Taps have been dry since 6am across the block.",
            "location": {
                "province": "Gauteng",
                "municipality": "City of Johannesburg",
                "suburb": "Melville",
                "latitude": -26.175612,
                "longitude": 28.008034,
            },
        }
        body.update(overrides)
        return body

    return _payload


@pytest.fixture
def create_incident(client, incident_payload):
    def _create(headers: dict, **overrides) -> dict:
        r = client.post("/api/incidents", json=incident_payload(**overrides), headers=headers)
        assert r.status_code == 201, r.text
        return r.json()

    return _create
