"""
FastAPI application entry point.
Orchestrates all services and routes for the MCP Product Tool Server.
"""
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import configuration
from config.settings import ALLOWED_ORIGINS, IS_VERCEL

# Import services
from services.vector_store import InMemoryVectorStore
from services.embedding_service import embedding_service
from services.product_service import ProductService

# Import routes
from routes import products, mcp, health

# Global instances
vector_store = InMemoryVectorStore()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    await initialize_application()
    yield
    # Shutdown
    pass

async def initialize_application():
    """Initialize all application services."""
    start_time = time.time()
    
    try:
        print(f"Starting application initialization (Vercel: {IS_VERCEL})")
        
        # Initialize embedding service
        embeddings_ready = await embedding_service.initialize()
        
        if embeddings_ready:
            # Initialize product service and populate vector store
            product_service = ProductService(vector_store)
            await product_service.populate_vector_store()
        
        # Initialize route dependencies
        products.init_product_routes(vector_store)
        mcp.init_mcp_routes(vector_store)
        health.init_health_routes(vector_store)
        
        # Final summary
        vector_count = vector_store.count()
        elapsed = time.time() - start_time
        
        print(f"Application initialization complete ({elapsed:.2f}s):")
        print(f"   OpenAI Embeddings: {'Ready' if embeddings_ready else 'Failed'}")
        print(f"   Vector Store: In-memory ({vector_count} documents)")
        print(f"   Semantic Search: {'Ready' if embeddings_ready else 'Unavailable'}")
        
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"CRITICAL ERROR during initialization ({elapsed:.2f}s): {e}")
        import traceback
        traceback.print_exc()

# Create FastAPI application
app = FastAPI(
    title="MCP Product Tool Server",
    version="0.1.0",
    description=(
        "FastAPI backend exposing product catalog functions as MCP-discoverable tools. "
        "In-memory vector search using OpenAI embeddings (no external vector DB). "
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

# Include routers
app.include_router(health.router)
app.include_router(products.router)
app.include_router(mcp.router)