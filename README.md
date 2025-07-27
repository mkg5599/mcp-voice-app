# [Agentic Product App - Based on Model Context Protocol](https://mcp-voice-app.manojkumargummadi.com/)

An end-to-end **voice + natural language product search** application demonstrating:

* **Next.js (React + TypeScript)** acting as an *MCP Host* (LLM orchestration + Whisper transcription).
* **FastAPI (Python)** as a **pure MCP Tool Server** exposing structured product functions and semantic search.
* **Google Gemini 2.0 Flash (@google/genai)** for semantic interpretation + *automatic function calling*.
* **OpenAI Whisper (via Next.js serverless route)** for speech-to-text transcription.
* **Vector RAG Search** powered by LangChain + ChromaDB + OpenAI Embeddings for semantic product discovery.
* **JSON-RPC 2.0 over HTTP** (`/mcp`) for tool invocation.
* **MCP-style discovery** via `/.well-known/mcp.json`.
* **Docker Compose** for local multi-service orchestration.

> This project shows how **Model Context Protocol principles** let you keep **domain tools** (product catalog functions) decoupled, while the **host** layers on voice input + LLM function calling. The backend is a reusable tool server with semantic search capabilities.

---

## Table of Contents

1. [Conceptual Overview](#conceptual-overview)  
2. [Architecture](#architecture)  
3. [Execution Flow](#execution-flow)  
4. [MCP Integration Details](#mcp-integration-details)  
5. [Gemini Function Calling Flow](#gemini-function-calling-flow)  
6. [Whisper Speech Transcription](#whisper-speech-transcription)  
7. [Semantic Search & RAG](#semantic-search--rag)
8. [Repository Structure](#repository-structure)  
9. [Environment Variables](#environment-variables)  
10. [Local Development](#local-development)  
11. [Docker & Deployment](#docker--deployment)  
12. [API Endpoints](#api-endpoints)
13. [Extending the Catalog / Tools](#extending-the-catalog--tools)  
14. [Security & Hardening](#security--hardening)  
15. [Troubleshooting](#troubleshooting)  
16. [Technology Stack](#technology-stack)
17. [Roadmap / Future Enhancements](#roadmap--future-enhancements)  
18. [Contributing](#contributing)  
19. [License](#license)

---

## Conceptual Overview

| Layer | Role | Technologies | Key Responsibility |
|-------|------|--------------|--------------------|
| **Host (UI)** | Accept user text / voice; orchestrate LLM + tools | Next.js, TypeScript, @google/genai, Whisper | Transcribe audio → text; negotiate Gemini function calls; render results |
| **LLM** | Natural language understanding + tool selection | Gemini 2.0 Flash Exp | Decide whether to call a tool; summarize tool output |
| **Tool Server** | Deterministic domain functions + semantic search | FastAPI + JSON-RPC façade + LangChain + ChromaDB | Provide `list_products`, `search_products`, `semantic_product_search` |
| **MCP Discovery** | Tool metadata | `/.well-known/mcp.json` | Advertise schemas for dynamic functionDeclarations |
| **Vector Store** | Semantic product embeddings | OpenAI Embeddings + ChromaDB | Enable natural language product discovery |

**Change vs earlier version:** The **backend no longer contains `/transcribe`**—speech belongs firmly to the host layer. **Added semantic search** with vector embeddings for natural language queries.

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
   ├─ GET /products
   ├─ POST /products/search
   ├─ POST /products/semantic-search  (NEW)
   ├─ POST /mcp  (JSON-RPC 2.0)
   ├─ GET /.well-known/mcp.json
   ├─ /.chromadb/  (vector store)
   └─ GET /healthz
```

**Vector Store Flow:**
```
Startup → Load products.json → Generate embeddings → Store in ChromaDB
Query → Embed user query → Similarity search → Return ranked products
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

3. **First Gemini Call** (`mode=ANY`): Model may return answer or a `functionCall` (including semantic search).

4. **Tool Invocation**: Host calls backend `/mcp` JSON-RPC to execute domain function or semantic search.

5. **Second Gemini Call** (`mode=NONE`): Host includes `functionResponse` so Gemini composes a natural language summary.

6. **UI Update**: Host returns `{products?, message}` → React renders product cards + summary text.

---

## MCP Integration Details

| Component | Responsibility |
|----------|----------------|
| Backend `/.well-known/mcp.json` | Canonical tool schemas (now includes semantic search). |
| Backend `/mcp` | JSON-RPC 2.0 payload dispatch. |
| FastAPI functions | Implement deterministic business logic + vector search. |
| Frontend `mcpHost.ts` | Fetch & cache discovery, generate tool declarations. |
| Frontend `/api/chat` | Two-phase Gemini function-calling orchestration. |
| ChromaDB | Persistent vector storage for semantic search. |

> Additional hosts (CLI, Slack bot, etc.) can reuse the backend by replicating: **discover → supply tools → call JSON-RPC**.

---

## Gemini Function Calling Flow

| Phase | Input | Config Mode | Output |
|-------|-------|-------------|--------|
| 1 | User text + functionDeclarations | `ANY` | Optional `functionCalls[]` (list, search, or semantic) |
| 2 | JSON-RPC tool result | — | — |
| 3 | Conversation + `functionResponse` | `NONE` | Final natural language answer |

`mode=NONE` prevents recursive calls and reduces latency.

**Tool Selection Logic:**
- **list_products**: "show all products", "what's available"
- **search_products**: "red items under $50", "products in Portland"  
- **semantic_product_search**: "comfortable hoodies", "warm winter clothing"

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

## Semantic Search & RAG

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Embeddings** | OpenAI `text-embedding-ada-002` | Convert product data to vectors |
| **Vector Store** | ChromaDB | Persistent similarity search |
| **Framework** | LangChain | Vector store abstraction |
| **Documents** | Product name + description + tags + city | Rich context for embeddings |

**Features:**
- **Natural Language Queries**: "comfortable black hoodie for streetwear"
- **Similarity Scoring**: Results ranked by cosine similarity
- **Persistent Storage**: Vector store survives restarts
- **Fast Queries**: ~100-200ms response time

**Example Query Flow:**
```
User: "warm winter clothing"
→ Embed query with OpenAI
→ ChromaDB similarity search  
→ Return products with scores
→ Gemini summarizes results
```

For detailed setup and configuration, see [docs/semantic_search.md](./docs/semantic_search.md).

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
│  ├─ main.py            # FastAPI MCP tool server (products + semantic search)
│  ├─ data/products.json # Enhanced product catalog with descriptions
│  ├─ prompts.yml        # discovery schemas (includes semantic search)
│  ├─ .chromadb/        # vector store (auto-generated)
│  ├─ tests/            # unit tests including semantic search
│  ├─ pyproject.toml    # includes LangChain + ChromaDB dependencies
├─ docs/
│  └─ semantic_search.md # semantic search documentation
├─ docker-compose.yml
└─ README.md
```

---

## Environment Variables

| Variable | Needed In | Purpose |
|----------|-----------|---------|
| `GEMINI_API_KEY` | Frontend server runtime | Gemini model access |
| `OPENAI_API_KEY` | Frontend server runtime + Backend startup | Whisper transcription + embeddings |
| `BACKEND_INTERNAL_URL` | Frontend server runtime | Base URL of FastAPI tool server |

> **Note:** `OPENAI_API_KEY` is needed in backend for embedding generation during startup.

---

## Local Development

### Backend

```bash
cd backend
poetry install
# Vector store will auto-initialize on first startup
OPENAI_API_KEY=your_openai_key uvicorn main:app --reload --port 8000
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

### Testing Semantic Search

```bash
cd backend
poetry run pytest tests/test_semantic_search.py -v
```

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
| Backend (FastAPI) | Stateless; horizontally scalable; can be reused by many hosts. Includes vector store. |
| Frontend (Next.js) | Deployed to Vercel; provides `/api/chat` + `/api/transcribe`. |
| Separation | Clean host/tool divide; easier migration to additional hosts. |
| Vector Store | ChromaDB persists to disk; survives container restarts. |

---

## API Endpoints

### Backend (FastAPI Tool Server)

| Method | Endpoint | Description | Content-Type |
|--------|----------|-------------|--------------|
| `GET` | `/` | Service index and documentation | `application/json` |
| `GET` | `/products` | List all products | `application/json` |
| `POST` | `/products/search` | Filter products by criteria | `application/json` |
| `POST` | `/products/semantic-search` | Natural language product search | `application/json` |
| `POST` | `/mcp` | **JSON-RPC 2.0 endpoint for MCP tools** | `application/json` |
| `GET` | `/.well-known/mcp.json` | MCP tool discovery | `application/json` |
| `GET` | `/healthz` | Health check | `application/json` |
| `GET` | `/docs` | Interactive API documentation | `text/html` |

### MCP JSON-RPC Methods

The `/mcp` endpoint accepts JSON-RPC 2.0 requests with these methods:

```json
{
  "jsonrpc": "2.0",
  "method": "list_products",
  "params": {},
  "id": 1
}
```

**Available Methods:**
- `list_products`: Get all products (no parameters)
- `search_products`: Filter by `colors`, `city`, `min_price`, `max_price`
- `semantic_product_search`: Search by natural language `query` and optional `top_k`

### Frontend (Next.js Host)

| Method | Endpoint | Description | Content-Type |
|--------|----------|-------------|--------------|
| `POST` | `/api/chat` | Gemini orchestration with tool calling | `application/json` |
| `POST` | `/api/transcribe` | Whisper speech-to-text | `multipart/form-data` |

**Example MCP Tool Call:**
```bash
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "semantic_product_search",
    "params": {"query": "comfortable black hoodie", "top_k": 3},
    "id": 1
  }'
```

---

## Extending the Catalog / Tools

1. Add Python function (e.g. `get_product_reviews`).
2. Register in `/mcp` method mapping.
3. Add schema entry to `prompts.yml` under `mcp_discovery.tools`.
4. **For semantic search**: Update product descriptions and rebuild vector store.
5. Redeploy backend.
6. Host auto-discovers new tool; prompt Gemini to use it.

**Vector Store Refresh:**
```bash
rm -rf backend/.chromadb
# Restart backend to rebuild embeddings
```

**Tip:** Provide clear, discriminative descriptions so the model selects the correct tool.

---

## Security & Hardening

| Concern | Mitigation |
|---------|-----------|
| Secret leakage | Server-only env vars; no `NEXT_PUBLIC_*` secrets. |
| Overbroad CORS | Limit `ALLOWED_ORIGINS` in backend. |
| Tool misuse | Use `allowedFunctionNames` in production if needed. |
| Large responses | Add pagination to `search_products` and semantic search. |
| Rate abuse (transcribe) | Add simple rate limiting or auth token at host. |
| Prompt injection via tool data | Sanitize product inputs before storing. |
| Vector store access | Secure ChromaDB directory permissions. |
| Embedding costs | Monitor OpenAI API usage for embedding generation. |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `BACKEND_INTERNAL_URL not defined` | Missing env during build/runtime | Add to deployment env & rebuild |
| No `functionCalls` | Model didn't see need for tools | Strengthen tool descriptions / user prompt |
| 500 in transcription | Missing or invalid `OPENAI_API_KEY` | Set correct key & redeploy |
| Case-sensitive city filter | Old backend version | Redeploy updated backend |
| CORS errors | Origin mismatch | Update backend `ALLOWED_ORIGINS` |
| `Vector store not initialized` | Missing `OPENAI_API_KEY` in backend | Set key in backend environment |
| Poor semantic search results | Weak product descriptions | Enhance product data & rebuild vectors |
| Slow semantic search | Large vector store | Consider pagination or result caching |
| **405 Method Not Allowed on `/mcp`** | Incorrect HTTP method or CORS issue | Ensure POST method, check CORS headers |

---

## Technology Stack

### Frontend (MCP Host)
| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 14.x | React framework with serverless API routes |
| **React** | 18.x | UI components and state management |
| **TypeScript** | 5.x | Type safety and developer experience |
| **@google/genai** | Latest | Google Gemini 2.0 Flash API client |
| **Tailwind CSS** | 3.x | Utility-first styling |
| **OpenAI API** | 4.x | Whisper speech-to-text transcription |

### Backend (MCP Tool Server)
| Technology | Version | Purpose |
|------------|---------|---------|
| **FastAPI** | 0.116.x | High-performance async Python web framework |
| **Python** | 3.13 | Runtime environment |
| **Pydantic** | 2.x | Data validation and serialization |
| **LangChain** | 0.2.x | Framework for LLM applications |
| **LangChain Community** | 0.2.x | Community integrations and tools |
| **LangChain OpenAI** | 0.1.x | OpenAI-specific LangChain components |
| **ChromaDB** | 0.4.x | Vector database for embeddings |
| **OpenAI Embeddings** | Via LangChain | Text embedding generation |
| **PyYAML** | 6.x | Configuration file parsing |
| **Python-dotenv** | 1.x | Environment variable management |
| **Uvicorn** | 0.35.x | ASGI server |

### DevOps & Infrastructure
| Technology | Version | Purpose |
|------------|---------|---------|
| **Docker** | Latest | Containerization |
| **Docker Compose** | Latest | Multi-service orchestration |
| **Poetry** | 1.8.x | Python dependency management |
| **npm/pnpm** | Latest | Node.js package management |

### AI & ML Services
| Service | Model | Purpose |
|---------|-------|---------|
| **Google Gemini** | 2.0 Flash Exp | Function calling and natural language understanding |
| **OpenAI Whisper** | whisper-1 | Speech-to-text transcription |
| **OpenAI Embeddings** | text-embedding-ada-002 | Vector embeddings for semantic search |

### Protocols & Standards
| Protocol | Purpose |
|----------|---------|
| **JSON-RPC 2.0** | Tool invocation protocol |
| **Model Context Protocol (MCP)** | Tool discovery and metadata |
| **HTTP/REST** | API communication |
| **WebRTC/MediaRecorder** | Browser audio recording |

---

## Roadmap / Future Enhancements

| Area | Idea |
|------|------|
| ~~Retrieval~~ | ~~Add vector DB + semantic search tool.~~ ✅ **COMPLETED** |
| Streaming | Use `generateContentStream` for progressive answers. |
| Observability | Integrate OpenTelemetry traces. |
| Auth | JWT or API keys for tool calls. |
| TTS | Add speech synthesis for responses. |
| Multi-host | CLI or Slack bot reusing same backend. |
| Pagination | Add `limit/offset` to tool responses and semantic search. |
| Analytics | Persist tool call metrics dashboards. |
| Advanced RAG | Add metadata filtering to semantic search. |
| Hybrid Search | Combine keyword and semantic search results. |
| Real-time Updates | Incremental vector store updates for new products. |

---

## Contributing

1. Fork & branch `feature/<name>`.
2. Implement tool + schema.
3. Add tests for new functionality.
4. Lint & test:
   ```bash
   poetry run pytest
   npm run lint
   ```
5. PR with example prompt + output.

---

## License

MIT

---

**Questions / Ideas?** Open an issue.  
Enjoy building with **MCP + Gemini + Whisper + Vector Search** 🚀
