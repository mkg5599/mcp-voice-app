import json
import os
import time
from typing import Any, Dict, List, Optional
from contextlib import asynccontextmanager

import yaml
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.schema import Document
import chromadb

# Disable ChromaDB telemetry to avoid warning messages
os.environ["ANONYMIZED_TELEMETRY"] = "False"

load_dotenv()

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PRODUCTS_JSON_PATH = os.path.join(BACKEND_DIR, "data", "products.json")
PROMPTS_YAML_PATH = os.path.join(BACKEND_DIR, "prompts.yml")
CHROMA_DB_PATH = os.path.join(BACKEND_DIR, ".chromadb")

# ----- Load config (single source) -----
with open(PROMPTS_YAML_PATH, "r", encoding="utf-8") as f:
    PROMPTS_CONFIG = yaml.safe_load(f)

if "mcp_discovery" not in PROMPTS_CONFIG:
    raise RuntimeError("prompts.yml missing 'mcp_discovery' section (mcp_discovery: ...)")

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000"
).split(",")

# ----- Global variables for vector store -----
vector_store: Optional[Chroma] = None
embeddings: Optional[OpenAIEmbeddings] = None

# ----- Lifespan event for vector store initialization -----
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await initialize_vector_store()
    yield
    # Shutdown
    pass

app = FastAPI(
    title="MCP Product Tool Server",
    version="0.1.0",
    description=(
        "FastAPI backend exposing product catalog functions as MCP-discoverable tools. "
        "Hosts (e.g. Next.js) discover tools at '/.well-known/mcp.json' and call them via JSON-RPC '/mcp'. "
        "No transcription or LLM logic lives here—only domain/tool functionality."
    ),
    lifespan=lifespan
)

def filter_metadata_for_chroma(metadata: Dict[str, Any]) -> Dict[str, Any]:
    """Filter metadata to only include types supported by ChromaDB."""
    filtered = {}
    for key, value in metadata.items():
        if isinstance(value, (str, int, float, bool)):
            filtered[key] = value
        elif isinstance(value, list):
            # Convert lists to comma-separated strings
            filtered[f"{key}_str"] = ", ".join(str(item) for item in value)
        else:
            # Convert other types to strings
            filtered[key] = str(value)
    return filtered

async def initialize_vector_store():
    """Initialize the vector store with product embeddings."""
    global vector_store, embeddings
    
    try:
        # Initialize OpenAI embeddings
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            print("Warning: OPENAI_API_KEY not found. Semantic search will not work.")
            return
            
        print("Initializing OpenAI embeddings...")
        embeddings = OpenAIEmbeddings(
            api_key=openai_api_key,
            model="text-embedding-ada-002"
        )
        
        # Load products
        print("Loading products...")
        products = load_products()
        print(f"Loaded {len(products)} products")
        
        # Create documents for embedding
        documents = []
        for product in products:
            # Combine name, description, tags, and city for rich context
            content_parts = [
                f"Name: {product['name']}",
                f"Description: {product.get('description', '')}",
                f"Tags: {', '.join(product.get('tags', []))}",
                f"City: {product.get('city', '')}",
                f"Colors: {', '.join(product.get('colors', []))}"
            ]
            content = "\n".join(content_parts)
            
            # Create metadata that's compatible with ChromaDB
            metadata = {
                "id": str(product["id"]),  # Ensure ID is string
                "name": str(product["name"]),
                "price": float(product.get("price", 0)),
                "city": str(product.get("city", "")),
                # Convert arrays to comma-separated strings for ChromaDB
                "colors_str": ", ".join(str(c) for c in product.get("colors", [])),
                "tags_str": ", ".join(str(t) for t in product.get("tags", []))
            }
            
            # Filter metadata to ensure only supported types
            filtered_metadata = filter_metadata_for_chroma(metadata)
            
            doc = Document(
                page_content=content,
                metadata=filtered_metadata
            )
            documents.append(doc)
        
        print("Creating vector store...")
        
        # Create ChromaDB client with telemetry disabled
        client_settings = chromadb.config.Settings(
            anonymized_telemetry=False,
            allow_reset=True
        )
        
        # Initialize Chroma vector store with explicit client settings
        vector_store = Chroma.from_documents(
            documents=documents,
            embedding=embeddings,
            persist_directory=CHROMA_DB_PATH,
            collection_name="products",
            client_settings=client_settings
        )
        
        print(f"Vector store initialized with {len(documents)} products")
        
    except Exception as e:
        print(f"Error initializing vector store: {e}")
        import traceback
        traceback.print_exc()
        vector_store = None

