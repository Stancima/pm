from fastapi.testclient import TestClient

from app.main import app


def login(client, username="user", password="password"):
    return client.post("/api/login", json={"username": username, "password": password})


def test_login_success_sets_session():
    client = TestClient(app)
    response = login(client)
    assert response.status_code == 200
    assert response.json() == {"username": "user"}
    assert "session" in response.cookies


def test_login_bad_credentials():
    client = TestClient(app)
    assert login(client, password="wrong").status_code == 401
    assert login(client, username="other").status_code == 401
    assert client.get("/api/me").status_code == 401


def test_me_requires_session():
    assert TestClient(app).get("/api/me").status_code == 401


def test_me_with_session():
    client = TestClient(app)
    login(client)
    response = client.get("/api/me")
    assert response.status_code == 200
    assert response.json() == {"username": "user"}


def test_logout_clears_session():
    client = TestClient(app)
    login(client)
    assert client.post("/api/logout").status_code == 200
    assert client.get("/api/me").status_code == 401
