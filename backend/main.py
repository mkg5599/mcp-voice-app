import json
import os
import time
from typing import Any, Dict, List, Optional
from contextlib import asynccontextmanager
import httpx

import yaml
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from langchain_openai import OpenAIEmbeddings

# Remove ChromaDB import to avoid 250MB bundle size issue
# import chromadb  # <-- This causes the 250MB problem!

load_dotenv()

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PRODUCTS_JSON_PATH = os.path.join(BACKEND_DIR, "data", "products.json")
PROMPTS_YAML_PATH = os.path.join(BACKEND_DIR, "prompts.yml")

# Check if we're running on Vercel
IS_VERCEL = os.getenv("VERCEL") == "1"

# ----- Load config (single source) -----
with open(PROMPTS_YAML_PATH, "r", encoding="utf-8") as f:
    PROMPTS_CONFIG = yaml.safe_load(f)

if "mcp_discovery" not in PROMPTS_CONFIG:
    raise RuntimeError("prompts.yml missing 'mcp_discovery' section (mcp_discovery: ...)")

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000"
).split(",")

# ----- Global variables for HTTP-based ChromaDB client -----
chroma_http_client = None
collection_name = "mcp_products"
embeddings: Optional[OpenAIEmbeddings] = None

# ----- Lifespan event for vector store initialization -----
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await initialize_http_chroma_client()
    yield
    # Shutdown
    pass

app = FastAPI(
    title="MCP Product Tool Server",
    version="0.1.0",
    description=(
        "FastAPI backend exposing product catalog functions as MCP-discoverable tools. "
        "HTTP-only ChromaDB Cloud integration (no heavy imports). "
        "Optimized for Vercel serverless deployment under 250MB limit."
    ),
    lifespan=lifespan
)

class ChromaDBHTTPClient:
    """Lightweight HTTP-only client for ChromaDB Cloud API"""
    
    def __init__(self, api_key: str, tenant: str, database: str):
        self.base_url = "https://api.trychroma.com"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "X-Chroma-Token": api_key  # Alternative header format
        }
        self.tenant = tenant
        self.database = database
        
    async def heartbeat(self):
        """Test connection to ChromaDB Cloud"""
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{self.base_url}/api/v1/heartbeat", 
                headers=self.headers
            )
            response.raise_for_status()
            return response.json()
    
    async def list_collections(self):
        """List all collections"""
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{self.base_url}/api/v1/collections",
                headers=self.headers,
                params={"tenant": self.tenant, "database": self.database}
            )
            response.raise_for_status()
            return response.json()
    
    async def get_collection(self, name: str):
        """Get collection by name"""
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{self.base_url}/api/v1/collections/{name}",
                headers=self.headers,
                params={"tenant": self.tenant, "database": self.database}
            )
            if response.status_code == 404:
                return None
            response.raise_for_status()
            return response.json()
    
    async def create_collection(self, name: str, metadata: dict = None):
        """Create a new collection"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "name": name,
                "metadata": metadata or {},
            }
            response = await client.post(
                f"{self.base_url}/api/v1/collections",
                headers=self.headers,
                json=payload,
                params={"tenant": self.tenant, "database": self.database}
            )
            response.raise_for_status()
            return response.json()
    
    async def collection_count(self, name: str):
        """Get document count in collection"""
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{self.base_url}/api/v1/collections/{name}/count",
                headers=self.headers,
                params={"tenant": self.tenant, "database": self.database}
            )
            response.raise_for_status()
            return response.json()
    
    async def add_documents(self, collection_name: str, documents: List[str], 
                           metadatas: List[dict], ids: List[str], embeddings: List[List[float]]):
        """Add documents to collection"""
        async with httpx.AsyncClient(timeout=60.0) as client:
            payload = {
                "documents": documents,
                "metadatas": metadatas,
                "ids": ids,
                "embeddings": embeddings
            }
            response = await client.post(
                f"{self.base_url}/api/v1/collections/{collection_name}/add",
                headers=self.headers,
                json=payload,
                params={"tenant": self.tenant, "database": self.database}
            )
            response.raise_for_status()
            return response.json()
    
    async def query(self, collection_name: str, query_embeddings: List[List[float]], 
                   n_results: int = 5):
        """Query collection with embeddings"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "query_embeddings": query_embeddings,
                "n_results": n_results,
                "include": ["documents", "metadatas", "distances"]
            }
            response = await client.post(
                f"{self.base_url}/api/v1/collections/{collection_name}/query",
                headers=self.headers,
                json=payload,
                params={"tenant": self.tenant, "database": self.database}
            )
            response.raise_for_status()
            return response.json()

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

