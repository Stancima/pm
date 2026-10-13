# Backend

FastAPI app managed with uv (Python 3.13). Runs in Docker on port 8000.

## Structure

- `app/main.py` - FastAPI app. API routes live under `/api`; the static site is mounted at `/` (registered last so `/api` takes precedence)
- `static/` - the Next.js export, copied in by the Docker build (gitignored). Overridable with the `STATIC_DIR` env var
- `tests/` - pytest tests using FastAPI `TestClient`. `conftest.py` points `STATIC_DIR` at a temp dir with a stub `index.html`

## Routes

- `GET /api/health` - returns `{"status": "ok"}`

## Commands

- `uv sync` - install dependencies
- `uv run pytest` - run tests
- `uv run uvicorn app.main:app --reload` - run locally on port 8000
