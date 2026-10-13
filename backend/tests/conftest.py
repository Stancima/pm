import os
import tempfile
from pathlib import Path

import pytest

static_dir = Path(tempfile.mkdtemp())
(static_dir / "index.html").write_text("<h1>Kanban Studio</h1>")
os.environ["STATIC_DIR"] = str(static_dir)

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def db_path(tmp_path, monkeypatch):
    path = tmp_path / "test.db"
    monkeypatch.setenv("DB_PATH", str(path))
    return path


@pytest.fixture
def client():
    client = TestClient(app)
    client.post("/api/login", json={"username": "user", "password": "password"})
    return client
