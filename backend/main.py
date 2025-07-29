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
import chromadb

# Disable ChromaDB telemetry to avoid warning messages
os.environ["ANONYMIZED_TELEMETRY"] = "False"

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

# ----- Global variables for vector store -----
chroma_client = None
collection = None
embeddings: Optional[OpenAIEmbeddings] = None

# ----- Lifespan event for vector store initialization -----
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await initialize_chroma_client()
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

async def initialize_chroma_client():
    """Initialize the ChromaDB Cloud client and collection with product embeddings."""
    global chroma_client, collection, embeddings
    
    try:
        # Get ChromaDB configuration from environment
        chroma_api_key = os.getenv("CHROMA_API_KEY")
        chroma_tenant = os.getenv("CHROMA_TENANT", "33851047-d464-413f-89b0-1540fb4798bb")
        chroma_database = os.getenv("CHROMA_DATABASE", "agentic-product-db")
        
        if not chroma_api_key:
            print("Warning: CHROMA_API_KEY not found. Vector search will not work.")
            return
            
        # Initialize OpenAI embeddings
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            print("Warning: OPENAI_API_KEY not found. Semantic search will not work.")
            return
            
        print("Initializing ChromaDB Cloud client...")
        
        # Create ChromaDB Cloud client
        chroma_client = chromadb.CloudClient(
            api_key=chroma_api_key,
            tenant=chroma_tenant,
            database=chroma_database
        )
        
        # Test connection
        try:
            chroma_client.heartbeat()
            print(f"Successfully connected to ChromaDB Cloud (tenant: {chroma_tenant}, database: {chroma_database})")
        except Exception as e:
            print(f"Failed to connect to ChromaDB Cloud: {e}")
            chroma_client = None
            return
        
        print("Initializing OpenAI embeddings...")
        embeddings = OpenAIEmbeddings(
            api_key=openai_api_key,
            model="text-embedding-ada-002"
        )
        
        # Get or create collection
        collection_name = "mcp_products"
        try:
            collection = chroma_client.get_collection(name=collection_name)
            print(f"Found existing collection '{collection_name}'")
            
            # Check if collection has documents
            count = collection.count()
            print(f"Collection has {count} documents")
            
            if count == 0:
                print("Collection is empty, populating with products...")
                await populate_collection()
            else:
                print("Collection already populated")
                
        except Exception as e:
            print(f"Collection '{collection_name}' not found, creating new one...")
            try:
                collection = chroma_client.create_collection(
                    name=collection_name,
                    metadata={"description": "MCP Product Catalog for semantic search"}
                )
                await populate_collection()
            except Exception as create_error:
                print(f"Failed to create collection: {create_error}")
                collection = None
        
    except Exception as e:
        print(f"Error initializing ChromaDB Cloud client: {e}")
        import traceback
        traceback.print_exc()
        chroma_client = None
        collection = None

async def populate_collection():
    """Populate the ChromaDB collection with product embeddings."""
    global collection, embeddings
    
    if not collection or not embeddings:
        print("Collection or embeddings not initialized")
        return
        
    try:
        # Load products
        print("Loading products...")
        products = load_products()
        print(f"Loaded {len(products)} products")
        
        # Prepare data for ChromaDB
        documents = []
        metadatas = []
        ids = []
        
        print("Creating embeddings and preparing data...")
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
                "name": str(product["name"]),
                "price": float(product.get("price", 0)),
                "city": str(product.get("city", "")),
                # Convert arrays to comma-separated strings for ChromaDB
                "colors_str": ", ".join(str(c) for c in product.get("colors", [])),
                "tags_str": ", ".join(str(t) for t in product.get("tags", []))
            }
            
            # Filter metadata to ensure only supported types
            filtered_metadata = filter_metadata_for_chroma(metadata)
            
            documents.append(content)
            metadatas.append(filtered_metadata)
            ids.append(str(product["id"]))
        
        # Generate embeddings in batches to avoid rate limits
        print("Generating embeddings...")
        batch_size = 10  # Process in smaller batches
        embeddings_list = []
        
        for i in range(0, len(documents), batch_size):
            batch_docs = documents[i:i + batch_size]
            batch_embeddings = embeddings.embed_documents(batch_docs)
            embeddings_list.extend(batch_embeddings)
            print(f"Generated embeddings for batch {i//batch_size + 1}/{(len(documents) + batch_size - 1)//batch_size}")
        
        # Add to collection in batches
        print("Adding documents to ChromaDB collection...")
        for i in range(0, len(documents), batch_size):
            end_idx = min(i + batch_size, len(documents))
            collection.add(
                documents=documents[i:end_idx],
                metadatas=metadatas[i:end_idx],
                ids=ids[i:end_idx],
                embeddings=embeddings_list[i:end_idx]
            )
            print(f"Added batch {i//batch_size + 1}/{(len(documents) + batch_size - 1)//batch_size}")
        
        print(f"Successfully populated collection with {len(documents)} products")
        
    except Exception as e:
        print(f"Error populating collection: {e}")
        import traceback
        traceback.print_exc()

