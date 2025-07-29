"""MCP JSON-RPC endpoints."""
import json
import time
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from models.requests import JsonRpcRequest, ProductSearch, SemanticSearch
from services.product_service import ProductService
from services.vector_store import InMemoryVectorStore
from services.embedding_service import embedding_service
from config.settings import IS_VERCEL, PROMPTS_CONFIG

router = APIRouter(tags=["MCP"])

# Global instances (will be injected from main.py)
product_service: ProductService = None

def init_mcp_routes(vector_store: InMemoryVectorStore):
    """Initialize MCP routes with dependencies."""
    global product_service
    product_service = ProductService(vector_store)

@router.post("/mcp")
async def mcp_endpoint(req: JsonRpcRequest):
    """
    JSON-RPC 2.0 endpoint for MCP tool invocation.
    
    Supported methods:
    - list_products: Get all products
    - search_products: Filter products by criteria
    - semantic_product_search: Natural language product search via in-memory vector store
    """
    if req.jsonrpc != "2.0":
        return JSONResponse(
            {
                "jsonrpc": "2.0",
                "error": {"code": -32600, "message": "Invalid JSON-RPC version"},
                "id": req.id,
            },
            status_code=400,
        )

    # Define async routing
    async def route_method(method: str, params: dict):
        if method == "list_products":
            return product_service.list_products()
        elif method == "search_products":
            return product_service.search_products(ProductSearch(**(params or {})))
        elif method == "semantic_product_search":
            return await product_service.semantic_search(SemanticSearch(**(params or {})))
        else:
            raise ValueError(f"Method '{method}' not found")

    valid_methods = ["list_products", "search_products", "semantic_product_search"]
    if req.method not in valid_methods:
        return JSONResponse(
            {
                "jsonrpc": "2.0",
                "error": {"code": -32601, "message": f"Method '{req.method}' not found. Available methods: {valid_methods}"},
                "id": req.id,
            },
            status_code=404,
        )

    t0 = time.time()
    try:
        result = await route_method(req.method, req.params)
        duration_ms = int((time.time() - t0) * 1000)
        
        vector_available = embedding_service.is_ready() and product_service.vector_store.count() > 0
        
        print(json.dumps({
            "evt": "json_rpc_request",
            "method": req.method,
            "params": req.params,
            "result_count": len(result) if isinstance(result, list) else None,
            "duration_ms": duration_ms,
            "vector_store": f"in_memory:{vector_available}",
            "deployment": "vercel" if IS_VERCEL else "local",
            "bundle_optimized": True
        }))
        return {"jsonrpc": "2.0", "result": result, "id": req.id}
    except Exception as exc:
        duration_ms = int((time.time() - t0) * 1000)
        print(f"JSON-RPC error: {exc}")
        import traceback
        traceback.print_exc()
        print(json.dumps({
            "evt": "json_rpc_request_error",
            "method": req.method,
            "params": req.params,
            "duration_ms": duration_ms,
            "error": str(exc)
        }))
        return JSONResponse(
            {
                "jsonrpc": "2.0",
                "error": {"code": -32000, "message": str(exc)},
                "id": req.id,
            },
            status_code=500,
        )

@router.options("/mcp")
def mcp_options():
    """Handle CORS preflight requests for /mcp endpoint."""
    return JSONResponse(
        {"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
    )

@router.get("/.well-known/mcp.json")
def get_mcp():
    """MCP discovery endpoint - returns available tools and their schemas."""
    return PROMPTS_CONFIG["mcp_discovery"]