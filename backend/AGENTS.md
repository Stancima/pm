# Backend

FastAPI app managed with uv (Python 3.13). Runs in Docker on port 8000.

## Structure

- `app/main.py` - FastAPI app. API routes live under `/api`; static files from `static/` are mounted at `/` (registered last so `/api` takes precedence)
- `static/index.html` - temporary hello world page that calls `/api/health` (replaced by the Next.js export in Part 3)
- `tests/` - pytest tests using FastAPI `TestClient`

## Routes

- `GET /api/health` - returns `{"status": "ok"}`

## Commands

- `uv sync` - install dependencies
- `uv run pytest` - run tests
- `uv run uvicorn app.main:app --reload` - run locally on port 8000
