"""FastAPI entry point: REST endpoints plus the MCP server at /mcp."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.routing import Route

from config.settings import ALLOWED_ORIGINS, APP_VERSION
from mcp_server import mcp_http_endpoint
from routes import health, products

app = FastAPI(
    title="Product Catalog MCP Server",
    version=APP_VERSION,
    description=(
        "A product catalog exposed as a Model Context Protocol server (Streamable HTTP at /mcp) "
        "and as a plain REST API. Semantic search uses Gemini embeddings with an in-memory vector index."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Mcp-Session-Id", "Mcp-Protocol-Version"],
)

app.include_router(health.router)
app.include_router(products.router)

# MCP Streamable HTTP endpoint (official SDK). Registered as a raw ASGI route so the SDK
# handles the protocol (POST for JSON-RPC, GET/DELETE answered per the spec).
app.router.routes.append(Route("/mcp", endpoint=mcp_http_endpoint, methods=["GET", "POST", "DELETE"]))
