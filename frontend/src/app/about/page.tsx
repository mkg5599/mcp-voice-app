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
                        Voice + Natural Language Product Search
                    </p>
                    <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                        Powered by{" "}
                        <span className="font-semibold text-blue-600">Gemini 2.0 Flash</span>,{" "}
                        <span className="font-semibold text-green-600">OpenAI Whisper</span>,{" "}
                        <span className="font-semibold text-purple-600">FastAPI</span>, and{" "}
                        <span className="font-semibold text-orange-600">
                            Model Context Protocol
                        </span>
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
                                <h3 className="font-semibold text-green-700">Next.js Frontend</h3>
                                <p className="text-sm text-gray-600 text-center">
                                    Transcription & LLM Orchestration
                                </p>
                            </div>

                            <div className="hidden md:block text-gray-400">→</div>

                            <div className="flex flex-col items-center p-4 bg-purple-50 rounded-lg flex-1">
                                <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mb-3">
                                    <span className="text-white font-bold text-lg">3</span>
                                </div>
                                <h3 className="font-semibold text-purple-700">Gemini 2.0</h3>
                                <p className="text-sm text-gray-600 text-center">
                                    Function Calling & Interpretation
                                </p>
                            </div>

                            <div className="hidden md:block text-gray-400">→</div>

                            <div className="flex flex-col items-center p-4 bg-orange-50 rounded-lg flex-1">
                                <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mb-3">
                                    <span className="text-white font-bold text-lg">4</span>
                                </div>
                                <h3 className="font-semibold text-orange-700">FastAPI Backend</h3>
                                <p className="text-sm text-gray-600 text-center">MCP Tool Server</p>
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
                                Voice & Text Input
                            </h3>
                            <p className="text-gray-600">
                                Search for products using either spoken commands or typed text
                                with Whisper transcription.
                            </p>
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                            <h3 className="text-xl font-semibold text-green-600 mb-3">
                                Gemini Integration
                            </h3>
                            <p className="text-gray-600">
                                Leverages Gemini 2.0 Flash for intelligent product filtering
                                based on natural language queries.
                            </p>
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                            <h3 className="text-xl font-semibold text-purple-600 mb-3">
                                MCP Protocol
                            </h3>
                            <p className="text-gray-600">
                                Model Context Protocol enables robust backend integration with
                                automatic tool discovery.
                            </p>
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                            <h3 className="text-xl font-semibold text-orange-600 mb-3">
                                Function Calling
                            </h3>
                            <p className="text-gray-600">
                                Gemini automatically calls backend functions via JSON-RPC 2.0 over
                                HTTP.
                            </p>
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                            <h3 className="text-xl font-semibold text-red-600 mb-3">
                                Responsive UI
                            </h3>
                            <p className="text-gray-600">
                                Clean, modern interface with real-time product search results and
                                filtering.
                            </p>
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                            <h3 className="text-xl font-semibold text-indigo-600 mb-3">
                                Docker Ready
                            </h3>
                            <p className="text-gray-600">
                                Easily deployable using Docker Compose for local development and
                                production.
                            </p>
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
                                Backend (FastAPI)
                            </h3>
                            <ul className="space-y-2">
                                <li>
                                    <Link
                                        href={`${process.env.BACKEND_INTERNAL_URL}/.well-known/mcp.json`}
                                        className="text-blue-600 hover:underline"
                                    >
                                        📋 MCP Discovery: /.well-known/mcp.json
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href={`${process.env.BACKEND_INTERNAL_URL}/products`}
                                        className="text-blue-600 hover:underline"
                                    >
                                        📦 List Products: /products
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href={`${process.env.BACKEND_INTERNAL_URL}/docs`}
                                        className="text-blue-600 hover:underline"
                                    >
                                        📚 Swagger UI: /docs
                                    </Link>
                                </li>
                            </ul>
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h3 className="text-xl font-semibold text-green-600 mb-4">
                                Frontend (Next.js)
                            </h3>
                            <ul className="space-y-2">
                                <li className="text-green-600">
                                    🤖 Gemini Orchestration: /api/chat
                                </li>
                                <li className="text-green-600">
                                    🎤 Whisper Transcription: /api/transcribe
                                </li>
                            </ul>
                            <p className="text-sm text-gray-500 mt-4">
                                Frontend API routes are internal server endpoints
                            </p>
                        </div>
                    </div>
                </section>

                {/* How It Works */}
                <section className="mb-16">
                    <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
                        How It Works
                    </h2>
                    <div className="bg-white rounded-lg shadow-md p-8">
                        <ol className="space-y-4">
                            <li className="flex items-start">
                                <span className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold mr-4">
                                    1
                                </span>
                                <div>
                                    <h4 className="font-semibold text-gray-800">User Input</h4>
                                    <p className="text-gray-600">
                                        User speaks or types a product search query
                                    </p>
                                </div>
                            </li>
                            <li className="flex items-start">
                                <span className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold mr-4">
                                    2
                                </span>
                                <div>
                                    <h4 className="font-semibold text-gray-800">
                                        Transcription & Processing
                                    </h4>
                                    <p className="text-gray-600">
                                        Frontend transcribes voice (if needed) and sends to Gemini via{" "}
                                        <code>/api/chat</code>
                                    </p>
                                </div>
                            </li>
                            <li className="flex items-start">
                                <span className="flex-shrink-0 w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold mr-4">
                                    3
                                </span>
                                <div>
                                    <h4 className="font-semibold text-gray-800">Function Calling</h4>
                                    <p className="text-gray-600">
                                        Gemini interprets query and calls backend tools via MCP (
                                        <code>/mcp</code>)
                                    </p>
                                </div>
                            </li>
                            <li className="flex items-start">
                                <span className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold mr-4">
                                    4
                                </span>
                                <div>
                                    <h4 className="font-semibold text-gray-800">Backend Processing</h4>
                                    <p className="text-gray-600">
                                        Backend executes product search functions and returns results
                                    </p>
                                </div>
                            </li>
                            <li className="flex items-start">
                                <span className="flex-shrink-0 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center font-bold mr-4">
                                    5
                                </span>
                                <div>
                                    <h4 className="font-semibold text-gray-800">Result Display</h4>
                                    <p className="text-gray-600">
                                        Gemini summarizes results and frontend displays them to the user
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
                    <div className="grid md:grid-cols-4 gap-6">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                                <span className="text-white font-bold">⚛️</span>
                            </div>
                            <h3 className="font-semibold text-blue-600">Next.js</h3>
                            <p className="text-sm text-gray-600">React + TypeScript</p>
                        </div>
                        <div className="text-center">
                            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                                <span className="text-white font-bold">🤖</span>
                            </div>
                            <h3 className="font-semibold text-green-600">Gemini 2.0</h3>
                            <p className="text-sm text-gray-600">Function Calling</p>
                        </div>
                        <div className="text-center">
                            <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-3">
                                <span className="text-white font-bold">🐍</span>
                            </div>
                            <h3 className="font-semibold text-purple-600">FastAPI</h3>
                            <p className="text-sm text-gray-600">Python Backend</p>
                        </div>
                        <div className="text-center">
                            <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-3">
                                <span className="text-white font-bold">🎤</span>
                            </div>
                            <h3 className="font-semibold text-orange-600">Whisper</h3>
                            <p className="text-sm text-gray-600">Speech-to-Text</p>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}