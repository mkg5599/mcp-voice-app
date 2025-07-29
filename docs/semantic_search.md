# In-Memory Vector Search Documentation

## Overview

The semantic search feature enables natural language queries over the product catalog using vector embeddings and in-memory similarity search. This provides more intuitive product discovery compared to traditional keyword-based filtering while maintaining a lightweight, Vercel-deployable architecture.

## Architecture

1. **Embedding Generation**: Product data (name, description, tags, city) is converted to vector embeddings using OpenAI's `text-embedding-ada-002` model
2. **In-Memory Storage**: Embeddings are stored in Python dictionaries for fast access
3. **Query Processing**: User queries are embedded and compared against product vectors
4. **Similarity Ranking**: Results are ranked by cosine similarity score using pure Python implementation

## Setup

### Prerequisites

- OpenAI API key set in environment variable `OPENAI_API_KEY`
- Required dependencies installed via Poetry

### Installation

```bash
cd backend
poetry install
```

### Initialization

The in-memory vector store is automatically initialized on FastAPI startup:

1. Loads products from `data/products.json`
2. Creates embeddings for each product using OpenAI
3. Stores vectors in memory for fast retrieval
4. Makes semantic search available via API

## Usage

### REST API

```bash
POST /products/semantic-search
Content-Type: application/json

{
  "query": "comfortable black hoodie for streetwear",
  "top_k": 5
}
```

### MCP Tool

```bash
POST /mcp
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "semantic_product_search",
  "params": {
    "query": "warm winter clothing",
    "top_k": 3
  },
  "id": 1
}
```

## Response Format

```json
[
  {
    "id": 1,
    "name": "Classic Black Hoodie",
    "description": "A mid-weight unisex hoodie...",
    "colors": ["black"],
    "tags": ["hoodie", "streetwear", "cotton-blend"],
    "price": 39.90,
    "city": "Portland",
    "similarity_score": 0.85
  }
]
```

## Refreshing the Vector Store

To refresh the vector store after updating products:

1. Restart the FastAPI server
2. The vector store will rebuild automatically on startup

```bash
poetry run uvicorn main:app --reload
```

## Performance Considerations

- Initial embedding generation takes ~2-3 seconds for 15 products
- Query response time: ~50ms (in-memory lookup)
- Bundle size: ~25MB (perfect for Vercel deployment)
- No external database required
- Fast startup after embedding generation

## Advantages of In-Memory Approach

### Performance
- **Ultra-fast queries**: No network calls to external vector DB
- **Quick startup**: Embeddings generated once on startup
- **Predictable latency**: No external service dependencies

### Deployment
- **Lightweight**: ~25MB total bundle size
- **Vercel compatible**: Under 250MB serverless limit
- **No infrastructure**: No vector database setup required
- **Stateless**: Easy horizontal scaling

### Development
- **Simple debugging**: All vectors accessible in memory
- **No external deps**: Fewer moving parts
- **Cost effective**: Only OpenAI API calls for embeddings

## Limitations

- **Memory usage**: Scales linearly with product count
- **Cold starts**: Embeddings regenerated on each restart
- **No persistence**: Vectors lost on restart (acceptable for small catalogs)

## Troubleshooting

### Vector store not initialized
- Ensure `OPENAI_API_KEY` is set
- Check server logs for embedding errors
- Verify `data/products.json` exists and is valid

### Poor search results
- Add more descriptive product descriptions
- Include relevant tags for better context
- Consider adjusting `top_k` parameter

### Performance issues
- Check OpenAI API rate limits
- Monitor embedding generation time during startup
- Consider caching strategies for very large catalogs

## When to Consider External Vector DB

For larger product catalogs (>1000 products), consider:
- **ChromaDB**: For persistent storage and incremental updates
- **Pinecone**: For managed vector search at scale
- **Weaviate**: For hybrid search capabilities

The current in-memory approach is optimal for:
- **Small to medium catalogs** (<500 products)
- **Serverless deployments** (Vercel, AWS Lambda)
- **Development and prototyping**
- **Cost-sensitive applications**