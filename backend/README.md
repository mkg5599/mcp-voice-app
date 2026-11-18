# Backend: product catalog MCP server

FastAPI app that serves a small product catalog two ways:

- **MCP** at `/mcp`: Streamable HTTP (stateless, JSON responses), built with the official MCP Python SDK.
  Tools `list_products`, `search_products`, `semantic_product_search`, `get_product`; resource
  `catalog://products`; prompt `shopping_assistant`.
- **REST**: `GET /products`, `GET /products/{id}`, `POST /products/search`, `POST /products/semantic-search`,
  plus `GET /`, `GET /healthz` and `GET /docs`.

Semantic search uses Gemini `gemini-embedding-001` embeddings with an in-memory index built on first use,
and falls back to keyword matching without an API key. There's no LLM on the backend.

## Run

```bash
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # GEMINI_API_KEY is optional; it enables semantic search
uvicorn main:app --reload --port 8000
```

## Check

```bash
pip install pytest anyio ruff mypy   # or: poetry install
pytest
ruff check .
mypy .
```

## Layout

| Path | Contents |
|------|----------|
| `main.py` | FastAPI app, CORS, routers, `/mcp` route |
| `mcp_server.py` | MCP tools, resource, prompt, per-request Streamable HTTP endpoint |
| `config/settings.py` | Settings from environment variables |
| `models/requests.py` | Pydantic models shared by REST and MCP |
| `routes/` | `health.py`, `products.py` |
| `services/` | `product_service.py` (filters, search, fallback), `embedding_service.py`, `vector_store.py` |
| `data/products.json` | The catalog |
| `tests/` | pytest suite |

Environment variables, deployment and client setup are in the [root README](../README.md); protocol
details are in [docs/mcp.md](../docs/mcp.md) and [docs/semantic_search.md](../docs/semantic_search.md).
