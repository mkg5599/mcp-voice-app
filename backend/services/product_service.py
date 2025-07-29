"""Product business logic and search implementations."""
import json
import time
from typing import Any, Dict, List
from models.requests import ProductSearch, SemanticSearch, RagRequest
from services.vector_store import InMemoryVectorStore
from services.embedding_service import embedding_service
from services.llm_service import llm_service
from utils.cache import load_products
from config.settings import EMBEDDING_BATCH_SIZE, IS_VERCEL, RAG_CONTEXT_SIZE, RAG_SIMILARITY_THRESHOLD

class ProductService:
    """Service for product operations and search."""
    
    def __init__(self, vector_store: InMemoryVectorStore):
        self.vector_store = vector_store
    
    def list_products(self) -> List[Dict[str, Any]]:
        """Get all products."""
        return load_products()
    
    def search_products(self, params: ProductSearch) -> List[Dict[str, Any]]:
        """Search products by filters (colors, city, price range)."""
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

    async def semantic_search(self, params: SemanticSearch) -> List[Dict[str, Any]]:
        """Perform semantic search using in-memory vector store + OpenAI embeddings."""
        if not embedding_service.is_ready() or self.vector_store.count() == 0:
            print("Vector store not initialized. Using fallback text search.")
            return self.fallback_text_search(params.query, params.top_k or 5)
        
        t0 = time.time()
        try:
            print(f"Performing semantic search for: '{params.query}'")
            
            # Generate query embedding using OpenAI
            query_embedding = embedding_service.embed_query(params.query)
            
            # Perform similarity search in memory
            similar_docs = self.vector_store.similarity_search(
                query_embedding=query_embedding,
                k=params.top_k or 5
            )
            
            print(f"Found {len(similar_docs)} similar documents")
            
            # Get full product data for each result
            products = load_products()
            product_map = {str(p["id"]): p for p in products}
            
            search_results = []
            for doc in similar_docs:
                product_id = doc['id']
                if product_id in product_map:
                    product = product_map[product_id].copy()
                    product["similarity_score"] = float(doc['similarity'])
                    search_results.append(product)
            
            duration_ms = int((time.time() - t0) * 1000)
            print(json.dumps({
                "evt": "semantic_search",
                "query": params.query,
                "result_count": len(search_results),
                "duration_ms": duration_ms,
                "vector_store": "in_memory_openai",
                "deployment": "vercel" if IS_VERCEL else "local"
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
                "vector_store": "in_memory_failed"
            }))
            # Fall back to simple text search
            return self.fallback_text_search(params.query, params.top_k or 5)

    async def rag_query(self, params: RagRequest) -> Dict[str, Any]:
        """Perform RAG query: retrieve relevant products and generate AI response."""
        if not llm_service.is_ready():
            raise RuntimeError("LLM service not initialized. RAG unavailable.")
        
        t0 = time.time()
        try:
            print(f"Performing RAG query for: '{params.query}'")
            
            # Step 1: Retrieve relevant products using semantic search
            semantic_params = SemanticSearch(
                query=params.query, 
                top_k=params.context_size or RAG_CONTEXT_SIZE
            )
            retrieved_products = await self.semantic_search(semantic_params)
            
            # Step 2: Filter by similarity threshold (optional)
            filtered_products = [
                p for p in retrieved_products 
                if p.get('similarity_score', 0) >= RAG_SIMILARITY_THRESHOLD
            ]
            
            # Step 3: Generate response using LLM
            ai_response = await llm_service.generate_response(
                query=params.query,
                context_products=filtered_products,
                system_prompt=params.system_prompt
            )
            
            duration_ms = int((time.time() - t0) * 1000)
            
            result = {
                "query": params.query,
                "ai_response": ai_response,
                "retrieved_products": filtered_products,
                "context_size": len(filtered_products),
                "similarity_threshold": RAG_SIMILARITY_THRESHOLD,
                "processing_time_ms": duration_ms
            }
            
            print(json.dumps({
                "evt": "rag_query",
                "query": params.query,
                "context_products": len(filtered_products),
                "duration_ms": duration_ms,
                "response_length": len(ai_response),
                "deployment": "vercel" if IS_VERCEL else "local"
            }))
            
            return result
            
        except Exception as e:
            duration_ms = int((time.time() - t0) * 1000)
            print(f"RAG query error: {e}")
            import traceback
            traceback.print_exc()
            print(json.dumps({
                "evt": "rag_query_error",
                "query": params.query,
                "duration_ms": duration_ms,
                "error": str(e)
            }))
            raise e

    def fallback_text_search(self, query: str, top_k: int) -> List[Dict[str, Any]]:
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
                product_copy["similarity_score"] = score / 10.0
                scored_products.append(product_copy)
        
        scored_products.sort(key=lambda x: x["similarity_score"], reverse=True)
        return scored_products[:top_k]
    
    async def populate_vector_store(self):
        """Populate in-memory vector store with product embeddings."""
        if not embedding_service.is_ready():
            print("Embeddings not initialized")
            return
            
        try:
            # Load products
            print("Loading products...")
            products = load_products()
            print(f"Loaded {len(products)} products")
            
            # Prepare data
            documents = []
            metadatas = []
            ids = []
            
            print("Preparing documents...")
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
                
                # Create metadata
                metadata = {
                    "name": str(product["name"]),
                    "price": float(product.get("price", 0)),
                    "city": str(product.get("city", "")),
                    "colors": product.get("colors", []),
                    "tags": product.get("tags", [])
                }
                
                documents.append(content)
                metadatas.append(metadata)
                ids.append(str(product["id"]))
            
            # Generate embeddings using OpenAI in batches
            print("Generating embeddings via OpenAI...")
            embeddings_list = []
            
            for i in range(0, len(documents), EMBEDDING_BATCH_SIZE):
                batch_docs = documents[i:i + EMBEDDING_BATCH_SIZE]
                
                # Use OpenAI to generate embeddings
                batch_embeddings = embedding_service.embed_documents(batch_docs)
                embeddings_list.extend(batch_embeddings)
                print(f"Generated embeddings for batch {i//EMBEDDING_BATCH_SIZE + 1}/{(len(documents) + EMBEDDING_BATCH_SIZE - 1)//EMBEDDING_BATCH_SIZE}")
            
            # Add to in-memory vector store
            print("Adding documents to in-memory vector store...")
            self.vector_store.add_documents(
                ids=ids,
                embeddings=embeddings_list,
                documents=documents,
                metadatas=metadatas
            )
            
            print(f"Successfully populated in-memory vector store with {len(documents)} products")
            
        except Exception as e:
            print(f"Error populating vector store: {e}")
            import traceback
            traceback.print_exc()