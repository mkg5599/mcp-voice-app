"""Index and health endpoints."""
from fastapi import APIRouter

from config.settings import APP_VERSION, EMBEDDING_MODEL, IS_VERCEL
from mcp_server import TOOL_NAMES
from services.product_service import product_service
from utils.cache import load_products

router = APIRouter(tags=["Health"])


@router.get("/")
def index() -> dict:
    return {
        "name": "Product Catalog MCP Server",
        "version": APP_VERSION,
        "mcp": {
            "endpoint": "/mcp",
            "transport": "streamable-http (stateless, JSON responses)",
            "tools": TOOL_NAMES,
            "resources": ["catalog://products"],
            "prompts": ["shopping_assistant"],
        },
        "rest_endpoints": {
            "list_products": "GET /products",
            "get_product": "GET /products/{id}",
            "search_products": "POST /products/search",
            "semantic_search": "POST /products/semantic-search",
            "health": "GET /healthz",
        },
        "docs": {"swagger_ui": "/docs", "openapi_json": "/openapi.json"},
    }


@router.get("/healthz")
def healthz() -> dict:
    return {
        "ok": True,
        "version": APP_VERSION,
        "deployment": "vercel" if IS_VERCEL else "local",
        "products": len(load_products()),
        "semantic_search": {
            "embedding_model": EMBEDDING_MODEL,
            "api_key_configured": product_service.embeddings.is_configured(),
            # The index is built lazily on the first semantic search in each process.
            "index_size": product_service.vector_store.count(),
            "last_error": product_service.index_error,
        },
        "mcp_tools": TOOL_NAMES,
    }
