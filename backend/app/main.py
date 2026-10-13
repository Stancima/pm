import os
import secrets
import sqlite3
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware

from app import db

STATIC_DIR = Path(os.environ.get("STATIC_DIR", Path(__file__).parent.parent / "static"))
USERS = {"user": "password"}

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key=secrets.token_hex(32))


class Credentials(BaseModel):
    username: str
    password: str


class ColumnUpdate(BaseModel):
    title: str


class CardCreate(BaseModel):
    column_id: str
    title: str
    details: str = ""


class CardUpdate(BaseModel):
    title: str
    details: str


class CardMove(BaseModel):
    column_id: str
    position: int


def current_user(request: Request) -> str:
    username = request.session.get("username")
    if not username:
        raise HTTPException(status_code=401, detail="Not signed in")
    return username


def get_conn():
    conn = db.connect()
    try:
        with conn:
            yield conn
    finally:
        conn.close()


Conn = Annotated[sqlite3.Connection, Depends(get_conn)]
User = Annotated[str, Depends(current_user)]


def check_found(found: bool, what: str) -> None:
    if not found:
        raise HTTPException(status_code=404, detail=f"{what} not found")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/login")
def login(credentials: Credentials, request: Request):
    if USERS.get(credentials.username) != credentials.password:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    request.session["username"] = credentials.username
    return {"username": credentials.username}


@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return {"status": "ok"}


@app.get("/api/me")
def me(username: User):
    return {"username": username}


@app.get("/api/board")
def read_board(username: User, conn: Conn):
    return db.get_board(conn, db.board_id_for(conn, username))


@app.patch("/api/columns/{column_id}")
def rename_column(column_id: str, body: ColumnUpdate, username: User, conn: Conn):
    board_id = db.board_id_for(conn, username)
    check_found(db.rename_column(conn, board_id, column_id, body.title), "Column")
    return db.get_board(conn, board_id)


@app.post("/api/cards")
def create_card(body: CardCreate, username: User, conn: Conn):
    board_id = db.board_id_for(conn, username)
    check_found(db.create_card(conn, board_id, body.column_id, body.title, body.details), "Column")
    return db.get_board(conn, board_id)


@app.patch("/api/cards/{card_id}")
def update_card(card_id: str, body: CardUpdate, username: User, conn: Conn):
    board_id = db.board_id_for(conn, username)
    check_found(db.update_card(conn, board_id, card_id, body.title, body.details), "Card")
    return db.get_board(conn, board_id)


@app.delete("/api/cards/{card_id}")
def delete_card(card_id: str, username: User, conn: Conn):
    board_id = db.board_id_for(conn, username)
    check_found(db.delete_card(conn, board_id, card_id), "Card")
    return db.get_board(conn, board_id)


@app.post("/api/cards/{card_id}/move")
def move_card(card_id: str, body: CardMove, username: User, conn: Conn):
    board_id = db.board_id_for(conn, username)
    check_found(db.move_card(conn, board_id, card_id, body.column_id, body.position), "Card or column")
    return db.get_board(conn, board_id)


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
