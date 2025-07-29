import Link from "next/link";

export const metadata = { title: "About • Agentic Product Catalog" };

export default function AboutPage() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
            <div className="container mx-auto px-4 py-16">
                {/* Back Button */}
                <div className="mb-8">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-white shadow-lg hover:shadow-xl transition-shadow font-semibold"
                    >
                        ← Back to Product Search
                    </Link>
                </div>

                <header className="text-center mb-16">
                    <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6">
                        Agentic Product Catalog
                    </h1>
                    <p className="text-2xl text-gray-700 mb-4">
                        Voice + Natural Language Product Search + AI Chat Assistant
                    </p>
                    <p className="text-lg text-gray-600 max-w-4xl mx-auto">
                        Powered by{" "}
                        <span className="font-semibold text-blue-600">Gemini 2.0 Flash</span>,{" "}
                        <span className="font-semibold text-green-600">OpenAI Whisper & GPT</span>,{" "}
                        <span className="font-semibold text-purple-600">FastAPI + In-Memory Vector Store</span>,{" "}
                        <span className="font-semibold text-orange-600">Model Context Protocol</span>, and{" "}
                        <span className="font-semibold text-red-600">RAG (Retrieval-Augmented Generation)</span>
                    </p>
                </header>

                {/* Architecture Flow */}
                <section className="mb-16">
                    <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
                        Architecture Flow
                    </h2>
                    <div className="bg-white rounded-xl shadow-lg p-8">
                        <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 md:space-x-4">
                            <div className="flex flex-col items-center p-4 bg-blue-50 rounded-lg flex-1">
                                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mb-3">
                                    <span className="text-white font-bold text-lg">1</span>
                                </div>
                                <h3 className="font-semibold text-blue-700">User Input</h3>
                                <p className="text-sm text-gray-600 text-center">
                                    Voice or Text Query
                                </p>
                            </div>

                            <div className="hidden md:block text-gray-400">→</div>

                            <div className="flex flex-col items-center p-4 bg-green-50 rounded-lg flex-1">
                                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-3">
                                    <span className="text-white font-bold text-lg">2</span>
                                </div>
                                <h3 className="font-semibold text-green-700">Next.js Host</h3>
                                <p className="text-sm text-gray-600 text-center">
                                    Whisper Transcription + MCP Host
                                </p>
                            </div>

                            <div className="hidden md:block text-gray-400">→</div>

                            <div className="flex flex-col items-center p-4 bg-purple-50 rounded-lg flex-1">
                                <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mb-3">
                                    <span className="text-white font-bold text-lg">3</span>
                                </div>
                                <h3 className="font-semibold text-purple-700">Gemini 2.0 Flash</h3>
                                <p className="text-sm text-gray-600 text-center">
                                    Function Calling + Tool Selection
                                </p>
                            </div>

                            <div className="hidden md:block text-gray-400">→</div>

                            <div className="flex flex-col items-center p-4 bg-orange-50 rounded-lg flex-1">
                                <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mb-3">
                                    <span className="text-white font-bold text-lg">4</span>
                                </div>
                                <h3 className="font-semibold text-orange-700">FastAPI Backend</h3>
                                <p className="text-sm text-gray-600 text-center">MCP Tool Server + Vector Search + RAG</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features Grid */}
                <section className="mb-16">
                    <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
                        Key Features
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                            <h3 className="text-xl font-semibold text-blue-600 mb-3">
                                🎤 Voice & Text Input
                            </h3>
                            <p className="text-gray-600">
                                Search for products using either spoken commands or typed text
                                with OpenAI Whisper transcription.
                            </p>
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                            <h3 className="text-xl font-semibold text-green-600 mb-3">
                                🤖 Gemini 2.0 Integration
                            </h3>
                            <p className="text-gray-600">
                                Uses Gemini 2.0 Flash model for intelligent function calling
                                and natural language understanding.
                            </p>
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                            <h3 className="text-xl font-semibold text-purple-600 mb-3">
                                🔍 In-Memory Vector Search
                            </h3>
                            <p className="text-gray-600">
                                Fast in-memory semantic search using OpenAI embeddings with 
                                cosine similarity for natural language product discovery.
                            </p>
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                            <h3 className="text-xl font-semibold text-orange-600 mb-3">
                                📡 Model Context Protocol
                            </h3>
                            <p className="text-gray-600">
                                JSON-RPC 2.0 over HTTP with automatic tool discovery via 
                                /.well-known/mcp.json endpoint for robust backend integration.
                            </p>
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                            <h3 className="text-xl font-semibold text-red-600 mb-3">
                                🧠 RAG-Powered AI Assistant
                            </h3>
                            <p className="text-gray-600">
                                Conversational AI assistant combining semantic search with GPT models
                                for natural language product recommendations and advice.
                            </p>
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                            <h3 className="text-xl font-semibold text-indigo-600 mb-3">
                                🚀 Vercel Optimized
                            </h3>
                            <p className="text-gray-600">
                                Lightweight ~25MB bundle with no external vector database,
                                perfect for serverless deployment under 250MB limit.
                            </p>
                        </div>
                    </div>
                </section>

                {/* MCP Tools */}
                <section className="mb-16">
                    <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
                        Available MCP Tools
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
                            <h3 className="text-xl font-semibold text-blue-600 mb-3">
                                📦 list_products
                            </h3>
                            <p className="text-gray-600 mb-3">
                                Returns all products in the catalog with complete metadata.
                            </p>
                            <div className="text-sm text-gray-500">
                                <strong>Triggers:</strong> &quot;show all products&quot;, &quot;what&apos;s available&quot;
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
                            <h3 className="text-xl font-semibold text-green-600 mb-3">
                                🔍 search_products
                            </h3>
                            <p className="text-gray-600 mb-3">
                                Filters products by specific attributes: colors, city, price range.
                            </p>
                            <div className="text-sm text-gray-500">
                                <strong>Triggers:</strong> &quot;red items under $50&quot;, &quot;products in Portland&quot;
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
                            <h3 className="text-xl font-semibold text-purple-600 mb-3">
                                🤖 semantic_product_search
                            </h3>
                            <p className="text-gray-600 mb-3">
                                In-memory vector similarity search for natural language queries with scoring.
                            </p>
                            <div className="text-sm text-gray-500">
                                <strong>Triggers:</strong> &quot;comfortable hoodies&quot;, &quot;warm winter clothing&quot;
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
                            <h3 className="text-xl font-semibold text-red-600 mb-3">
                                💬 rag_query
                            </h3>
                            <p className="text-gray-600 mb-3">
                                AI-powered conversational assistant with product recommendations and explanations.
                            </p>
                            <div className="text-sm text-gray-500">
                                <strong>Triggers:</strong> &quot;I need help choosing&quot;, &quot;recommend something&quot;
                            </div>
                        </div>
                    </div>
                </section>

                {/* RAG vs Search Comparison */}
                <section className="mb-16">
                    <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
                        RAG vs Semantic Search
                    </h2>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
                            <h3 className="text-xl font-semibold text-purple-600 mb-4">
                                🔍 Semantic Search
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <h4 className="font-semibold text-gray-700 mb-1">Best For:</h4>
                                    <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                                        <li>Direct product discovery</li>
                                        <li>Fast browsing experience</li>
                                        <li>Simple similarity matching</li>
                                        <li>Cost-sensitive applications</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-700 mb-1">Response:</h4>
                                    <p className="text-sm text-gray-600">Returns ranked product list with similarity scores</p>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-700 mb-1">Speed:</h4>
                                    <p className="text-sm text-green-600 font-semibold">~50ms</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
                            <h3 className="text-xl font-semibold text-red-600 mb-4">
                                💬 RAG Assistant
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <h4 className="font-semibold text-gray-700 mb-1">Best For:</h4>
                                    <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                                        <li>Conversational experience</li>
                                        <li>Complex queries requiring reasoning</li>
                                        <li>Personalized recommendations</li>
                                        <li>Customer support scenarios</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-700 mb-1">Response:</h4>
                                    <p className="text-sm text-gray-600">AI-generated explanations with product context</p>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-700 mb-1">Speed:</h4>
                                    <p className="text-sm text-orange-600 font-semibold">~1-3s</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* API Endpoints */}
                <section className="mb-16">
                    <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
                        API Endpoints
                    </h2>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h3 className="text-xl font-semibold text-blue-600 mb-4">
                                🐍 Backend (FastAPI Tool Server)
                            </h3>
                            <ul className="space-y-3">
                                <li className="flex items-center gap-2">
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono">GET</span>
                                    <a 
                                        href={`${process.env.BACKEND_INTERNAL_URL}/.well-known/mcp.json`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline text-sm"
                                    >
                                        /.well-known/mcp.json
                                    </a>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono">GET</span>
                                    <a 
                                        href={`${process.env.BACKEND_INTERNAL_URL}/products`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline text-sm"
                                    >
                                        /products
                                    </a>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded font-mono">POST</span>
                                    <span className="text-orange-600 text-sm">/products/search</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded font-mono">POST</span>
                                    <span className="text-purple-600 text-sm">/products/semantic-search</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-mono">POST</span>
                                    <span className="text-red-600 text-sm">/products/rag</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-mono">POST</span>
                                    <span className="text-green-600 text-sm">/mcp (JSON-RPC 2.0)</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono">GET</span>
                                    <a 
                                        href={`${process.env.BACKEND_INTERNAL_URL}/docs`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline text-sm"
                                    >
                                        /docs (Swagger UI)
                                    </a>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-mono">GET</span>
                                    <a 
                                        href={`${process.env.BACKEND_INTERNAL_URL}/healthz`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-green-600 hover:underline text-sm"
                                    >
                                        /healthz
                                    </a>
                                </li>
                            </ul>
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h3 className="text-xl font-semibold text-green-600 mb-4">
                                ⚛️ Frontend (Next.js MCP Host)
                            </h3>
                            <ul className="space-y-3">
                                <li className="flex items-center gap-2">
                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-mono">POST</span>
                                    <span className="text-green-600 text-sm">/api/chat (Gemini Orchestration)</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded font-mono">POST</span>
                                    <span className="text-orange-600 text-sm">/api/transcribe (Whisper)</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-mono">POST</span>
                                    <span className="text-red-600 text-sm">/api/rag (RAG Proxy)</span>
                                </li>
                            </ul>
                            <div className="mt-4 p-3 bg-gray-50 rounded text-sm text-gray-600">
                                <strong>Note:</strong> Frontend API routes are internal serverless functions
                                that handle LLM orchestration, speech transcription, and RAG proxy.
                            </div>
                        </div>
                    </div>
                </section>

                {/* How It Works */}
                <section className="mb-16">
                    <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
                        How It Works
                    </h2>
                    <div className="bg-white rounded-lg shadow-md p-8">
                        <ol className="space-y-6">
                            <li className="flex items-start">
                                <span className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold mr-4">
                                    1
                                </span>
                                <div>
                                    <h4 className="font-semibold text-gray-800 mb-1">User Input</h4>
                                    <p className="text-gray-600">
                                        User speaks or types a product search query. Voice input is transcribed
                                        using OpenAI Whisper via <code className="bg-gray-100 px-1 rounded">/api/transcribe</code>.
                                    </p>
                                </div>
                            </li>
                            <li className="flex items-start">
                                <span className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold mr-4">
                                    2
                                </span>
                                <div>
                                    <h4 className="font-semibold text-gray-800 mb-1">MCP Discovery</h4>
                                    <p className="text-gray-600">
                                        Frontend fetches available tools from backend&#39;s{" "}
                                        <code className="bg-gray-100 px-1 rounded">/.well-known/mcp.json</code>{" "}
                                        and converts them to Gemini function declarations.
                                    </p>
                                </div>
                            </li>
                            <li className="flex items-start">
                                <span className="flex-shrink-0 w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold mr-4">
                                    3
                                </span>
                                <div>
                                    <h4 className="font-semibold text-gray-800 mb-1">Gemini Function Calling</h4>
                                    <p className="text-gray-600">
                                        Gemini 2.0 Flash analyzes query intent and automatically selects the best tool:
                                        structured filtering, semantic search, RAG conversation, or product listing via{" "}
                                        <code className="bg-gray-100 px-1 rounded">/api/chat</code>.
                                    </p>
                                </div>
                            </li>
                            <li className="flex items-start">
                                <span className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold mr-4">
                                    4
                                </span>
                                <div>
                                    <h4 className="font-semibold text-gray-800 mb-1">Backend Tool Execution</h4>
                                    <p className="text-gray-600">
                                        Backend receives JSON-RPC 2.0 request at{" "}
                                        <code className="bg-gray-100 px-1 rounded">/mcp</code> and executes
                                        the chosen function: attribute filtering, in-memory vector search,
                                        RAG conversation, or simple listing.
                                    </p>
                                </div>
                            </li>
                            <li className="flex items-start">
                                <span className="flex-shrink-0 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center font-bold mr-4">
                                    5
                                </span>
                                <div>
                                    <h4 className="font-semibold text-gray-800 mb-1">Result Synthesis</h4>
                                    <p className="text-gray-600">
                                        Frontend sends tool results back to Gemini for natural language
                                        summarization, then displays products with similarity scores,
                                        tool indicators, and rich metadata. RAG responses include AI-generated
                                        explanations alongside relevant products.
                                    </p>
                                </div>
                            </li>
                        </ol>
                    </div>
                </section>

                {/* Technology Stack */}
                <section className="mb-16">
                    <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
                        Technology Stack
                    </h2>
                    
                    {/* Frontend Stack */}
                    <div className="mb-8">
                        <h3 className="text-xl font-semibold text-blue-600 mb-4 text-center">
                            Frontend (MCP Host)
                        </h3>
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white rounded-lg shadow-md p-4 text-center">
                                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <span className="text-white font-bold">⚛️</span>
                                </div>
                                <h4 className="font-semibold text-blue-600">Next.js 14</h4>
                                <p className="text-xs text-gray-600">React Framework + API Routes</p>
                            </div>
                            <div className="bg-white rounded-lg shadow-md p-4 text-center">
                                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <span className="text-white font-bold">TS</span>
                                </div>
                                <h4 className="font-semibold text-blue-600">TypeScript 5</h4>
                                <p className="text-xs text-gray-600">Type Safety</p>
                            </div>
                            <div className="bg-white rounded-lg shadow-md p-4 text-center">
                                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <span className="text-white font-bold">🤖</span>
                                </div>
                                <h4 className="font-semibold text-green-600">Gemini 2.0 Flash</h4>
                                <p className="text-xs text-gray-600">@google/genai</p>
                            </div>
                            <div className="bg-white rounded-lg shadow-md p-4 text-center">
                                <div className="w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <span className="text-white font-bold">🎨</span>
                                </div>
                                <h4 className="font-semibold text-cyan-600">Tailwind CSS</h4>
                                <p className="text-xs text-gray-600">Utility-First Styling</p>
                            </div>
                        </div>
                    </div>

                    {/* Backend Stack */}
                    <div className="mb-8">
                        <h3 className="text-xl font-semibold text-purple-600 mb-4 text-center">
                            Backend (MCP Tool Server)
                        </h3>
                        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
                            <div className="bg-white rounded-lg shadow-md p-4 text-center">
                                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <span className="text-white font-bold">⚡</span>
                                </div>
                                <h4 className="font-semibold text-green-600">FastAPI</h4>
                                <p className="text-xs text-gray-600">Async Python Web Framework</p>
                            </div>
                            <div className="bg-white rounded-lg shadow-md p-4 text-center">
                                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <span className="text-white font-bold">🐍</span>
                                </div>
                                <h4 className="font-semibold text-blue-600">Python 3.13</h4>
                                <p className="text-xs text-gray-600">Runtime Environment</p>
                            </div>
                            <div className="bg-white rounded-lg shadow-md p-4 text-center">
                                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <span className="text-white font-bold">🔗</span>
                                </div>
                                <h4 className="font-semibold text-purple-600">LangChain</h4>
                                <p className="text-xs text-gray-600">OpenAI Embeddings Integration</p>
                            </div>
                            <div className="bg-white rounded-lg shadow-md p-4 text-center">
                                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <span className="text-white font-bold">🧠</span>
                                </div>
                                <h4 className="font-semibold text-orange-600">In-Memory Store</h4>
                                <p className="text-xs text-gray-600">Pure Python Vector Search</p>
                            </div>
                            <div className="bg-white rounded-lg shadow-md p-4 text-center">
                                <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <span className="text-white font-bold">💬</span>
                                </div>
                                <h4 className="font-semibold text-red-600">RAG System</h4>
                                <p className="text-xs text-gray-600">OpenAI GPT + Vector Context</p>
                            </div>
                        </div>
                    </div>

                    {/* AI Services */}
                    <div className="mb-8">
                        <h3 className="text-xl font-semibold text-orange-600 mb-4 text-center">
                            AI & ML Services
                        </h3>
                        <div className="grid md:grid-cols-4 gap-4">
                            <div className="bg-white rounded-lg shadow-md p-4 text-center">
                                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <span className="text-white font-bold">🎤</span>
                                </div>
                                <h4 className="font-semibold text-green-600">OpenAI Whisper</h4>
                                <p className="text-xs text-gray-600">whisper-1 Speech-to-Text</p>
                            </div>
                            <div className="bg-white rounded-lg shadow-md p-4 text-center">
                                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <span className="text-white font-bold">🔍</span>
                                </div>
                                <h4 className="font-semibold text-blue-600">OpenAI Embeddings</h4>
                                <p className="text-xs text-gray-600">text-embedding-ada-002</p>
                            </div>
                            <div className="bg-white rounded-lg shadow-md p-4 text-center">
                                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <span className="text-white font-bold">🤖</span>
                                </div>
                                <h4 className="font-semibold text-purple-600">Google Gemini</h4>
                                <p className="text-xs text-gray-600">2.0 Flash Function Calling</p>
                            </div>
                            <div className="bg-white rounded-lg shadow-md p-4 text-center">
                                <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <span className="text-white font-bold">💬</span>
                                </div>
                                <h4 className="font-semibold text-red-600">OpenAI GPT</h4>
                                <p className="text-xs text-gray-600">gpt-3.5-turbo RAG Generation</p>
                            </div>
                        </div>
                    </div>

                    {/* DevOps */}
                    <div>
                        <h3 className="text-xl font-semibold text-gray-600 mb-4 text-center">
                            DevOps & Infrastructure
                        </h3>
                        <div className="grid md:grid-cols-4 gap-4">
                            <div className="bg-white rounded-lg shadow-md p-4 text-center">
                                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <span className="text-white font-bold">🐳</span>
                                </div>
                                <h4 className="font-semibold text-blue-600">Docker</h4>
                                <p className="text-xs text-gray-600">Containerization</p>
                            </div>
                            <div className="bg-white rounded-lg shadow-md p-4 text-center">
                                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <span className="text-white font-bold">📦</span>
                                </div>
                                <h4 className="font-semibold text-green-600">Poetry</h4>
                                <p className="text-xs text-gray-600">Python Dependencies</p>
                            </div>
                            <div className="bg-white rounded-lg shadow-md p-4 text-center">
                                <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <span className="text-white font-bold">🌐</span>
                                </div>
                                <h4 className="font-semibold text-red-600">JSON-RPC 2.0</h4>
                                <p className="text-xs text-gray-600">Tool Invocation Protocol</p>
                            </div>
                            <div className="bg-white rounded-lg shadow-md p-4 text-center">
                                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <span className="text-white font-bold">📡</span>
                                </div>
                                <h4 className="font-semibold text-orange-600">MCP</h4>
                                <p className="text-xs text-gray-600">Model Context Protocol</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Performance Metrics */}
                <section className="mb-16">
                    <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
                        Performance Metrics
                    </h2>
                    <div className="grid md:grid-cols-4 gap-6">
                        <div className="bg-white rounded-lg shadow-md p-6 text-center">
                            <div className="text-3xl font-bold text-blue-600 mb-2">~50ms</div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Vector Search</h3>
                            <p className="text-sm text-gray-600">Pure Python cosine similarity search response time</p>
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6 text-center">
                            <div className="text-3xl font-bold text-green-600 mb-2">~1-3s</div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Voice Transcription</h3>
                            <p className="text-sm text-gray-600">OpenAI Whisper speech-to-text processing</p>
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6 text-center">
                            <div className="text-3xl font-bold text-red-600 mb-2">~1-3s</div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">RAG Response</h3>
                            <p className="text-sm text-gray-600">End-to-end retrieval + generation time</p>
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6 text-center">
                            <div className="text-3xl font-bold text-purple-600 mb-2">~25MB</div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Bundle Size</h3>
                            <p className="text-sm text-gray-600">Vercel-optimized serverless deployment</p>
                        </div>
                    </div>
                </section>

                {/* Use Cases */}
                <section className="mb-16">
                    <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
                        Use Cases & Examples
                    </h2>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h3 className="text-xl font-semibold text-blue-600 mb-4">
                                🔍 Quick Product Search
                            </h3>
                            <div className="space-y-3">
                                <div className="p-3 bg-gray-50 rounded">
                                    <p className="text-sm font-semibold text-gray-700">Query:</p>
                                    <p className="text-sm text-gray-600">&quot;Show me red hoodies under $40&quot;</p>
                                </div>
                                <div className="p-3 bg-blue-50 rounded">
                                    <p className="text-sm font-semibold text-blue-700">Response:</p>
                                    <p className="text-sm text-blue-600">Filtered product list with exact matches</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h3 className="text-xl font-semibold text-red-600 mb-4">
                                💬 Conversational Assistance
                            </h3>
                            <div className="space-y-3">
                                <div className="p-3 bg-gray-50 rounded">
                                    <p className="text-sm font-semibold text-gray-700">Query:</p>
                                    <p className="text-sm text-gray-600">&quot;I need something comfortable for weekend casual wear&quot;</p>
                                </div>
                                <div className="p-3 bg-red-50 rounded">
                                    <p className="text-sm font-semibold text-red-700">Response:</p>
                                    <p className="text-sm text-red-600">AI-generated recommendations with explanations</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="text-center pt-8 border-t border-gray-200">
                    <p className="text-gray-600 mb-4">
                        Built with ❤️ by Manoj using Model Context Protocol principles + RAG technology
                    </p>
                    <div className="flex justify-center space-x-4">
                        <a 
                            href="https://github.com/mkg5599/mcp-voice-app" 
                            className="text-blue-600 hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            GitHub Repository
                        </a>
                        <a 
                            href={`${process.env.BACKEND_INTERNAL_URL}/docs`} 
                            className="text-purple-600 hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            API Documentation
                        </a>
                        <Link 
                            href="/rag" 
                            className="text-red-600 hover:underline"
                        >
                            Try AI Chat Assistant
                        </Link>
                    </div>
                </footer>
            </div>
        </main>
    );
}