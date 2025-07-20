# [Agentic Product App - Based on Model Context Protocol](https://mcp-voice-app.manojkumargummadi.com/)

An end-to-end **voice + natural language product search** application demonstrating:

* **Next.js (React + TypeScript)** acting as an *MCP Host* (LLM orchestration + Whisper transcription).
* **FastAPI (Python)** as a **pure MCP Tool Server** exposing structured product functions only.
* **Google Gemini (@google/genai)** for semantic interpretation + *automatic function calling*.
* **OpenAI Whisper (via Next.js serverless route)** for speech-to-text transcription.
* **JSON-RPC 2.0 over HTTP** (`/mcp`) for tool invocation.
* **MCP-style discovery** via `/.well-known/mcp.json`.
* **Docker Compose** for local multi-service orchestration.

> This project shows how **Model Context Protocol principles** let you keep **domain tools** (product catalog functions) decoupled, while the **host** layers on voice input + LLM function calling. The backend is a reusable tool server.

---

## Table of Contents

1. [Conceptual Overview](#conceptual-overview)  
2. [Architecture](#architecture)  
3. [Execution Flow](#execution-flow)  
4. [MCP Integration Details](#mcp-integration-details)  
5. [Gemini Function Calling Flow](#gemini-function-calling-flow)  
6. [Whisper Speech Transcription](#whisper-speech-transcription)  
7. [Repository Structure](#repository-structure)  
8. [Environment Variables](#environment-variables)  
9. [Local Development](#local-development)  
10. [Docker & Deployment](#docker--deployment)  
11. [Extending the Catalog / Tools](#extending-the-catalog--tools)  
12. [Security & Hardening](#security--hardening)  
13. [Troubleshooting](#troubleshooting)  
14. [Roadmap / Future Enhancements](#roadmap--future-enhancements)  
15. [Contributing](#contributing)  
16. [License](#license)

---

## Conceptual Overview

| Layer | Role | Technologies | Key Responsibility |
|-------|------|--------------|--------------------|
| **Host (UI)** | Accept user text / voice; orchestrate LLM + tools | Next.js, TypeScript, @google/genai, Whisper | Transcribe audio → text; negotiate Gemini function calls; render results |
| **LLM** | Natural language understanding + tool selection | Gemini 2.0 Flash | Decide whether to call a tool; summarize tool output |
| **Tool Server** | Deterministic domain functions | FastAPI + JSON-RPC façade | Provide `list_products`, `search_products` |
| **MCP Discovery** | Tool metadata | `/.well-known/mcp.json` | Advertise schemas for dynamic functionDeclarations |

**Change vs earlier version:** The **backend no longer contains `/transcribe`**—speech belongs firmly to the host layer.

---

## Architecture

**High-Level (Current):**

```
Browser (React UI)
   │ (MediaRecorder audio)
   ├─ POST /api/transcribe  (Next.js serverless → Whisper)
   │
   └─ POST /api/chat  (Gemini host logic)
          1. Fetch & cache backend /.well-known/mcp.json
          2. Build functionDeclarations
          3. Gemini generateContent (mode=ANY)
          4. If functionCall -> POST backend /mcp (JSON-RPC)
          5. Wrap tool result as functionResponse
          6. Gemini second call (mode=NONE)
          7. Return { message, products? }
Backend (FastAPI Tool Server)
   ├─ /products
   ├─ /products/search
   ├─ /mcp
   ├─ /.well-known/mcp.json
   └─ /healthz
```

**Why remove backend transcription?**

* Keeps the **tool server reusable** by other agents without Whisper dependencies.
* Reduces attack surface and secret sprawl—`OPENAI_API_KEY` exists only in host.
* Clear separation of **pure data tools** vs **orchestration / AI enrichment**.

---

## Execution Flow

1. **User Input (Voice or Text)**  
   * Voice: Browser records → `/api/transcribe` → Whisper → text.  
   * Text: Directly sent to `/api/chat`.

2. **Discovery**: Host fetches `/.well-known/mcp.json`, converts each tool to Gemini `functionDeclarations`.

3. **First Gemini Call** (`mode=ANY`): Model may return answer or a `functionCall`.

4. **Tool Invocation**: Host calls backend `/mcp` JSON-RPC to execute domain function.

5. **Second Gemini Call** (`mode=NONE`): Host includes `functionResponse` so Gemini composes a natural language summary.

6. **UI Update**: Host returns `{products?, message}` → React renders product cards + summary text.

---

## MCP Integration Details

| Component | Responsibility |
|----------|----------------|
| Backend `/.well-known/mcp.json` | Canonical tool schemas. |
| Backend `/mcp` | JSON-RPC 2.0 payload dispatch. |
| FastAPI functions | Implement deterministic business logic. |
| Frontend `mcpHost.ts` | Fetch & cache discovery, generate tool declarations. |
| Frontend `/api/chat` | Two-phase Gemini function-calling orchestration. |

> Additional hosts (CLI, Slack bot, etc.) can reuse the backend by replicating: **discover → supply tools → call JSON-RPC**.

---

## Gemini Function Calling Flow

| Phase | Input | Config Mode | Output |
|-------|-------|-------------|--------|
| 1 | User text + functionDeclarations | `ANY` | Optional `functionCalls[]` |
| 2 | JSON-RPC tool result | — | — |
| 3 | Conversation + `functionResponse` | `NONE` | Final natural language answer |

`mode=NONE` prevents recursive calls and reduces latency.

---

## Whisper Speech Transcription

| Step | Detail |
|------|--------|
| Recording | Browser `MediaRecorder` → `Blob` (`audio/webm`) |
| Upload | POST `/api/transcribe` (Next.js) |
| Transcription | `openai.audio.transcriptions.create` (`whisper-1`) |
| Response | `{ text }` returned to UI |
| Backend Impact | None (backend is tool-only) |

---

## Repository Structure

```
root/
├─ frontend/
│  ├─ src/app/api/chat/route.ts        # Gemini orchestration (MCP Host)
│  ├─ src/app/api/transcribe/route.ts  # Whisper transcription (host only)
│  ├─ src/app/page.tsx                 # UI
│  ├─ src/lib/mcpHost.ts               # Discovery + tool invocation helper
│  └─ components/...
├─ backend/
│  ├─ main.py            # FastAPI MCP tool server (products + discovery)
│  ├─ data/products.json
│  ├─ prompts.yml        # discovery schemas (transcribe section now unused)
│  ├─ pyproject.toml
├─ docker-compose.yml
└─ README.md
```

---

## Environment Variables

| Variable | Needed In | Purpose |
|----------|-----------|---------|
| `GEMINI_API_KEY` | Frontend server runtime | Gemini model access |
| `OPENAI_API_KEY` | Frontend server runtime | Whisper transcription |
| `BACKEND_INTERNAL_URL` | Frontend server runtime | Base URL of FastAPI tool server |

> No transcription secrets reside in the backend now.

---

## Local Development

### Backend

```bash
cd backend
poetry install
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install   # or pnpm install
BACKEND_INTERNAL_URL=http://localhost:8000 \
GEMINI_API_KEY=your_gemini_key \
OPENAI_API_KEY=your_openai_key \
npm run dev
```

Open: http://localhost:3000

### Docker

```bash
docker compose up --build
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
```

---

## Docker & Deployment

| Service | Notes |
|---------|-------|
| Backend (FastAPI) | Stateless; horizontally scalable; can be reused by many hosts. |
| Frontend (Next.js) | Deployed to Vercel; provides `/api/chat` + `/api/transcribe`. |
| Separation | Clean host/tool divide; easier migration to additional hosts. |

---

## Extending the Catalog / Tools

1. Add Python function (e.g. `get_product_by_id`).
2. Register in `/mcp` method mapping.
3. Add schema entry to `prompts.yml` under `mcp_discovery.tools`.
4. Redeploy backend.
5. Host auto-discovers new tool; prompt Gemini to use it.

**Tip:** Provide clear, discriminative descriptions so the model selects the correct tool.

---

## Security & Hardening

| Concern | Mitigation |
|---------|-----------|
| Secret leakage | Server-only env vars; no `NEXT_PUBLIC_*` secrets. |
| Overbroad CORS | Limit `ALLOWED_ORIGINS` in backend. |
| Tool misuse | Use `allowedFunctionNames` in production if needed. |
| Large responses | Add pagination to `search_products`. |
| Rate abuse (transcribe) | Add simple rate limiting or auth token at host. |
| Prompt injection via tool data | Sanitize product inputs before storing. |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `BACKEND_INTERNAL_URL not defined` | Missing env during build/runtime | Add to deployment env & rebuild |
| No `functionCalls` | Model didn't see need for tools | Strengthen tool descriptions / user prompt |
| 500 in transcription | Missing or invalid `OPENAI_API_KEY` | Set correct key & redeploy |
| Case-sensitive city filter | Old backend version | Redeploy updated backend |
| CORS errors | Origin mismatch | Update backend `ALLOWED_ORIGINS` |

---

## Roadmap / Future Enhancements

| Area | Idea |
|------|------|
| Retrieval | Add vector DB + semantic search tool. |
| Streaming | Use `generateContentStream` for progressive answers. |
| Observability | Integrate OpenTelemetry traces. |
| Auth | JWT or API keys for tool calls. |
| TTS | Add speech synthesis for responses. |
| Multi-host | CLI or Slack bot reusing same backend. |
| Pagination | Add `limit/offset` to tool responses. |
| Analytics | Persist tool call metrics dashboards. |

---

## Contributing

1. Fork & branch `feature/<name>`.
2. Implement tool + schema.
3. Lint & test:
   ```bash
   poetry run pytest
   npm run lint
   ```
4. PR with example prompt + output.

---

## License

MIT

---

**Questions / Ideas?** Open an issue.  
Enjoy building with **MCP + Gemini + Whisper** 🚀