# ----- Root route -----
@app.get("/", summary="Service Index", tags=["meta"])
def index():
    """
    Describe the MCP tool server and its key endpoints.
    """
    return {
        "message": "Welcome to the MCP Product Tool Server (FastAPI)",
        "purpose": "Expose product catalog functions as MCP tools (list_products, search_products, semantic_product_search).",
        "vector_store": "ChromaDB Cloud" if chroma_client else "Not Available",
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
            "This server is host-agnostic and reusable by multiple MCP hosts.",
            "Using ChromaDB Cloud service for vector storage."
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
    """Perform semantic search using ChromaDB Cloud service."""
    if not collection or not embeddings:
        print("ChromaDB collection not initialized. Semantic search unavailable.")
        # Fall back to simple text search
        return fallback_text_search(params.query, params.top_k or 5)
    
    t0 = time.time()
    try:
        print(f"Performing semantic search for: '{params.query}'")
        
        # Generate query embedding
        query_embedding = embeddings.embed_query(params.query)
        
        # Perform similarity search
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=params.top_k or 5,
            include=["documents", "metadatas", "distances"]
        )
        
        print(f"Found {len(results['ids'][0])} similar documents")
        
        # Get full product data for each result
        products = load_products()
        product_map = {str(p["id"]): p for p in products}  # Ensure string keys
        
        search_results = []
        for i, product_id in enumerate(results['ids'][0]):
            if product_id in product_map:
                product = product_map[product_id].copy()
                # Convert distance to similarity (lower distance = higher similarity)
                # ChromaDB returns cosine distance, convert to similarity score
                distance = results['distances'][0][i]
                similarity = max(0, 1.0 - distance)
                product["similarity_score"] = float(similarity)
                search_results.append(product)
        
        duration_ms = int((time.time() - t0) * 1000)
        print(json.dumps({
            "evt": "semantic_search",
            "query": params.query,
            "result_count": len(search_results),
            "duration_ms": duration_ms,
            "vector_store": "chromadb_cloud"
        }))
        
        return search_results
        
    except Exception as e:
        duration_ms = int((time.time() - t0) * 1000)
        print(f"Semantic search error: {e}")
        import traceback
        traceback.print_exc()
        print(json.dumps({
            "evt": "semantic_search_error",
            "query": params.query,
            "duration_ms": duration_ms,
            "error": str(e),
            "vector_store": "chromadb_cloud"
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
    - semantic_product_search: Natural language product search via ChromaDB Cloud
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
            "duration_ms": duration_ms,
            "vector_store": "chromadb_cloud" if collection else "fallback"
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
        "vector_store_ready": collection is not None,
        "chroma_client_ready": chroma_client is not None,
        "products_loaded": _products_cache is not None,
        "available_methods": ["list_products", "search_products", "semantic_product_search"],
        "vector_store_type": "chromadb_cloud" if collection else "unavailable"
    }

# ----- MCP Discovery -----
@app.get("/.well-known/mcp.json", tags=["MCP"])
def get_mcp():
    """MCP discovery endpoint - returns available tools and their schemas."""
    return PROMPTS_CONFIG["mcp_discovery"]