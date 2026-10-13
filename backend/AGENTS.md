# Backend

FastAPI app managed with uv (Python 3.13). Runs in Docker on port 8000.

## Structure

- `app/main.py` - FastAPI app and routes. API routes live under `/api`; the static site is mounted at `/` (registered last so `/api` takes precedence)
- `app/db.py` - SQLite access with stdlib `sqlite3` (see `docs/DATABASE.md`). `connect()` creates tables if missing; `board_id_for()` creates the user and seeds the default board on first access; mutation functions return `False` when the id is not on the user's board
- `app/ai.py` - OpenRouter client (`openai` SDK, model `nvidia/nemotron-3-super-120b-a12b:free`). `get_client()` is a cached dependency that reads `OPENROUTER_API_KEY` on first use; `ask()` sends a single user prompt; `chat()` sends the board chat and returns the parsed `AIResponse`
- `static/` - the Next.js export, copied in by the Docker build (gitignored). Overridable with the `STATIC_DIR` env var
- `tests/` - pytest tests using FastAPI `TestClient`. `conftest.py` points `STATIC_DIR` at a temp dir with a stub `index.html`, loads the root `.env` (live AI tests skip without `OPENROUTER_API_KEY`), gives each test its own `DB_PATH`, and provides a signed-in `client` fixture

## Routes

- `GET /api/health` - returns `{"status": "ok"}`
- `POST /api/login` - `{username, password}`; checks against the hardcoded `USERS` dict (`user` / `password`), stores `username` in the session, 401 on bad credentials
- `POST /api/logout` - clears the session
- `GET /api/me` - `{username}` or 401

Board routes require a session (401 otherwise), return 404 for ids not on the user's board, and all return the full board in the frontend `BoardData` shape:

- `GET /api/board`
- `PATCH /api/columns/{id}` - `{title}`
- `POST /api/cards` - `{column_id, title, details?}`, appended to the column
- `PATCH /api/cards/{id}` - `{title, details}`
- `DELETE /api/cards/{id}`
- `POST /api/cards/{id}/move` - `{column_id, position}`; position is clamped, positions are rewritten to stay contiguous

AI routes require a session:

- `POST /api/ai/test` - asks the model "What is 2+2?" and returns `{reply}`
- `POST /api/ai/chat` - `{message, history?}` where history is `[{role: "user" | "assistant", content}]`. Sends the rules, the board as nested JSON, the history and the message, and requests Structured Outputs (`AIResponse`: `{reply, board_update}`). A `board_update` replaces the board via `db.replace_board()`; 502 if its column ids differ from the board's. Returns `{reply, board_updated}`

## Auth

Starlette `SessionMiddleware` keeps a signed httponly `session` cookie. The secret is generated at startup, so sessions reset when the server restarts. `current_user(request)` returns the signed-in username or raises 401; routes use it via the `User` dependency.

## Database

`DB_PATH` env var; defaults to `backend/kanban.db` locally and is `/data/kanban.db` in Docker (the `pm-data` volume). Each request gets a connection from `get_conn`, wrapped in a transaction that commits on success and rolls back on error.

## Commands

- `uv sync` - install dependencies
- `uv run pytest` - run tests
- `uv run uvicorn app.main:app --reload` - run locally on port 8000
