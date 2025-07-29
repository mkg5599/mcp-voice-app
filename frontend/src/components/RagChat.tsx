"use client";

import { useState, useRef, useEffect } from "react";
import { RagRequest, RagResponse, Product } from "../types/product";
import { Bot, User, Send, Mic, Loader2, Sparkles } from "lucide-react";

interface ChatMessage {
    id: string;
    type: 'user' | 'assistant';
    content: string;
    products?: Product[];
    timestamp: Date;
    processing_time?: number;
}

interface RagChatProps {
    onProductsFound?: (products: Product[]) => void;
}

export default function RagChat({ onProductsFound }: RagChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Initialize with welcome message
    useEffect(() => {
        setMessages([{
            id: '1',
            type: 'assistant',
            content: "Hi! I'm your AI product assistant. Ask me anything about our products - I can help you find items, compare options, get recommendations, and answer questions about our catalog. What are you looking for today?",
            timestamp: new Date(),
        }]);
    }, []);

    const sendRagQuery = async (query: string) => {
        if (!query.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'user',
            content: query,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        setInput("");

        try {
            const ragRequest: RagRequest = {
                query: query.trim(),
                context_size: 5,
            };

            const response = await fetch('/api/rag', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ragRequest),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data: RagResponse = await response.json();

            const assistantMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                type: 'assistant',
                content: data.ai_response,
                products: data.retrieved_products,
                timestamp: new Date(),
                processing_time: data.processing_time_ms,
            };

            setMessages(prev => [...prev, assistantMessage]);

            // Notify parent component about found products
            if (data.retrieved_products.length > 0 && onProductsFound) {
                onProductsFound(data.retrieved_products);
            }

        } catch (error) {
            console.error('RAG query error:', error);
            const errorMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                type: 'assistant',
                content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendRagQuery(input);
    };

    const handleMicClick = () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            cleanupStream();
            return;
        }

        navigator.mediaDevices
            .getUserMedia({ audio: true })
            .then((stream) => {
                streamRef.current = stream;
                const mr = new MediaRecorder(stream);
                mediaRecorderRef.current = mr;
                const chunks: Blob[] = [];

                mr.ondataavailable = (e: BlobEvent) => {
                    if (e.data && e.data.size > 0) chunks.push(e.data);
                };

                mr.onstop = async () => {
                    setIsRecording(false);
                    const blob = new Blob(chunks, { type: "audio/webm" });
                    await sendAudioToServer(blob);
                    cleanupStream();
                };

                mr.start();
                setIsRecording(true);
            })
            .catch((err) => {
                console.error("Error accessing microphone:", err);
            });
    };

    function cleanupStream() {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
    }

    const sendAudioToServer = async (audioBlob: Blob) => {
        setIsTranscribing(true);

        const formData = new FormData();
        formData.append("file", audioBlob, "recording.webm");

        try {
            const response = await fetch("/api/transcribe", {
                method: "POST",
                body: formData,
            });
            const data = await response.json();
            if (response.ok && data?.text) {
                setInput(data.text);
                await sendRagQuery(data.text);
            } else {
                console.error("Transcription error:", data?.error || data);
            }
        } catch (error: unknown) {
            console.error(
                "Error sending audio to server:",
                error instanceof Error ? error.message : error,
            );
        } finally {
            setIsTranscribing(false);
        }
    };

    const formatPrice = (p: number) =>
        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(p);

    const quickPrompts = [
        "What are your most popular items?",
        "Show me comfortable hoodies under $50",
        "I need winter clothing for cold weather",
        "What items do you have in Seattle?",
        "Compare red vs blue products",
        "What's good for outdoor activities?",
    ];

    const handleQuickPrompt = (prompt: string) => {
        setInput(prompt);
        sendRagQuery(prompt);
    };

    return (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 h-[600px] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50 rounded-t-lg">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800">AI Product Assistant</h3>
                        <p className="text-sm text-gray-600">Powered by RAG & OpenAI</p>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-lg p-3 ${message.type === 'user'
                                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                        >
                            <div className="flex items-start gap-2 mb-2">
                                {message.type === 'user' ? (
                                    <User className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                ) : (
                                    <Bot className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                )}
                                <div className="flex-1">
                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                </div>
                            </div>

                            {/* Products */}
                            {message.products && message.products.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    <p className="text-xs font-semibold text-gray-600">
                                        Found {message.products.length} relevant product(s):
                                    </p>
                                    {message.products.slice(0, 3).map((product) => (
                                        <div
                                            key={product.id}
                                            className="bg-white rounded-lg p-3 border border-gray-200 text-gray-800"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-semibold text-sm">{product.name}</h4>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-blue-600">
                                                        {formatPrice(product.price)}
                                                    </span>
                                                    {product.similarity_score && (
                                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                                            {Math.round(product.similarity_score * 100)}% match
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {product.description && (
                                                <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                                                    {product.description}
                                                </p>
                                            )}
                                            <div className="flex items-center justify-between text-xs text-gray-500">
                                                <span>{product.city}</span>
                                                <div className="flex gap-1">
                                                    {product.colors.slice(0, 3).map((color) => (
                                                        <div
                                                            key={color}
                                                            className="w-3 h-3 rounded-full border border-gray-300"
                                                            style={{ backgroundColor: color }}
                                                            title={color}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {message.products.length > 3 && (
                                        <p className="text-xs text-gray-600">
                                            +{message.products.length - 3} more products found
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Timestamp and processing time */}
                            <div className="flex justify-between items-center mt-2 text-xs opacity-70">
                                <span>
                                    {message.timestamp.toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </span>
                                {message.processing_time && (
                                    <span>{message.processing_time}ms</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-100 rounded-lg p-3 max-w-[80%]">
                            <div className="flex items-center gap-2">
                                <Bot className="w-4 h-4" />
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-sm text-gray-600">Thinking...</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompts */}
            {messages.length <= 1 && (
                <div className="p-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">Try asking:</p>
                    <div className="flex flex-wrap gap-2">
                        {quickPrompts.map((prompt) => (
                            <button
                                key={prompt}
                                onClick={() => handleQuickPrompt(prompt)}
                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-full transition-colors"
                                disabled={isLoading}
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-gray-200">
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={
                                isTranscribing
                                    ? "Transcribing..."
                                    : "Ask me about products..."
                            }
                            disabled={isLoading || isTranscribing}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={handleMicClick}
                        disabled={isLoading || isTranscribing}
                        className={`p-2 rounded-lg border border-gray-300 transition-all duration-200 ${isTranscribing
                                ? "bg-yellow-500 text-white animate-pulse"
                                : isRecording
                                    ? "bg-red-500 text-white"
                                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                            } disabled:opacity-50`}
                        title={isRecording ? "Stop recording" : "Voice input"}
                    >
                        <Mic className="w-4 h-4" />
                    </button>

                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading || isTranscribing}
                        className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </form>
            </div>
        </div>
    );
}