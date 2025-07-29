"""
FastAPI application entry point.
Orchestrates all services and routes for the MCP Product Tool Server.
"""
import time
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import configuration
from config.settings import ALLOWED_ORIGINS, IS_VERCEL

# Import services
from services.vector_store import InMemoryVectorStore
from services.embedding_service import embedding_service
from services.llm_service import llm_service
from services.product_service import ProductService

# Import routes
from routes import products, mcp, health

# Global instances
vector_store = InMemoryVectorStore()
_initialization_complete = False
_initialization_lock = asyncio.Lock()

async def ensure_initialization():
    """Ensure services are initialized before handling requests."""
    global _initialization_complete
    
    if _initialization_complete:
        return
    
    async with _initialization_lock:
        if _initialization_complete:
            return
        
        await initialize_application()
        _initialization_complete = True

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    await ensure_initialization()
    yield
    # Shutdown
    pass

async def initialize_application():
    """Initialize all application services."""
    start_time = time.time()
    
    try:
        print(f"Starting application initialization (Vercel: {IS_VERCEL})")
        
        # Initialize embedding service
        print("Initializing embedding service...")
        embeddings_ready = await embedding_service.initialize()
        print(f"Embedding service ready: {embeddings_ready}")
        
        # Initialize LLM service for RAG
        print("Initializing LLM service...")
        llm_ready = await llm_service.initialize()
        print(f"LLM service ready: {llm_ready}")
        
        if embeddings_ready:
            # Initialize product service and populate vector store
            print("Creating product service...")
            product_service = ProductService(vector_store)
            print("Populating vector store...")
            await product_service.populate_vector_store()
        else:
            print("Warning: Embedding service not ready, vector store will be empty")
        
        # Initialize route dependencies - CRITICAL: This must happen
        print("Initializing route dependencies...")
        products.init_product_routes(vector_store)
        mcp.init_mcp_routes(vector_store)
        health.init_health_routes(vector_store)
        print("Route dependencies initialized successfully")
        
        # Final summary
        vector_count = vector_store.count()
        elapsed = time.time() - start_time
        
        print(f"Application initialization complete ({elapsed:.2f}s):")
        print(f"   OpenAI Embeddings: {'Ready' if embeddings_ready else 'Failed'}")
        print(f"   OpenAI LLM: {'Ready' if llm_ready else 'Failed'}")
        print(f"   Vector Store: In-memory ({vector_count} documents)")
        print(f"   Semantic Search: {'Ready' if embeddings_ready else 'Unavailable'}")
        print(f"   RAG Available: {'Ready' if llm_ready and embeddings_ready else 'Unavailable'}")
        print("   Bundle Size: ~25-30MB (No external vector DB!)")
        print(f"   MCP Service: {'Initialized' if mcp.product_service is not None else 'Failed'}")
        print(f"   Products Service: {'Initialized' if products.product_service is not None else 'Failed'}")
        
        # Verify all services are properly initialized
        if mcp.product_service is None or products.product_service is None:
            print("ERROR: Services not properly initialized!")
            raise RuntimeError("Service initialization failed")
        else:
            print("SUCCESS: All services initialized correctly")
        
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"CRITICAL ERROR during initialization ({elapsed:.2f}s): {e}")
        import traceback
        traceback.print_exc()
        raise e  # Re-raise to prevent app from starting with broken state

# Create FastAPI application
app = FastAPI(
    title="MCP Product Tool Server with RAG",
    version="0.1.0",
    description=(
        "FastAPI backend exposing product catalog functions as MCP-discoverable tools. "
        "Features in-memory vector search using OpenAI embeddings and RAG-powered AI assistance. "
        "Optimized for Vercel serverless deployment under 250MB limit."
    ),
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add middleware to ensure initialization on every request (Vercel fallback)
@app.middleware("http")
async def ensure_services_initialized(request, call_next):
    """Middleware to ensure services are initialized on Vercel."""
    await ensure_initialization()
    response = await call_next(request)
    return response

# Include routers
app.include_router(health.router)
app.include_router(products.router)
app.include_router(mcp.router)

print("FastAPI application setup complete")