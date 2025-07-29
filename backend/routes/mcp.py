"""MCP JSON-RPC endpoints."""
import json
import time
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from models.requests import JsonRpcRequest, ProductSearch, SemanticSearch
from services.product_service import ProductService
from services.vector_store import InMemoryVectorStore
from services.embedding_service import embedding_service
from config.settings import IS_VERCEL, PROMPTS_CONFIG

router = APIRouter(tags=["MCP"])

# Global instances (will be injected from main.py)
product_service: Optional[ProductService] = None

def init_mcp_routes(vector_store: InMemoryVectorStore) -> None:
    """Initialize MCP routes with dependencies."""
    global product_service
    product_service = ProductService(vector_store)
    print(f"MCP routes initialized with product_service: {product_service is not None}")

def get_product_service() -> ProductService:
    """Get the product service instance with proper error handling."""
    if product_service is None:
        raise HTTPException(
            status_code=500,
            detail="Product service not initialized. Application startup may have failed."
        )
    return product_service

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

    # Define async routing with proper service validation
    async def route_method(method: str, params: Optional[Dict[str, Any]]):
        service = get_product_service()
        
        if method == "list_products":
            return service.list_products()
        elif method == "search_products":
            return service.search_products(ProductSearch(**(params or {})))
        elif method == "semantic_product_search":
            return await service.semantic_search(SemanticSearch(**(params or {})))
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
        
        # Safe check for vector store availability
        vector_available = False
        try:
            service = get_product_service()
            vector_available = embedding_service.is_ready() and service.vector_store.count() > 0
        except (HTTPException, AttributeError, RuntimeError):
            vector_available = False
        
        print(json.dumps({
            "evt": "json_rpc_request",
            "method": req.method,
            "params": req.params,
            "result_count": len(result) if isinstance(result, list) else None,
            "duration_ms": duration_ms,
            "vector_store": f"in_memory:{vector_available}",
            "deployment": "vercel" if IS_VERCEL else "local",
            "bundle_optimized": True,
            "service_initialized": product_service is not None
        }))
        return {"jsonrpc": "2.0", "result": result, "id": req.id}
    
    except HTTPException as http_exc:
        # Handle service initialization errors
        duration_ms = int((time.time() - t0) * 1000)
        error_msg = f"Service initialization error: {http_exc.detail}"
        print(f"JSON-RPC HTTP error: {error_msg}")
        print(json.dumps({
            "evt": "json_rpc_request_error",
            "method": req.method,
            "params": req.params,
            "duration_ms": duration_ms,
            "error": error_msg,
            "error_type": "service_initialization",
            "service_initialized": product_service is not None
        }))
        return JSONResponse(
            {
                "jsonrpc": "2.0",
                "error": {"code": -32001, "message": error_msg},
                "id": req.id,
            },
            status_code=500,
        )
    
    except (ValueError, TypeError, AttributeError, RuntimeError) as exc:
        # Handle specific known errors
        duration_ms = int((time.time() - t0) * 1000)
        error_msg = str(exc)
        print(f"JSON-RPC error: {error_msg}")
        import traceback
        traceback.print_exc()
        print(json.dumps({
            "evt": "json_rpc_request_error",
            "method": req.method,
            "params": req.params,
            "duration_ms": duration_ms,
            "error": error_msg,
            "error_type": "service_error",
            "service_initialized": product_service is not None
        }))
        return JSONResponse(
            {
                "jsonrpc": "2.0",
                "error": {"code": -32000, "message": error_msg},
                "id": req.id,
            },
            status_code=500,
        )
    
    except Exception as exc:
        # Handle any other unexpected errors
        duration_ms = int((time.time() - t0) * 1000)
        error_msg = f"Unexpected error: {str(exc)}"
        print(f"JSON-RPC unexpected error: {error_msg}")
        import traceback
        traceback.print_exc()
        print(json.dumps({
            "evt": "json_rpc_request_error",
            "method": req.method,
            "params": req.params,
            "duration_ms": duration_ms,
            "error": error_msg,
            "error_type": "unexpected",
            "service_initialized": product_service is not None
        }))
        return JSONResponse(
            {
                "jsonrpc": "2.0",
                "error": {"code": -32000, "message": "Internal server error"},
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

# Health check endpoint for MCP service
@router.get("/mcp/health")
def mcp_health():
    """Health check specifically for MCP service initialization."""
    return {
        "service_initialized": product_service is not None,
        "embedding_service_ready": embedding_service.is_ready(),
        "vector_store_count": product_service.vector_store.count() if product_service else 0,
        "available_methods": ["list_products", "search_products", "semantic_product_search"]
    }