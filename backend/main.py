import json
import os
import time
from typing import Any, Dict, List, Optional

import yaml
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

load_dotenv()

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PRODUCTS_JSON_PATH = os.path.join(BACKEND_DIR, "data", "products.json")
PROMPTS_YAML_PATH = os.path.join(BACKEND_DIR, "prompts.yml")

# ----- Load config (single source) -----
with open(PROMPTS_YAML_PATH, "r", encoding="utf-8") as f:
    PROMPTS_CONFIG = yaml.safe_load(f)

if "mcp_discovery" not in PROMPTS_CONFIG:
    raise RuntimeError("prompts.yml missing 'mcp_discovery' section (mcp_discovery: ...)")

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000"
).split(",")

app = FastAPI(
    title="MCP Product Tool Server",
    version="0.1.0",
    description=(
        "FastAPI backend exposing product catalog functions as MCP-discoverable tools. "
        "Hosts (e.g. Next.js) discover tools at '/.well-known/mcp.json' and call them via JSON-RPC '/mcp'. "
        "No transcription or LLM logic lives here—only domain/tool functionality."
    ),
)

# ----- Root route -----
@app.get("/", summary="Service Index", tags=["meta"])
def index():
    """
    Describe the MCP tool server and its key endpoints.
    """
    return {
        "message": "Welcome to the MCP Product Tool Server (FastAPI)",
        "purpose": "Expose product catalog functions as MCP tools (list_products, search_products).",
        "mcp": {
            "discovery_endpoint": "/.well-known/mcp.json",
            "json_rpc_endpoint": "/mcp",
            "tools": [t.get("name") for t in PROMPTS_CONFIG["mcp_discovery"].get("tools", [])],
        },
        "rest_endpoints": {
            "list_products": "/products",
            "search_products": "/products/search",
            "health_check": "/healthz",
        },
        "notes": [
            "Transcription & LLM orchestration are handled by host(s) (e.g., Next.js).",
            "This server is host-agnostic and reusable by multiple MCP hosts."
        ],
        "docs": {
            "openapi_json": "/openapi.json",
            "swagger_ui": "/docs",
            "redoc": "/redoc",
        },
        "version": app.version,
    }

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----- (Optional) In-memory cache -----
_products_cache: List[Dict[str, Any]] | None = None
_products_mtime: float | None = None


def load_products() -> List[Dict[str, Any]]:
    global _products_cache, _products_mtime
    try:
        stat = os.stat(PRODUCTS_JSON_PATH)
    except FileNotFoundError as e:
        raise RuntimeError("products.json not found") from e
    if _products_cache is None or _products_mtime != stat.st_mtime:
        with open(PRODUCTS_JSON_PATH, "r", encoding="utf-8") as f:
            _products_cache = json.load(f)
        _products_mtime = stat.st_mtime
    return _products_cache  # type: ignore


# ----- Models -----
class ProductSearch(BaseModel):
    colors: Optional[List[str]] = None
    city: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None


class JsonRpcRequest(BaseModel):
    jsonrpc: str = "2.0"
    method: str
    params: Optional[Dict[str, Any]] = None
    id: int | str | None = None


# ----- Tool implementations -----
def list_products_impl() -> List[Dict[str, Any]]:
    return load_products()


def search_products_impl(params: ProductSearch) -> List[Dict[str, Any]]:
    products = load_products()
    results = products

    # Colors (case-insensitive intersection)
    if params.colors:
        want = {c.lower() for c in params.colors if c}
        results = [
            p for p in results
            if want & {c.lower() for c in p.get("colors", [])}
        ]

    # City (case-insensitive exact match)
    if params.city:
        city_l = params.city.lower()
        results = [p for p in results if p.get("city", "").lower() == city_l]

    # Min price
    if params.min_price is not None:
        results = [p for p in results if p.get("price", 0) >= params.min_price]

    # Max price
    if params.max_price is not None:
        results = [p for p in results if p.get("price", 0) <= params.max_price]

    return results


# ----- REST endpoints (direct use / debugging) -----
@app.get("/products")
def list_products():
    return list_products_impl()


@app.post("/products/search")
def search_products(search_params: ProductSearch):
    return search_products_impl(search_params)


# ----- JSON-RPC (MCP façade) -----
@app.post("/mcp")
def mcp_endpoint(req: JsonRpcRequest):
    if req.jsonrpc != "2.0":
        return JSONResponse(
            {
                "jsonrpc": "2.0",
                "error": {"code": -32600, "message": "Invalid JSON-RPC version"},
                "id": req.id,
            },
            status_code=400,
        )

    routing = {
        "list_products": lambda p: list_products_impl(),
        "search_products": lambda p: search_products_impl(ProductSearch(**(p or {}))),
    }

    if req.method not in routing:
        return JSONResponse(
            {
                "jsonrpc": "2.0",
                "error": {"code": -32601, "message": "Method not found"},
                "id": req.id,
            },
            status_code=404,
        )

    t0 = time.time()
    try:
        result = routing[req.method](req.params)
        duration_ms = int((time.time() - t0) * 1000)
        print(json.dumps({
            "evt": "json_rpc_request",
            "method": req.method,
            "params": req.params,
            "result_count": len(result) if isinstance(result, list) else None,
            "duration_ms": duration_ms
        }))
        return {"jsonrpc": "2.0", "result": result, "id": req.id}
    except Exception as exc:  # noqa: BLE001
        duration_ms = int((time.time() - t0) * 1000)
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


# ----- Health -----
@app.get("/healthz")
def healthz():
    return {"ok": True}


# ----- MCP Discovery -----
@app.get("/.well-known/mcp.json")
def get_mcp():
    return PROMPTS_CONFIG["mcp_discovery"]