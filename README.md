
# MCP Voice Demo

This is a demo application showcasing the use of the Model Context Protocol (MCP) with a Next.js frontend and a FastAPI backend. The application allows users to search for products using voice commands.

## Setup

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/<your-github-username>/mcp-voice-demo.git
    cd mcp-voice-demo
    ```

2.  **Set up environment variables:**

    Create a `.env` file in the `frontend` directory and add the following:

    ```
    OPENAI_API_KEY=your-openai-api-key
    ```

3.  **Install dependencies:**

    The application uses Docker Compose to manage the frontend and backend services. Make sure you have Docker and Docker Compose installed.

## Local Development

To run the application locally, use the following command:

```bash
docker compose up
```

This will start the Next.js frontend at `http://localhost:3000` and the FastAPI backend at `http://localhost:8000`.

## Voice Demo

1.  Open the application in your browser at `http://localhost:3000`.
2.  Click the microphone button to start recording your voice.
3.  Speak a command, such as "Show me all the black hoodies" or "Find products in Portland."
4.  The application will transcribe your voice command, send it to the backend, and display the filtered products.

## MCP

The backend exposes a `/products` endpoint that can be used to filter products. The MCP discovery file is available at `http://localhost:8000/.well-known/mcp.json`.
