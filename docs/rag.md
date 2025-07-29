# RAG (Retrieval-Augmented Generation) Documentation

## Overview

The RAG feature combines **semantic search** with **large language model generation** to provide conversational, context-aware product assistance. This enables natural language interactions where users can ask questions about products and receive AI-generated responses backed by actual product data.

## Architecture

```
User Query → Semantic Vector Search → LLM Context Injection → AI Response Generation
```

1. **Query Processing**: User asks natural language questions about products
2. **Retrieval Phase**: Vector search finds most relevant products using OpenAI embeddings
3. **Context Building**: Retrieved products are formatted into structured context
4. **Generation Phase**: OpenAI GPT models generate conversational responses using the product context
5. **Response Delivery**: AI response is returned with source products and metadata

## Components

### LLM Service (`services/llm_service.py`)
- **OpenAI Integration**: Uses OpenAI GPT models (default: `gpt-3.5-turbo`)
- **Context Management**: Builds structured context from retrieved products
- **Prompt Engineering**: Configurable system prompts for different use cases
- **Error Handling**: Robust error handling with fallback responses

### Product Service Enhancement
- **RAG Query Method**: Combines semantic search with LLM generation
- **Context Filtering**: Applies similarity threshold filtering
- **Performance Monitoring**: Tracks processing times and metrics

### Frontend RAG Interface
- **Conversational UI**: Chat-like interface for natural interactions
- **Voice Integration**: Supports voice input via Whisper transcription
- **Real-time Responses**: Streaming-like experience with loading indicators
- **Product Display**: Shows retrieved products alongside AI responses

## Setup and Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# LLM Configuration
LLM_MODEL=gpt-3.5-turbo          # OpenAI model to use
LLM_TEMPERATURE=0.7              # Response creativity (0.0-1.0)
LLM_MAX_TOKENS=500               # Max response length

# RAG Configuration  
RAG_CONTEXT_SIZE=5               # Number of products to include in context
RAG_SIMILARITY_THRESHOLD=0.3     # Minimum similarity score to include products
```

### Backend Dependencies

The RAG feature requires these additional dependencies (already included in `requirements.txt`):

```txt
openai==1.97.0
langchain-core==0.2.40
langchain-openai==0.1.25
```

### Service Initialization

RAG services are automatically initialized during FastAPI startup:

```python
# In main.py
async def initialize_application():
    # Initialize embedding service for vector search
    embeddings_ready = await embedding_service.initialize()
    
    # Initialize LLM service for RAG
    llm_ready = await llm_service.initialize()
    
    # Both services need to be ready for full RAG functionality
    print(f"RAG Available: {'Ready' if llm_ready and embeddings_ready else 'Unavailable'}")
```

## Usage

### REST API

#### Basic RAG Query
```bash
POST /products/rag
Content-Type: application/json

{
  "query": "I need something warm for winter outdoor activities",
  "context_size": 5
}
```

#### Custom System Prompt
```bash
POST /products/rag
Content-Type: application/json

