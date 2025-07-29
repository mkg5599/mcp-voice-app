"""Language model service for RAG implementation."""
from typing import List, Dict, Any, Optional
from openai import AsyncOpenAI
from config.settings import OPENAI_API_KEY, LLM_MODEL, LLM_TEMPERATURE, LLM_MAX_TOKENS

class LLMService:
    """Service for language model interactions in RAG pipeline."""
    
    def __init__(self) -> None:
        self._client: Optional[AsyncOpenAI] = None
    
    async def initialize(self) -> bool:
        """Initialize the OpenAI client."""
        if not OPENAI_API_KEY:
            print("CRITICAL: OPENAI_API_KEY not found. RAG will not work.")
            return False
        
        try:
            print("Initializing LLM service...")
            self._client = AsyncOpenAI(api_key=OPENAI_API_KEY)
            print("LLM service initialized successfully")
            return True
        except Exception as e:
            print(f"Failed to initialize LLM service: {e}")
            self._client = None
            return False
    
    def is_ready(self) -> bool:
        """Check if LLM service is ready."""
        return self._client is not None
    
    async def generate_response(self, 
                              query: str, 
                              context_products: List[Dict[str, Any]],
                              system_prompt: Optional[str] = None) -> str:
        """Generate RAG response using retrieved products as context."""
        if not self._client:
            raise RuntimeError("LLM service not initialized")
        
        # Build context from retrieved products
        context = self._build_context(context_products)
        
        # Default system prompt for product assistance
        if not system_prompt:
            system_prompt = """You are a helpful product assistant for an e-commerce catalog. Use the provided product information to answer user questions accurately and helpfully. 

Guidelines:
- Base your responses on the provided product context
- If asked about products not in the context, mention that you can only see a limited selection
- Include specific details like prices, colors, and descriptions when relevant
- Be conversational and helpful
- If the context is empty or irrelevant, politely explain what you can help with instead"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Product Context:\n{context}\n\nUser Question: {query}"}
        ]
        
        try:
            response = await self._client.chat.completions.create(
                model=LLM_MODEL,
                messages=messages,
                temperature=LLM_TEMPERATURE,
                max_tokens=LLM_MAX_TOKENS
            )
            
            return response.choices[0].message.content or "I apologize, but I couldn't generate a response."
            
        except Exception as e:
            print(f"Error generating LLM response: {e}")
            return f"I'm sorry, I encountered an error while processing your request: {str(e)}"
    
    def _build_context(self, products: List[Dict[str, Any]]) -> str:
        """Build context string from retrieved products."""
        if not products:
            return "No relevant products found in the current selection."
        
        context_parts = []
        for i, product in enumerate(products, 1):
            # Include similarity score if available
            similarity_info = ""
            if "similarity_score" in product:
                similarity_info = f" (relevance: {product['similarity_score']:.2f})"
            
            context_parts.append(
                f"Product {i}{similarity_info}:\n"
                f"  • Name: {product.get('name', 'N/A')}\n"
                f"  • Price: ${product.get('price', 'N/A')}\n"
                f"  • Colors: {', '.join(product.get('colors', []))}\n"
                f"  • City: {product.get('city', 'N/A')}\n"
                f"  • Description: {product.get('description', 'N/A')}\n"
                f"  • Tags: {', '.join(product.get('tags', []))}\n"
            )
        
        return "\n".join(context_parts)

# Global LLM service instance
llm_service = LLMService()