async def initialize_http_chroma_client():
    """Initialize HTTP-only ChromaDB client with LangChain embeddings."""
    global chroma_http_client, embeddings
    
    try:
        # Get ChromaDB configuration from environment
        chroma_api_key = os.getenv("CHROMA_API_KEY")
        chroma_tenant = os.getenv("CHROMA_TENANT", "33851047-d464-413f-89b0-1540fb4798bb")
        chroma_database = os.getenv("CHROMA_DATABASE", "agentic-product-db")
        
        if not chroma_api_key:
            print("⚠️ Warning: CHROMA_API_KEY not found. Vector search will not work.")
            return
            
        # Initialize OpenAI embeddings via LangChain
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            print("⚠️ Warning: OPENAI_API_KEY not found. Semantic search will not work.")
            return
            
        print(f"🚀 Initializing HTTP-only ChromaDB client (Vercel: {IS_VERCEL})...")
        
        # Initialize LangChain OpenAI embeddings (lightweight)
        print("🧠 Initializing LangChain OpenAI embeddings...")
        embeddings = OpenAIEmbeddings(
            api_key=openai_api_key,
            model="text-embedding-ada-002"
        )
        
        # Initialize HTTP ChromaDB client (no heavy imports!)
        print("🌐 Initializing HTTP ChromaDB client...")
        chroma_http_client = ChromaDBHTTPClient(
            api_key=chroma_api_key,
            tenant=chroma_tenant,
            database=chroma_database
        )
        
        # Test connection
        try:
            await chroma_http_client.heartbeat()
            print(f"✅ Connected to ChromaDB Cloud via HTTP (tenant: {chroma_tenant}, database: {chroma_database})")
        except Exception as e:
            print(f"❌ Failed to connect to ChromaDB Cloud: {e}")
            chroma_http_client = None
            return
        
        # Get or create collection
        try:
            collection_info = await chroma_http_client.get_collection(collection_name)
            if collection_info:
                print(f"✅ Found existing collection '{collection_name}'")
                
                # Check if collection has documents
                try:
                    count_info = await chroma_http_client.collection_count(collection_name)
                    count = count_info.get("count", 0)
                    print(f"📊 Collection has {count} documents")
                    
                    if count == 0:
                        print("🔄 Collection is empty, populating with products...")
                        await populate_collection_http()
                    else:
                        print("✅ Collection already populated")
                except Exception as count_error:
                    print(f"⚠️ Could not get count, assuming collection needs population: {count_error}")
                    await populate_collection_http()
                    
            else:
                print(f"⚠️ Collection '{collection_name}' not found, creating new one...")
                await chroma_http_client.create_collection(
                    name=collection_name,
                    metadata={"description": "MCP Product Catalog for semantic search"}
                )
                print("✅ Collection created successfully")
                await populate_collection_http()
                
        except Exception as e:
            print(f"❌ Error managing collection: {e}")
            import traceback
            traceback.print_exc()
        
        # Summary
        client_available = chroma_http_client is not None
        langchain_available = embeddings is not None
        
        print(f"🎯 HTTP-only setup complete:")
        print(f"   ChromaDB HTTP Client: {'✅' if client_available else '❌'}")
        print(f"   LangChain Embeddings: {'✅' if langchain_available else '❌'}")
        print(f"   Bundle Size: ~25-30MB (No chromadb import!) ✅")
        
    except Exception as e:
        print(f"❌ Error initializing HTTP ChromaDB client: {e}")
        import traceback
        traceback.print_exc()
        chroma_http_client = None
        embeddings = None

