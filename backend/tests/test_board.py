import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.main import app


def column(board, title):
    return next(c for c in board["columns"] if c["title"] == title)


def card_id(board, title):
    return next(id for id, card in board["cards"].items() if card["title"] == title)


@pytest.fixture
def board(client):
    return client.get("/api/board").json()


def test_db_created_when_missing(db_path, client):
    assert not db_path.exists()
    client.get("/api/board")
    assert db_path.exists()


def test_default_board_seeded_once(db_path, client):
    first = client.get("/api/board").json()
    second = client.get("/api/board").json()
    assert first == second
    assert [c["title"] for c in first["columns"]] == [
        "Backlog", "Discovery", "In Progress", "Review", "Done"
    ]
    assert len(first["cards"]) == 8
    conn = sqlite3.connect(db_path)
    assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 1
    assert conn.execute("SELECT COUNT(*) FROM boards").fetchone()[0] == 1


def test_board_shape(board):
    backlog = column(board, "Backlog")
    assert backlog["id"].startswith("col-")
    assert len(backlog["cardIds"]) == 2
    first = board["cards"][backlog["cardIds"][0]]
    assert first == {
        "id": backlog["cardIds"][0],
        "title": "Align roadmap themes",
        "details": "Draft quarterly themes with impact statements and metrics.",
    }


def test_data_persists_across_sessions(client, board):
    col_id = column(board, "Backlog")["id"]
    client.patch(f"/api/columns/{col_id}", json={"title": "Ideas"})
    fresh = TestClient(app)
    fresh.post("/api/login", json={"username": "user", "password": "password"})
    assert column(fresh.get("/api/board").json(), "Ideas")["id"] == col_id


@pytest.mark.parametrize(
    "method,path,body",
    [
        ("get", "/api/board", None),
        ("patch", "/api/columns/col-x", {"title": "x"}),
        ("post", "/api/cards", {"column_id": "col-x", "title": "x"}),
        ("patch", "/api/cards/card-x", {"title": "x", "details": "y"}),
        ("delete", "/api/cards/card-x", None),
        ("post", "/api/cards/card-x/move", {"column_id": "col-x", "position": 0}),
    ],
)
def test_routes_require_session(method, path, body):
    client = TestClient(app)
    kwargs = {"json": body} if body is not None else {}
    assert getattr(client, method)(path, **kwargs).status_code == 401


def test_rename_column(client, board):
    col_id = column(board, "Backlog")["id"]
    response = client.patch(f"/api/columns/{col_id}", json={"title": "Ideas"})
    assert response.status_code == 200
    assert column(response.json(), "Ideas")["id"] == col_id
    assert column(client.get("/api/board").json(), "Ideas")["id"] == col_id


def test_rename_unknown_column(client, board):
    assert client.patch("/api/columns/col-nope", json={"title": "x"}).status_code == 404


def test_create_card(client, board):
    col_id = column(board, "Review")["id"]
    response = client.post(
        "/api/cards", json={"column_id": col_id, "title": "New", "details": "Notes"}
    )
    assert response.status_code == 200
    updated = response.json()
    new_id = card_id(updated, "New")
    assert new_id.startswith("card-")
    assert column(updated, "Review")["cardIds"][-1] == new_id
    assert updated["cards"][new_id]["details"] == "Notes"


def test_create_card_default_details(client, board):
    col_id = column(board, "Review")["id"]
    updated = client.post("/api/cards", json={"column_id": col_id, "title": "Bare"}).json()
    assert updated["cards"][card_id(updated, "Bare")]["details"] == ""


def test_create_card_unknown_column(client, board):
    response = client.post("/api/cards", json={"column_id": "col-nope", "title": "x"})
    assert response.status_code == 404


def test_update_card(client, board):
    id = card_id(board, "Design card layout")
    response = client.patch(f"/api/cards/{id}", json={"title": "Edited", "details": "Changed"})
    assert response.status_code == 200
    assert response.json()["cards"][id] == {"id": id, "title": "Edited", "details": "Changed"}


def test_update_unknown_card(client, board):
    response = client.patch("/api/cards/card-nope", json={"title": "x", "details": "y"})
    assert response.status_code == 404


def test_delete_card(client, board):
    id = card_id(board, "Align roadmap themes")
    response = client.delete(f"/api/cards/{id}")
    assert response.status_code == 200
    updated = response.json()
    assert id not in updated["cards"]
    assert column(updated, "Backlog")["cardIds"] == [card_id(board, "Gather customer signals")]


def test_delete_unknown_card(client, board):
    assert client.delete("/api/cards/card-nope").status_code == 404


def test_move_within_column(client, board):
    first, second = column(board, "Backlog")["cardIds"]
    response = client.post(
        f"/api/cards/{second}/move",
        json={"column_id": column(board, "Backlog")["id"], "position": 0},
    )
    assert response.status_code == 200
    assert column(response.json(), "Backlog")["cardIds"] == [second, first]


def test_move_across_columns(client, board, db_path):
    moving = column(board, "Backlog")["cardIds"][0]
    done = column(board, "Done")
    response = client.post(
        f"/api/cards/{moving}/move", json={"column_id": done["id"], "position": 1}
    )
    updated = response.json()
    assert column(updated, "Done")["cardIds"] == [done["cardIds"][0], moving, done["cardIds"][1]]
    assert moving not in column(updated, "Backlog")["cardIds"]

    conn = sqlite3.connect(db_path)
    for col in updated["columns"]:
        positions = [
            row[0]
            for row in conn.execute(
                "SELECT position FROM cards WHERE column_id = ? ORDER BY position", (col["id"],)
            )
        ]
        assert positions == list(range(len(col["cardIds"])))


def test_move_to_end_clamps_position(client, board):
    moving = column(board, "Backlog")["cardIds"][0]
    review = column(board, "Review")
    updated = client.post(
        f"/api/cards/{moving}/move", json={"column_id": review["id"], "position": 99}
    ).json()
    assert column(updated, "Review")["cardIds"][-1] == moving


def test_move_unknown(client, board):
    col_id = column(board, "Done")["id"]
    card = column(board, "Backlog")["cardIds"][0]
    assert client.post("/api/cards/card-nope/move", json={"column_id": col_id, "position": 0}).status_code == 404
    assert client.post(f"/api/cards/{card}/move", json={"column_id": "col-nope", "position": 0}).status_code == 404


def test_users_cannot_touch_other_boards(client, board):
    from app import db

    conn = db.connect()
    with conn:
        other_board = db.board_id_for(conn, "someone-else")
        other = db.get_board(conn, other_board)
    conn.close()
    other_col = other["columns"][0]["id"]
    other_card = other["columns"][0]["cardIds"][0]

    assert client.patch(f"/api/columns/{other_col}", json={"title": "x"}).status_code == 404
    assert client.post("/api/cards", json={"column_id": other_col, "title": "x"}).status_code == 404
    assert client.patch(f"/api/cards/{other_card}", json={"title": "x", "details": "y"}).status_code == 404
    assert client.delete(f"/api/cards/{other_card}").status_code == 404
    own_col = column(board, "Done")["id"]
    assert client.post(f"/api/cards/{other_card}/move", json={"column_id": own_col, "position": 0}).status_code == 404
