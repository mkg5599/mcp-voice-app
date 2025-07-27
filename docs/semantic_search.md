# Semantic Search Documentation

## Overview

The semantic search feature enables natural language queries over the product catalog using vector embeddings and similarity search. This provides more intuitive product discovery compared to traditional keyword-based filtering.

## Architecture

1. **Embedding Generation**: Product data (name, description, tags, city) is converted to vector embeddings using OpenAI's `text-embedding-ada-002` model
2. **Vector Storage**: Embeddings are stored in ChromaDB for efficient similarity search
3. **Query Processing**: User queries are embedded and compared against product vectors
4. **Similarity Ranking**: Results are ranked by cosine similarity score

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

The vector store is automatically initialized on FastAPI startup:

1. Loads products from `data/products.json`
2. Creates embeddings for each product
3. Stores vectors in `.chromadb/` directory
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

1. Delete the `.chromadb/` directory
2. Restart the FastAPI server
3. The vector store will rebuild automatically

```bash
rm -rf .chromadb
poetry run uvicorn main:app --reload
```

## Performance Considerations

- Initial embedding generation takes ~2-3 seconds for 15 products
- Query response time: ~100-200ms
- Vector store persists to disk for fast startup after first initialization
- Consider implementing incremental updates for larger catalogs

## Troubleshooting

### Vector store not initialized
- Ensure `OPENAI_API_KEY` is set
- Check server logs for embedding errors
- Verify `data/products.json` exists and is valid

### Poor search results
- Add more descriptive product descriptions
- Include relevant tags for better context
- Consider adjusting `top_k` parameter

### Slow performance
- Check OpenAI API rate limits
- Monitor embedding generation time
- Consider caching strategies for frequently searched terms