async def populate_collection_http():
    """Populate ChromaDB collection using HTTP API and LangChain."""
    global chroma_http_client, embeddings
    
    if not chroma_http_client or not embeddings:
        print("❌ HTTP client or embeddings not initialized")
        return
        
    try:
        # Load products
        print("📦 Loading products...")
        products = load_products()
        print(f"✅ Loaded {len(products)} products")
        
        # Prepare data
        documents = []
        metadatas = []
        ids = []
        
        print("📄 Preparing documents...")
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
            
            # Create metadata (only basic types)
            metadata = {
                "name": str(product["name"]),
                "price": float(product.get("price", 0)),
                "city": str(product.get("city", "")),
                "colors_str": ", ".join(str(c) for c in product.get("colors", [])),
                "tags_str": ", ".join(str(t) for t in product.get("tags", []))
            }
            
            # Filter metadata to ensure only supported types
            filtered_metadata = filter_metadata_for_chroma(metadata)
            
            documents.append(content)
            metadatas.append(filtered_metadata)
            ids.append(str(product["id"]))
        
        # Generate embeddings using LangChain in batches
        print("🧠 Generating embeddings via LangChain...")
        batch_size = 5 if IS_VERCEL else 10  # Smaller batches for serverless
        embeddings_list = []
        
        for i in range(0, len(documents), batch_size):
            batch_docs = documents[i:i + batch_size]
            
            # Use LangChain to generate embeddings
            batch_embeddings = embeddings.embed_documents(batch_docs)
            embeddings_list.extend(batch_embeddings)
            print(f"⚡ Generated embeddings for batch {i//batch_size + 1}/{(len(documents) + batch_size - 1)//batch_size}")
        
        # Add to collection in batches via HTTP
        print("☁️ Adding documents to ChromaDB Cloud via HTTP...")
        for i in range(0, len(documents), batch_size):
            end_idx = min(i + batch_size, len(documents))
            await chroma_http_client.add_documents(
                collection_name=collection_name,
                documents=documents[i:end_idx],
                metadatas=metadatas[i:end_idx],
                ids=ids[i:end_idx],
                embeddings=embeddings_list[i:end_idx]
            )
            print(f"📤 Added batch {i//batch_size + 1}/{(len(documents) + batch_size - 1)//batch_size}")
        
        print(f"🎉 Successfully populated ChromaDB Cloud collection with {len(documents)} products")
        
    except Exception as e:
        print(f"❌ Error populating collection: {e}")
        import traceback
        traceback.print_exc()

