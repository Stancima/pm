import json
import os
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import ai
from app.main import app

live = pytest.mark.skipif(not os.environ.get("OPENROUTER_API_KEY"), reason="OPENROUTER_API_KEY not set")


class FakeCompletions:
    def __init__(self):
        self.parsed = ai.AIResponse(reply="Done.", board_update=None)

    def create(self, **kwargs):
        self.kwargs = kwargs
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="2+2 is 4."))])

    def parse(self, **kwargs):
        self.kwargs = kwargs
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(parsed=self.parsed))])


@pytest.fixture
def fake():
    completions = FakeCompletions()
    app.dependency_overrides[ai.get_client] = lambda: SimpleNamespace(chat=SimpleNamespace(completions=completions))
    yield completions
    app.dependency_overrides.clear()


def ai_board(board):
    return ai.AIBoard.model_validate(ai.nested_board(board))


def test_ai_test_returns_reply(client, fake):
    response = client.post("/api/ai/test")
    assert response.status_code == 200
    assert response.json() == {"reply": "2+2 is 4."}
    assert fake.kwargs["model"] == ai.MODEL
    assert fake.kwargs["messages"] == [{"role": "user", "content": "What is 2+2?"}]


@pytest.mark.parametrize("path,body", [("/api/ai/test", None), ("/api/ai/chat", {"message": "hi"})])
def test_ai_routes_require_session(fake, path, body):
    assert TestClient(app).post(path, json=body).status_code == 401


def test_chat_reply_only_leaves_board_unchanged(client, fake):
    before = client.get("/api/board").json()
    response = client.post("/api/ai/chat", json={"message": "hi"})
    assert response.json() == {"reply": "Done.", "board_updated": False}
    assert client.get("/api/board").json() == before


def test_chat_sends_board_and_history(client, fake):
    board = client.get("/api/board").json()
    history = [{"role": "user", "content": "earlier"}, {"role": "assistant", "content": "reply"}]
    client.post("/api/ai/chat", json={"message": "now", "history": history})
    messages = fake.kwargs["messages"]
    assert messages[0]["role"] == "system"
    assert json.dumps(ai.nested_board(board)) in messages[1]["content"]
    assert messages[2:] == [*history, {"role": "user", "content": "now"}]
    assert fake.kwargs["response_format"] is ai.AIResponse


def test_chat_board_update_is_persisted(client, fake):
    board = client.get("/api/board").json()
    update = ai_board(board)
    backlog, discovery, *_ = update.columns
    moved = backlog.cards.pop(0)
    deleted = backlog.cards.pop(0)
    discovery.cards.insert(0, moved)
    discovery.cards[1].title = "Edited"
    discovery.cards.append(ai.AICard(id="", title="New card", details="From AI"))
    backlog.title = "Ideas"
    fake.parsed = ai.AIResponse(reply="Updated.", board_update=update)

    response = client.post("/api/ai/chat", json={"message": "change things"})
    assert response.json() == {"reply": "Updated.", "board_updated": True}

    after = client.get("/api/board").json()
    ideas, disc = after["columns"][0], after["columns"][1]
    assert ideas["title"] == "Ideas"
    assert ideas["cardIds"] == []
    assert deleted.id not in after["cards"]
    assert disc["cardIds"][:2] == [moved.id, discovery.cards[1].id]
    assert after["cards"][disc["cardIds"][1]]["title"] == "Edited"
    new = after["cards"][disc["cardIds"][2]]
    assert new["id"].startswith("card-")
    assert (new["title"], new["details"]) == ("New card", "From AI")
    assert len(after["cards"]) == len(board["cards"])


def test_chat_rejects_changed_columns(client, fake):
    board = client.get("/api/board").json()
    update = ai_board(board)
    update.columns.pop()
    fake.parsed = ai.AIResponse(reply="Oops.", board_update=update)
    assert client.post("/api/ai/chat", json={"message": "x"}).status_code == 502
    assert client.get("/api/board").json() == board


@live
def test_ai_test_live(client):
    response = client.post("/api/ai/test")
    assert response.status_code == 200
    assert "4" in response.json()["reply"]


@live
def test_chat_live_adds_card(client):
    response = client.post("/api/ai/chat", json={"message": "Add a card titled 'Write launch email' to the Backlog column."})
    assert response.status_code == 200
    assert response.json()["board_updated"] is True
    board = client.get("/api/board").json()
    titles = [board["cards"][id]["title"] for id in board["columns"][0]["cardIds"]]
    assert "Write launch email" in titles
