import json
import os
from functools import cache
from typing import Literal

from openai import OpenAI
from pydantic import BaseModel

MODEL = "nvidia/nemotron-3-super-120b-a12b:free"

SYSTEM_PROMPT = """You are the assistant for a Kanban board app. You help the user manage their board.

The current board is given as JSON: a list of columns in order, each with its cards in order.

Rules:
- Answer in `reply`, briefly.
- If the user asks you to create, edit, move or delete cards, or rename columns, return the complete updated board in `board_update`. Otherwise set `board_update` to null.
- The columns are fixed: keep every column with its id and order. You may only change column titles.
- Keep the id of every existing card. Use an empty string as the id for new cards.
- A card left out of `board_update` is deleted, so include every card that should remain.
"""


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class AICard(BaseModel):
    id: str
    title: str
    details: str


class AIColumn(BaseModel):
    id: str
    title: str
    cards: list[AICard]


class AIBoard(BaseModel):
    columns: list[AIColumn]


class AIResponse(BaseModel):
    reply: str
    board_update: AIBoard | None


@cache
def get_client() -> OpenAI:
    return OpenAI(base_url="https://openrouter.ai/api/v1", api_key=os.environ["OPENROUTER_API_KEY"])


def ask(client: OpenAI, prompt: str) -> str:
    response = client.chat.completions.create(model=MODEL, messages=[{"role": "user", "content": prompt}])
    return response.choices[0].message.content


def nested_board(board: dict) -> dict:
    return {
        "columns": [
            {
                "id": column["id"],
                "title": column["title"],
                "cards": [board["cards"][card_id] for card_id in column["cardIds"]],
            }
            for column in board["columns"]
        ]
    }


def chat(client: OpenAI, board: dict, history: list[Message], message: str) -> AIResponse:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": f"Current board:\n{json.dumps(nested_board(board))}"},
        *[m.model_dump() for m in history],
        {"role": "user", "content": message},
    ]
    response = client.chat.completions.parse(model=MODEL, messages=messages, response_format=AIResponse)
    return response.choices[0].message.parsed
