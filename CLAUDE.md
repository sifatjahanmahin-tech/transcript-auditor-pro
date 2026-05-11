# Transcript Auditor Pro

NSU degree audit platform. FastAPI backend + Next.js 16 frontend + Expo mobile + Python CLI + MCP server.

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI, SQLAlchemy async, aiosqlite (dev) / asyncpg (prod) |
| Frontend | Next.js 16.2.1, React 19, Tailwind CSS v4 |
| Mobile | Expo (React Native) |
| CLI | Python (`cli/client.py`) |
| MCP | FastMCP (`transcript_mcp/`) |
| Auth | Google OAuth2 + JWT |
| DB | SQLite (dev), PostgreSQL (prod) |

## Key paths

- `backend/main.py` — FastAPI entry point, seeds programs on startup
- `backend/routes/` — audit, auth, history, mcp routes
- `engine/` — credit, CGPA, deficiency audit engines
- `parsers/` — transcript CSV + program.md parsers
- `models/data_models.py` — shared dataclasses
- `transcript_mcp/server.py` — MCP server (5 tools + 2 prompts)
- `tests/` — pytest suite + Locust load tests

## Running the project

```bash
# Backend
.venv/Scripts/python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (from frontend/)
npm run dev

# Tests
.venv/Scripts/python -m pytest tests/ -v --tb=short

# Lint
ruff check backend/ engine/ models/ parsers/ cli/ transcript_mcp/
```

Always use `.venv/Scripts/python` — never the system `python`.

## Tailwind CSS v4

Uses `@theme` blocks and `@import 'tailwindcss'` — NOT the v3 `@tailwind` directives. Custom colors live in `frontend/src/app/globals.css`.

## Custom slash commands

Type `/command-name` to invoke any of these:

| Command | What it does |
|---|---|
| `/run-tests` | Full pytest suite with lint pre-check |
| `/lint` | Ruff + ESLint + TypeScript check (read-only) |
| `/lint-fix` | Auto-fix all ruff and ESLint issues |
| `/dev` | Start backend + frontend dev servers |
| `/health` | Check all services (API, frontend, DB, MCP, deps) |
| `/load-test` | Locust load test (default: 20 users, 60s) |
| `/api-smoke` | Smoke test all API endpoints |
| `/audit-debug` | Debug audit engines with sample transcript data |
| `/mcp-test` | Test all 5 MCP server tools end-to-end |
| `/db-reset` | Reset SQLite DB and reseed programs (destructive — confirms first) |
| `/deploy-check` | Full pre-deploy gate: lint + tests + build + load smoke |
| `/ocr-test` | Test Tesseract OCR pipeline on a transcript image |
| `/add-program` | Add a new NSU degree program to program.md + DB |
| `/security-scan` | Dependency CVE audit + secrets scan + web vuln review |