# ----- Root route -----
@app.get("/", summary="Service Index", tags=["meta"])
def index():
    """
    Describe the MCP tool server and its key endpoints.
    """
    client_available = chroma_http_client is not None
    langchain_available = embeddings is not None
    
    return {
        "message": "Welcome to the MCP Product Tool Server (FastAPI)",
        "purpose": "Expose product catalog functions as MCP tools (list_products, search_products, semantic_product_search).",
        "deployment": "Vercel Serverless" if IS_VERCEL else "Local Development", 
        "vector_store": {
            "type": "ChromaDB Cloud (HTTP-only)",
            "client_ready": "✅ Available" if client_available else "❌ Unavailable",
            "langchain_ready": "✅ Available" if langchain_available else "❌ Unavailable",
            "bundle_size": "~25-30MB (No chromadb import!)"
        },
        "optimization": {
            "removed_heavy_imports": ["chromadb"],
            "kept_functionality": ["semantic_search", "vector_embeddings"],
            "vercel_compatible": True
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
            "HTTP-only ChromaDB Cloud integration",
            "LangChain for embeddings (lightweight)",
            "No heavy ML library imports",
            "Perfect for Vercel serverless deployment"
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

async def semantic_product_search_impl(params: SemanticSearch) -> List[Dict[str, Any]]:
    """Perform semantic search using HTTP-only ChromaDB Cloud + LangChain."""
    if not chroma_http_client or not embeddings:
        print("⚠️ ChromaDB HTTP client or embeddings not initialized. Using fallback text search.")
        return fallback_text_search(params.query, params.top_k or 5)
    
    t0 = time.time()
    try:
        print(f"🔍 Performing semantic search for: '{params.query}'")
        
        # Generate query embedding using LangChain
        query_embedding = embeddings.embed_query(params.query)
        
        # Perform similarity search via HTTP
        results = await chroma_http_client.query(
            collection_name=collection_name,
            query_embeddings=[query_embedding],
            n_results=params.top_k or 5
        )
        
        print(f"✅ Found {len(results['ids'][0])} similar documents")
        
        # Get full product data for each result
        products = load_products()
        product_map = {str(p["id"]): p for p in products}
        
        search_results = []
        for i, product_id in enumerate(results['ids'][0]):
            if product_id in product_map:
                product = product_map[product_id].copy()
                # Convert distance to similarity
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
            "vector_store": "chromadb_cloud_http_only",
            "langchain": "enabled",
            "deployment": "vercel" if IS_VERCEL else "local"
        }))
        
        return search_results
        
    except Exception as e:
        duration_ms = int((time.time() - t0) * 1000)
        print(f"❌ Semantic search error: {e}")
        import traceback
        traceback.print_exc()
        print(json.dumps({
            "evt": "semantic_search_error",
            "query": params.query,
            "duration_ms": duration_ms,
            "error": str(e),
            "vector_store": "http_only_failed"
        }))
        # Fall back to simple text search
        return fallback_text_search(params.query, params.top_k or 5)

def fallback_text_search(query: str, top_k: int) -> List[Dict[str, Any]]:
    """Fallback text search when vector search is unavailable."""
    print(f"🔤 Using fallback text search for: '{query}'")
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
            product_copy["similarity_score"] = score / 10.0
            scored_products.append(product_copy)
    
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
async def semantic_search(search_params: SemanticSearch):
    """Perform semantic search using HTTP-only ChromaDB + LangChain approach."""
    return await semantic_product_search_impl(search_params)

# ----- JSON-RPC (MCP façade) -----
@app.post("/mcp", tags=["MCP"])
async def mcp_endpoint(req: JsonRpcRequest):
    """
    JSON-RPC 2.0 endpoint for MCP tool invocation.
    
    Supported methods:
    - list_products: Get all products
    - search_products: Filter products by criteria
    - semantic_product_search: Natural language product search via HTTP-only ChromaDB + LangChain
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
            return list_products_impl()
        elif method == "search_products":
            return search_products_impl(ProductSearch(**(params or {})))
        elif method == "semantic_product_search":
            return await semantic_product_search_impl(SemanticSearch(**(params or {})))
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
        
        client_available = chroma_http_client is not None
        
        print(json.dumps({
            "evt": "json_rpc_request",
            "method": req.method,
            "params": req.params,
            "result_count": len(result) if isinstance(result, list) else None,
            "duration_ms": duration_ms,
            "vector_store": f"http_only_client:{client_available}",
            "langchain": "enabled" if embeddings else "disabled",
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
    client_available = chroma_http_client is not None
    langchain_available = embeddings is not None
    
    return {
        "ok": True, 
        "deployment": "Vercel Serverless" if IS_VERCEL else "Local Development",
        "vector_store": {
            "http_client_ready": client_available,
            "langchain_ready": langchain_available,
            "vector_search_available": client_available and langchain_available
        },
        "products_loaded": _products_cache is not None,
        "available_methods": ["list_products", "search_products", "semantic_product_search"],
        "approach": "HTTP-only ChromaDB Cloud + LangChain (No heavy imports)",
        "bundle_optimized": True,
        "estimated_size": "~25-30MB"
    }

# ----- MCP Discovery -----
@app.get("/.well-known/mcp.json", tags=["MCP"])
def get_mcp():
    """MCP discovery endpoint - returns available tools and their schemas."""
    return PROMPTS_CONFIG["mcp_discovery"]