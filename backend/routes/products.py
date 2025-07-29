"""Product REST endpoints."""
from fastapi import APIRouter
from models.requests import ProductSearch, SemanticSearch
from services.product_service import ProductService
from services.vector_store import InMemoryVectorStore

router = APIRouter(prefix="/products", tags=["Products"])

# Global instances (will be injected from main.py)
product_service: ProductService = None

def init_product_routes(vector_store: InMemoryVectorStore):
    """Initialize product routes with dependencies."""
    global product_service
    product_service = ProductService(vector_store)

@router.get("/")
def list_products():
    """List all products in the catalog."""
    return product_service.list_products()

@router.post("/search")
def search_products(search_params: ProductSearch):
    """Search products by filters (colors, city, price range)."""
    return product_service.search_products(search_params)

@router.post("/semantic-search")
async def semantic_search(search_params: SemanticSearch):
    """Perform semantic search using in-memory vector store + OpenAI embeddings."""
    return await product_service.semantic_search(search_params)