{
  "query": "best hoodies for streetwear",
  "system_prompt": "Act as a fashion consultant focused on urban streetwear trends. Provide detailed style advice and recommendations.",
  "context_size": 3
}
```

### MCP Protocol

```bash
POST /mcp
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "rag_query",
  "params": {
    "query": "I want something comfortable for casual wear under $50",
    "context_size": 3
  },
  "id": 1
}
```

### Frontend Interface

Access the RAG chat interface at `/rag` route:

```typescript
// Example usage in React component
const handleRagQuery = async (query: string) => {
  const response = await fetch('/api/rag', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  
  const data = await response.json();
  // data.ai_response contains the generated text
  // data.retrieved_products contains relevant products
};
```

## Response Format

```json
{
  "query": "I need warm winter clothing",
  "ai_response": "Based on your query for warm winter clothing, I recommend these items from our catalog:\n\n1. **Winter Jacket Pro** ($89.99) - This jacket features excellent insulation and is perfect for cold weather activities. Available in black and navy blue.\n\n2. **Thermal Base Layer** ($34.99) - Great for layering under your outerwear, provides moisture-wicking and warmth.\n\nBoth items are available in Seattle and have received excellent reviews for winter performance.",
  "retrieved_products": [
    {
      "id": 8,
      "name": "Winter Jacket Pro",
      "price": 89.99,
      "colors": ["black", "navy"],
      "city": "Seattle",
      "description": "Professional winter jacket with advanced insulation",
      "similarity_score": 0.87
    },
    {
      "id": 12,
      "name": "Thermal Base Layer",
      "price": 34.99,
      "colors": ["black", "white"],
      "city": "Seattle", 
      "description": "Moisture-wicking thermal underlayer",
      "similarity_score": 0.82
    }
  ],
  "context_size": 2,
  "similarity_threshold": 0.3,
  "processing_time_ms": 1250
}
```

## System Prompts

### Default System Prompt
```
You are a helpful product assistant for an e-commerce catalog. Use the provided product information to answer user questions accurately and helpfully.

Guidelines:
- Base your responses on the provided product context
- If asked about products not in the context, mention that you can only see a limited selection
- Include specific details like prices, colors, and descriptions when relevant
- Be conversational and helpful
- If the context is empty or irrelevant, politely explain what you can help with instead
```

### Custom Prompt Examples

**Fashion Consultant:**
```
Act as a professional fashion consultant. Analyze the user's style preferences and provide detailed recommendations with outfit suggestions and styling tips.
```

**Technical Advisor:**
```
You are a technical product advisor. Focus on product specifications, features, and technical comparisons. Provide detailed technical insights for informed decision-making.
```

**Budget-Conscious Assistant:**
```
Act as a budget-conscious shopping assistant. Always consider value for money, compare prices, and suggest cost-effective alternatives when possible.
```

## Performance Considerations

### Response Times
- **Semantic Search**: ~50ms (in-memory vector operations)
- **LLM Generation**: ~800-2000ms (depending on OpenAI API latency)
- **Total RAG Query**: ~1-3 seconds end-to-end

### Cost Optimization
- **Context Size**: Limit `context_size` to reduce token usage
- **Model Selection**: Use `gpt-3.5-turbo` for cost efficiency vs `gpt-4` for quality
- **Caching**: Consider caching common queries for repeated use cases
- **Similarity Threshold**: Higher thresholds reduce irrelevant context

### Scalability
- **Concurrent Requests**: FastAPI handles async LLM calls efficiently
- **Rate Limiting**: OpenAI API rate limits apply to LLM calls
- **Memory Usage**: In-memory vector store scales linearly with product count
- **Stateless Design**: RAG service is fully stateless and horizontally scalable

## Advanced Features

### Context Filtering
```python
# Filter products by similarity score before sending to LLM
filtered_products = [
    p for p in retrieved_products 
    if p.get('similarity_score', 0) >= RAG_SIMILARITY_THRESHOLD
]
```

### Custom Context Building
```python
def _build_context(self, products: List[Dict[str, Any]]) -> str:
    """Build rich context from products with custom formatting."""
    context_parts = []
    for i, product in enumerate(products, 1):
        context_parts.append(
            f"Product {i}:\n"
            f"  • Name: {product.get('name', 'N/A')}\n"
            f"  • Price: ${product.get('price', 'N/A')}\n"
            f"  • Description: {product.get('description', 'N/A')}\n"
            f"  • Relevance: {product.get('similarity_score', 0):.2f}\n"
        )
    return "\n".join(context_parts)
```

### Multi-turn Conversations
The current implementation supports single-turn RAG queries. For multi-turn conversations, consider:

- **Session Management**: Store conversation history
- **Context Accumulation**: Maintain context across turns
- **Intent Tracking**: Track evolving user preferences
- **Memory Management**: Limit conversation length to manage token costs

## Troubleshooting

### Common Issues

| Problem | Symptoms | Solution |
|---------|----------|----------|
| "LLM service not initialized" | RAG endpoints return 500 errors | Check `OPENAI_API_KEY` is set in backend environment |
| Poor response quality | Generic or irrelevant responses | Improve product descriptions, adjust system prompt |
| Slow response times | >5 second response times | Check OpenAI API status, reduce context_size |
| Empty context | "No relevant products found" | Lower similarity_threshold, check vector store initialization |
| High API costs | Unexpected OpenAI charges | Monitor token usage, implement rate limiting |

### Debug Mode

Enable debug logging for RAG operations:

```python
import logging
logging.basicConfig(level=logging.DEBUG)

# Logs will show:
# - Query processing details
# - Retrieved product information  
# - LLM request/response data
# - Performance metrics
```

### Health Checks

Monitor RAG system health:

```bash
# Check overall system status
GET /healthz

# Check MCP service specifically  
GET /mcp/health

# Response includes RAG availability
{
  "llm_service_ready": true,
  "embedding_service_ready": true,
  "vector_store_count": 15,
  "available_methods": ["list_products", "search_products", "semantic_product_search", "rag_query"]
}
```

## Best Practices

### Query Design
- **Specific Questions**: "What hoodies work for streetwear?" vs "Tell me about products"
- **Context Clues**: Include preferences, budget, use case in queries
- **Follow-up Strategy**: Design UI to encourage iterative refinement

### System Prompt Engineering
- **Domain-Specific**: Tailor prompts to your product category
- **Constraint Setting**: Define what the AI should/shouldn't do
- **Format Guidance**: Specify desired response structure
- **Safety Guidelines**: Include appropriate content policies

### Product Data Quality
- **Rich Descriptions**: Detailed, searchable product descriptions improve retrieval
- **Consistent Formatting**: Standardized product data structure
- **Relevant Tags**: Include searchable tags and categories
- **Regular Updates**: Keep product information current

### Performance Optimization
- **Batch Processing**: Group multiple queries when possible
- **Smart Caching**: Cache results for identical queries
- **Async Processing**: Use async patterns for I/O operations
- **Resource Monitoring**: Track API usage and response times

## When to Use RAG vs Semantic Search

### Use RAG When:
- **Conversational Experience**: Users want to ask questions and get explanations
- **Complex Queries**: Multi-faceted questions requiring reasoning
- **Recommendation Engine**: Personalized suggestions with explanations
- **Customer Support**: Answering product-related questions
- **Educational Content**: Teaching users about products

### Use Semantic Search When:
- **Direct Product Discovery**: Users want to see products directly
- **Fast Browsing**: Speed is more important than explanation
- **Simple Matching**: Straightforward similarity-based retrieval
- **Cost Sensitive**: Avoiding LLM API costs
- **High Volume**: Many concurrent simple queries

## Future Enhancements

### Planned Features
- **Multi-turn Conversations**: Conversation history and context
- **Streaming Responses**: Real-time response generation
- **Custom Models**: Support for local/custom LLM models
- **Advanced RAG**: Document chunking, hybrid search
- **Analytics**: Query analysis and optimization insights

### Integration Opportunities
- **Product Recommendations**: ML-based recommendation engine
- **Inventory Integration**: Real-time stock information
- **User Profiles**: Personalized responses based on user history
- **A/B Testing**: Response quality optimization
- **Multi-language**: Internationalization support

## Contributing

To contribute to RAG functionality:

1. **Backend Changes**: Modify `services/llm_service.py` or `services/product_service.py`
2. **Frontend Changes**: Update `components/RagChat.tsx` or `app/rag/page.tsx`
3. **Testing**: Add tests to `tests/test_rag.py`
4. **Documentation**: Update this file with new features

### Development Workflow
```bash
# Backend development
cd backend
poetry install
poetry run pytest tests/test_rag.py -v

# Frontend development  
cd frontend
npm install
npm run dev

# Test full RAG flow
curl -X POST http://localhost:8000/products/rag \
  -H "Content-Type: application/json" \
  -d '{"query": "test query"}'
```

This RAG implementation transforms your product catalog from a search system into an intelligent conversational assistant, providing natural language interactions while maintaining fast performance and cost efficiency.