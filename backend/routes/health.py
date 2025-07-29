"""Health check endpoints."""
from fastapi import APIRouter
from services.embedding_service import embedding_service
from services.vector_store import InMemoryVectorStore
from utils.cache import _products_cache
from config.settings import IS_VERCEL, PROMPTS_CONFIG

router = APIRouter(tags=["Health"])

# Global instances (will be injected from main.py)
vector_store: InMemoryVectorStore = None

def init_health_routes(vs: InMemoryVectorStore):
    """Initialize health routes with dependencies."""
    global vector_store
    vector_store = vs

@router.get("/")
def index():
    """
    Describe the MCP tool server and its key endpoints.
    """
    embeddings_available = embedding_service.is_ready()
    vector_count = vector_store.count() if vector_store else 0
    
    return {
        "message": "Welcome to the MCP Product Tool Server (FastAPI)",
        "purpose": "Expose product catalog functions as MCP tools (list_products, search_products, semantic_product_search).",
        "deployment": "Vercel Serverless" if IS_VERCEL else "Local Development", 
        "vector_store": {
            "type": "In-Memory Vector Store (OpenAI Embeddings)",
            "embeddings_ready": "Available" if embeddings_available else "Unavailable",
            "document_count": vector_count,
            "bundle_size": "~25-30MB (No external vector DB!)"
        },
        "mcp": {
            "discovery_endpoint": "/.well-known/mcp.json",
            "json_rpc_endpoint": "/mcp",
            "tools": [t.get("name") for t in PROMPTS_CONFIG["mcp_discovery"].get("tools", [])],
        },
        "rest_endpoints": {
            "list_products": "/products",
            "search_products": "/products/search",
            "semantic_search": "/products/semantic-search",
            "health_check": "/healthz",
        },
        "notes": [
            "In-memory vector search with OpenAI embeddings",
            "No external vector database dependencies",
            "Fast cosine similarity search",
            "Perfect for Vercel serverless deployment"
        ],
        "docs": {
            "openapi_json": "/openapi.json",
            "swagger_ui": "/docs",
            "redoc": "/redoc",
        },
        "version": "0.1.0",
    }

@router.get("/healthz")
def healthz():
    """Health check endpoint."""
    embeddings_available = embedding_service.is_ready()
    vector_count = vector_store.count() if vector_store else 0
    
    return {
        "ok": True, 
        "deployment": "Vercel Serverless" if IS_VERCEL else "Local Development",
        "vector_store": {
            "type": "In-Memory (OpenAI Embeddings)",
            "embeddings_ready": embeddings_available,
            "document_count": vector_count,
            "vector_search_available": embeddings_available and vector_count > 0
        },
        "products_loaded": _products_cache is not None,
        "available_methods": ["list_products", "search_products", "semantic_product_search"],
        "approach": "Pure OpenAI Embeddings + In-Memory Cosine Similarity",
        "bundle_optimized": True,
        "estimated_size": "~25-30MB"
    }