# ----- Root route -----
@app.get("/", summary="Service Index", tags=["meta"])
def index():
    """
    Describe the MCP tool server and its key endpoints.
    """
    return {
        "message": "Welcome to the MCP Product Tool Server (FastAPI)",
        "purpose": "Expose product catalog functions as MCP tools (list_products, search_products, semantic_product_search).",
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

class SemanticSearch(BaseModel):
    query: str
    top_k: Optional[int] = 5

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

def semantic_product_search_impl(params: SemanticSearch) -> List[Dict[str, Any]]:
    """Perform semantic search using vector similarity."""
    if not vector_store:
        print("Vector store not initialized. Semantic search unavailable.")
        # Fall back to simple text search
        return fallback_text_search(params.query, params.top_k or 5)
    
    t0 = time.time()
    try:
        print(f"Performing semantic search for: '{params.query}'")
        
        # Perform similarity search
        docs = vector_store.similarity_search_with_score(
            params.query, 
            k=params.top_k or 5
        )
        
        print(f"Found {len(docs)} similar documents")
        
        # Get full product data for each result
        products = load_products()
        product_map = {str(p["id"]): p for p in products}  # Ensure string keys
        
        results = []
        for doc, score in docs:
            product_id = str(doc.metadata["id"])
            if product_id in product_map:
                product = product_map[product_id].copy()
                # Convert distance to similarity (lower distance = higher similarity)
                # ChromaDB uses cosine distance, so we need to convert it
                product["similarity_score"] = max(0, 1.0 - float(score))
                results.append(product)
        
        duration_ms = int((time.time() - t0) * 1000)
        print(json.dumps({
            "evt": "semantic_search",
            "query": params.query,
            "result_count": len(results),
            "duration_ms": duration_ms
        }))
        
        return results
        
    except Exception as e:
        duration_ms = int((time.time() - t0) * 1000)
        print(f"Semantic search error: {e}")
        import traceback
        traceback.print_exc()
        print(json.dumps({
            "evt": "semantic_search_error",
            "query": params.query,
            "duration_ms": duration_ms,
            "error": str(e)
        }))
        # Fall back to simple text search
        return fallback_text_search(params.query, params.top_k or 5)

def fallback_text_search(query: str, top_k: int) -> List[Dict[str, Any]]:
    """Fallback text search when vector search is unavailable."""
    print(f"Using fallback text search for: '{query}'")
    products = load_products()
    query_lower = query.lower()
    
    scored_products = []
    for product in products:
        score = 0
        # Check name
        if query_lower in product.get("name", "").lower():
            score += 3
        # Check description
        if query_lower in product.get("description", "").lower():
            score += 2
        # Check tags
        for tag in product.get("tags", []):
            if query_lower in tag.lower():
                score += 1
        # Check colors
        for color in product.get("colors", []):
            if query_lower in color.lower():
                score += 1
        
        if score > 0:
            product_copy = product.copy()
            product_copy["similarity_score"] = score / 10.0  # Normalize to 0-1 range
            scored_products.append(product_copy)
    
    # Sort by score and return top_k
    scored_products.sort(key=lambda x: x["similarity_score"], reverse=True)
    return scored_products[:top_k]

# ----- REST endpoints (direct use / debugging) -----
@app.get("/products", tags=["Products"])
def list_products():
    """List all products in the catalog."""
    return list_products_impl()

@app.post("/products/search", tags=["Products"])
def search_products(search_params: ProductSearch):
    """Search products by filters (colors, city, price range)."""
    return search_products_impl(search_params)

@app.post("/products/semantic-search", tags=["Products"])
def semantic_search(search_params: SemanticSearch):
    """Perform semantic search using natural language queries."""
    return semantic_product_search_impl(search_params)

# ----- JSON-RPC (MCP façade) -----
@app.post("/mcp", tags=["MCP"])
@app.options("/mcp", tags=["MCP"])  # Add OPTIONS support for CORS preflight
def mcp_endpoint(req: JsonRpcRequest):
    """
    JSON-RPC 2.0 endpoint for MCP tool invocation.
    
    Supported methods:
    - list_products: Get all products
    - search_products: Filter products by criteria
    - semantic_product_search: Natural language product search
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

    routing = {
        "list_products": lambda p: list_products_impl(),
        "search_products": lambda p: search_products_impl(ProductSearch(**(p or {}))),
        "semantic_product_search": lambda p: semantic_product_search_impl(SemanticSearch(**(p or {}))),
    }

    if req.method not in routing:
        return JSONResponse(
            {
                "jsonrpc": "2.0",
                "error": {"code": -32601, "message": f"Method '{req.method}' not found. Available methods: {list(routing.keys())}"},
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

# Handle CORS preflight for /mcp endpoint specifically
@app.options("/mcp")
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

# ----- Health -----
@app.get("/healthz", tags=["Health"])
def healthz():
    """Health check endpoint."""
    return {
        "ok": True, 
        "vector_store_ready": vector_store is not None,
        "products_loaded": _products_cache is not None,
        "available_methods": ["list_products", "search_products", "semantic_product_search"]
    }

# ----- MCP Discovery -----
@app.get("/.well-known/mcp.json", tags=["MCP"])
def get_mcp():
    """MCP discovery endpoint - returns available tools and their schemas."""
    return PROMPTS_CONFIG["mcp_discovery"]