# MCP Voice App

This is a full-stack application demonstrating product search and filtering using voice commands, powered by a Next.js (React + TypeScript) frontend and a FastAPI (Python) backend. It integrates with the Gemini API for natural language processing and function calling, and uses the Model-Context-Protocol (MCP) for backend function invocation.

## Getting Started

For detailed setup, installation, and running instructions, please refer to the [SETUP.md](./SETUP.md) file.

## Features

-   **Voice and Text Input:** Search for products using either spoken commands or typed text.
-   **Gemini Integration:** Leverages the latest Gemini SDK for intelligent product filtering based on natural language queries.
-   **Model-Context-Protocol (MCP):** Gemini model interacts with the backend API using the MCP standard for function calling, enabling robust and extensible backend integration.
-   **Function Calling:** Gemini model calls backend functions (e.g., `list_products`, `search_products`) via the `/mcp` endpoint.
-   **Responsive UI:** Product list displayed in a clean, responsive interface.
-   **Dockerized Deployment:** Easily deployable using Docker Compose.

## Architecture

This application implements a Next.js Host + FastAPI MCP Tool Server + Voice (Whisper) + Gemini Function Calling architecture.

**High-Level Architecture (Target State):**

```
Browser UI (page.tsx)
  └─ POST /api/transcribe  (Node serverless)  -> OpenAI Whisper -> text
       └─ POST /api/chat   (Node serverless Host)
            1) Fetch & cache MCP discovery JSON
            2) Gemini generateContent (ANY) with functionDeclarations
            3) If functionCall -> JSON-RPC /mcp -> FastAPI tool
            4) Second generateContent (NONE) with functionResponse
            5) Return { message, products }
FastAPI (Tool Server)
  ├─ /.well-known/mcp.json
  ├─ /mcp (JSON-RPC 2.0 façade)
  ├─ /products , /products/search
  └─ /healthz
```

## Environment Variables

These environment variables are crucial for the application's functionality. They should be set securely in your deployment environment (e.g., Vercel project settings).

| Name                  | Scope                               | Purpose                                      |
| :-------------------- | :---------------------------------- | :------------------------------------------- |
| `GEMINI_API_KEY`      | Server (Next.js + FastAPI)          | Gemini API access                            |
| `OPENAI_API_KEY`      | Server (Next.js)                    | Whisper Speech-to-Text (STT)                 |
| `BACKEND_INTERNAL_URL`| Server (Next.js)                    | Base URL of FastAPI tool server (e.g., `https://mcp-api.example.com`) |

**Important:**
*   `NEXT_PUBLIC_API_URL` is no longer used for internal host logic.
*   The application will throw an explicit error if `BACKEND_INTERNAL_URL` is undefined on the server side.

For a visual representation of the application's architecture, see the diagram in [SETUP.md](./SETUP.md#architecture-diagram).

## API Endpoints

### Backend (FastAPI)

-   `GET /products` — List all products.
-   `POST /products/search` — Search and filter products by color, city, and price.
-   `POST /mcp` — **MCP endpoint:** Accepts JSON-RPC 2.0 requests for `list_products` and `search_products`. Used by the Gemini model for function calling.
-   `GET /.well-known/mcp.json` — MCP discovery endpoint describing available backend functions.

### Frontend (Next.js)

-   `POST /api/chat` — Accepts user queries (text or voice), interacts with Gemini, and returns product results.

Refer to the [SETUP.md](./SETUP.md#api-endpoints) for a comprehensive list of frontend and backend API endpoints and their usage.

## Development

-   **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS.
-   **Backend:** FastAPI, Python 3.11+, MCP protocol.

## Contributing

Contributions are welcome! Please refer to the [SETUP.md](./SETUP.md) for development environment setup and MCP integration details.