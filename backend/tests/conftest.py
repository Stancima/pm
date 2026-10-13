import os
import tempfile
from pathlib import Path

import pytest

static_dir = Path(tempfile.mkdtemp())
(static_dir / "index.html").write_text("<h1>Kanban Studio</h1>")
os.environ["STATIC_DIR"] = str(static_dir)

env_file = Path(__file__).parent.parent.parent / ".env"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        key, sep, value = line.partition("=")
        if sep and not line.startswith("#"):
            os.environ.setdefault(key.strip(), value.strip())

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
