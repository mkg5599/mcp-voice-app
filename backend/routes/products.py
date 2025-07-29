"""Product REST endpoints."""
from typing import Optional
from fastapi import APIRouter, HTTPException
from models.requests import ProductSearch, SemanticSearch
from services.product_service import ProductService
from services.vector_store import InMemoryVectorStore

router = APIRouter(prefix="/products", tags=["Products"])

# Global instances (will be injected from main.py)
product_service: Optional[ProductService] = None

def init_product_routes(vector_store: InMemoryVectorStore) -> None:
    """Initialize product routes with dependencies."""
    global product_service
    product_service = ProductService(vector_store)
    print(f"Product routes initialized with product_service: {product_service is not None}")

def get_product_service() -> ProductService:
    """Get the product service instance with proper error handling."""
    if product_service is None:
        raise HTTPException(
            status_code=500,
            detail="Product service not initialized. Application startup may have failed."
        )
    return product_service

@router.get("/")
def list_products():
    """List all products in the catalog."""
    service = get_product_service()
    return service.list_products()

@router.post("/search")
def search_products(search_params: ProductSearch):
    """Search products by filters (colors, city, price range)."""
    service = get_product_service()
    return service.search_products(search_params)

@router.post("/semantic-search")
async def semantic_search(search_params: SemanticSearch):
    """Perform semantic search using in-memory vector store + OpenAI embeddings."""
    service = get_product_service()
    return await service.semantic_search(search_params)

@router.get("/health")
def products_health():
    """Health check specifically for products service."""
    return {
        "service_initialized": product_service is not None,
        "products_available": len(product_service.list_products()) if product_service else 0
    }