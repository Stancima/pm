import os
import sqlite3
import uuid
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS columns (
    id TEXT PRIMARY KEY,
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    position INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    column_id TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL
);
"""

DEFAULT_BOARD = [
    ("Backlog", [
        ("Align roadmap themes", "Draft quarterly themes with impact statements and metrics."),
        ("Gather customer signals", "Review support tags, sales notes, and churn feedback."),
    ]),
    ("Discovery", [
        ("Prototype analytics view", "Sketch initial dashboard layout and key drill-downs."),
    ]),
    ("In Progress", [
        ("Refine status language", "Standardize column labels and tone across the board."),
        ("Design card layout", "Add hierarchy and spacing for scanning dense lists."),
    ]),
    ("Review", [
        ("QA micro-interactions", "Verify hover, focus, and loading states."),
    ]),
    ("Done", [
        ("Ship marketing page", "Final copy approved and asset pack delivered."),
        ("Close onboarding sprint", "Document release notes and share internally."),
    ]),
]


def connect() -> sqlite3.Connection:
    path = os.environ.get("DB_PATH", Path(__file__).parent.parent / "kanban.db")
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    return conn


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def board_id_for(conn: sqlite3.Connection, username: str) -> int:
    row = conn.execute(
        "SELECT boards.id FROM boards JOIN users ON users.id = boards.user_id WHERE users.username = ?",
        (username,),
    ).fetchone()
    if row:
        return row["id"]

    user_id = conn.execute("INSERT INTO users (username) VALUES (?)", (username,)).lastrowid
    board_id = conn.execute(
        "INSERT INTO boards (user_id, title) VALUES (?, ?)", (user_id, "My Board")
    ).lastrowid
    for col_pos, (col_title, cards) in enumerate(DEFAULT_BOARD):
        column_id = new_id("col")
        conn.execute(
            "INSERT INTO columns (id, board_id, title, position) VALUES (?, ?, ?, ?)",
            (column_id, board_id, col_title, col_pos),
        )
        for card_pos, (title, details) in enumerate(cards):
            conn.execute(
                "INSERT INTO cards (id, column_id, title, details, position) VALUES (?, ?, ?, ?, ?)",
                (new_id("card"), column_id, title, details, card_pos),
            )
    return board_id


def get_board(conn: sqlite3.Connection, board_id: int) -> dict:
    columns = conn.execute(
        "SELECT id, title FROM columns WHERE board_id = ? ORDER BY position", (board_id,)
    ).fetchall()
    cards = conn.execute(
        """SELECT cards.id, cards.column_id, cards.title, cards.details FROM cards
        JOIN columns ON columns.id = cards.column_id
        WHERE columns.board_id = ? ORDER BY cards.position""",
        (board_id,),
    ).fetchall()
    return {
        "columns": [
            {
                "id": column["id"],
                "title": column["title"],
                "cardIds": [card["id"] for card in cards if card["column_id"] == column["id"]],
            }
            for column in columns
        ],
        "cards": {
            card["id"]: {"id": card["id"], "title": card["title"], "details": card["details"]}
            for card in cards
        },
    }


def column_on_board(conn: sqlite3.Connection, board_id: int, column_id: str) -> bool:
    return conn.execute(
        "SELECT 1 FROM columns WHERE id = ? AND board_id = ?", (column_id, board_id)
    ).fetchone() is not None


def card_column(conn: sqlite3.Connection, board_id: int, card_id: str) -> str | None:
    row = conn.execute(
        """SELECT cards.column_id FROM cards JOIN columns ON columns.id = cards.column_id
        WHERE cards.id = ? AND columns.board_id = ?""",
        (card_id, board_id),
    ).fetchone()
    return row["column_id"] if row else None


def card_ids_in(conn: sqlite3.Connection, column_id: str) -> list[str]:
    rows = conn.execute(
        "SELECT id FROM cards WHERE column_id = ? ORDER BY position", (column_id,)
    ).fetchall()
    return [row["id"] for row in rows]


def write_positions(conn: sqlite3.Connection, column_id: str, card_ids: list[str]) -> None:
    for position, card_id in enumerate(card_ids):
        conn.execute(
            "UPDATE cards SET column_id = ?, position = ? WHERE id = ?",
            (column_id, position, card_id),
        )


def rename_column(conn: sqlite3.Connection, board_id: int, column_id: str, title: str) -> bool:
    cursor = conn.execute(
        "UPDATE columns SET title = ? WHERE id = ? AND board_id = ?", (title, column_id, board_id)
    )
    return cursor.rowcount > 0


def create_card(
    conn: sqlite3.Connection, board_id: int, column_id: str, title: str, details: str
) -> bool:
    if not column_on_board(conn, board_id, column_id):
        return False
    conn.execute(
        "INSERT INTO cards (id, column_id, title, details, position) VALUES (?, ?, ?, ?, ?)",
        (new_id("card"), column_id, title, details, len(card_ids_in(conn, column_id))),
    )
    return True


def update_card(
    conn: sqlite3.Connection, board_id: int, card_id: str, title: str, details: str
) -> bool:
    if card_column(conn, board_id, card_id) is None:
        return False
    conn.execute(
        "UPDATE cards SET title = ?, details = ? WHERE id = ?", (title, details, card_id)
    )
    return True


def delete_card(conn: sqlite3.Connection, board_id: int, card_id: str) -> bool:
    column_id = card_column(conn, board_id, card_id)
    if column_id is None:
        return False
    conn.execute("DELETE FROM cards WHERE id = ?", (card_id,))
    write_positions(conn, column_id, card_ids_in(conn, column_id))
    return True


def move_card(
    conn: sqlite3.Connection, board_id: int, card_id: str, column_id: str, position: int
) -> bool:
    source_id = card_column(conn, board_id, card_id)
    if source_id is None or not column_on_board(conn, board_id, column_id):
        return False
    target = [id for id in card_ids_in(conn, column_id) if id != card_id]
    target.insert(max(0, min(position, len(target))), card_id)
    write_positions(conn, column_id, target)
    if source_id != column_id:
        write_positions(conn, source_id, card_ids_in(conn, source_id))
    return True
