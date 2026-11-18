# Setup

The quick version. [README.md](README.md) has the full environment variable list, test commands and
deployment notes.

## Prerequisites

- Python 3.13
- Node.js 20.9 or later
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey). The free tier is enough.

## 1. Backend (MCP server + REST API)

```bash
cd backend
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # then set GEMINI_API_KEY
uvicorn main:app --reload --port 8000
```

Check it:

- <http://localhost:8000/healthz> returns `"ok": true` and the product count.
- <http://localhost:8000/docs> shows the REST API.
- The MCP endpoint answers JSON-RPC:

  ```bash
  curl -s http://localhost:8000/mcp \
    -H 'content-type: application/json' \
    -H 'accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
  ```

Without `GEMINI_API_KEY` the backend still runs, and semantic search falls back to keyword matching.

## 2. Frontend (chat agent)

```bash
cd frontend
npm ci
cp .env.example .env.local      # then set GEMINI_API_KEY
npm run dev
```

Open <http://localhost:3000>. The frontend needs `GEMINI_API_KEY`: `/api/chat` and `/api/transcribe`
return a `config_error` without it.

## Or with Docker

```bash
GEMINI_API_KEY=your-key docker compose up --build
```

## 3. Optional checks

```bash
# backend/ (dev tools: pip install -r requirements-dev.txt, or poetry install)
pytest && ruff check . && mypy .

# frontend/
npm run lint && npm run typecheck && npm run build

# repo root, with the backend running
node scripts/test_mcp.js
```
