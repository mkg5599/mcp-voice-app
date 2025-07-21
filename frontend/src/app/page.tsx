"use client";

import { useState, useEffect, useRef } from "react";
import { Product } from "../types/product";
import SearchPromptModal from "../components/SearchPromptModal";
import { Bot } from "lucide-react";
import Link from "next/link";

const formatPrice = (p: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    p,
  );

const ProductCard = ({ product }: { product: Product }) => (
  <div className="bg-white rounded-lg border shadow-md p-6 hover:shadow-lg transition-shadow">
    <div className="mb-3 flex items-start justify-between">
      <h3 className="text-lg font-bold text-gray-800">{product.name}</h3>
      <span className="rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-3 py-1 text-sm font-semibold text-white">
        {formatPrice(product.price)}
      </span>
    </div>
    <div className="space-y-2 text-sm text-gray-600">
      <p>
        <span className="font-semibold text-gray-700">City:</span> {product.city}
      </p>
      <div className="flex items-center">
        <span className="mr-2 font-semibold text-gray-700">Colors:</span>
        <div className="flex gap-2">
          {product.colors.map((c) => (
            <span
              key={c}
              className="h-5 w-5 rounded-full border-2 border-gray-300 shadow-sm"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [modelMessage, setModelMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function handleSearch(query: string) {
    const q = query.trim();
    if (!q) return;
    setIsLoading(true);
    setModelMessage("");
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: q }),
      });
      const data = await r.json();
      if (r.ok) {
        if (Array.isArray(data.products)) {
          setProducts(data.products as Product[]);
          setModelMessage(data.message || "");
        } else {
          setProducts([]);
          setModelMessage(data.message || "No tool results.");
        }
      } else {
        console.error("chat error", data.error);
        setProducts([]);
        setModelMessage(data.error || "Error");
      }
    } catch (e) {
      console.error("fetch error", e);
      setProducts([]);
      setModelMessage("Network error");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // initial load
    handleSearch("list all products");
  }, []);

  const onPromptSelect = (prompt: string) => {
    setSearchText(prompt);
    handleSearch(prompt);
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
    setSearchText("…transcribing audio…");
    setModelMessage("");

    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (response.ok && data?.text) {
        setSearchText(data.text);
        await handleSearch(data.text);
      } else {
        console.error("Transcription error:", data?.error || data);
        setSearchText("");
        setModelMessage("Transcription failed");
      }
    } catch (error: unknown) {
      console.error(
        "Error sending audio to server:",
        error instanceof Error ? error.message : error,
      );
      setSearchText("");
      setModelMessage("Transcription network error");
    } finally {
      setIsTranscribing(false);
    }
  };

  const canInteract = !isTranscribing;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <header className="bg-white/95 backdrop-blur-md shadow-lg border-b border-indigo-100">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Product Catalog
            </Link>
            <Link
              href="/about"
              className="text-lg font-semibold text-gray-700 hover:text-blue-600 transition-colors"
            >
              About
            </Link>
          </div>

          <div className="relative flex w-full max-w-lg items-center">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-blue-600">
              <Bot size={20} className="inline" />
            </span>

            <input
              className="pl-12 pr-16 w-full rounded-l-lg border-2 border-blue-200 bg-white/90 px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 shadow-sm"
              disabled={!canInteract}
              placeholder="Ask AI about products…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch(searchText)}
            />

            <button
              onClick={handleMicClick}
              disabled={!canInteract}
              className={`absolute right-0 inset-y-0 flex items-center px-4 rounded-r-lg border-2 border-l-0 border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 shadow-sm
          ${isTranscribing ? "bg-yellow-500 text-white animate-pulse"
                  : isRecording ? "bg-red-500 text-white shadow-md"
                    : "bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600"}
                  disabled:opacity-50`}
              title={isRecording ? "Stop recording" : "Start recording"}
            >
              {isTranscribing ? "…" : isRecording ? "■" : "🎤"}
            </button>
          </div>
        </div>
      </header>

      <section className="text-center py-12 px-6">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
          Agentic Product Search
        </h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-3">Talk or type to explore our catalog</h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Powered by <span className="font-semibold text-blue-600">Gemini Flash</span> +
          <span className="font-semibold text-green-600"> Whisper</span> ·
          Tools exposed through the <span className="font-semibold text-purple-600">Model Context Protocol</span>
        </p>
      </section>

      <main className="container mx-auto px-6 py-8 space-y-8">
        <div className="flex justify-center">
          <SearchPromptModal onSelect={onPromptSelect} />
        </div>

        {modelMessage && !products.length && (
          <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6 text-center">
            <p className="text-gray-700 text-lg">{modelMessage}</p>
          </div>
        )}

        {isLoading ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-8 text-center">
            <div className="inline-flex items-center gap-3">
              <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-700 text-lg">Loading products...</p>
            </div>
          </div>
        ) : products.length ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          !modelMessage && (
            <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-8 text-center">
              <p className="text-gray-600 text-lg">No products found.</p>
            </div>
          )
        )}
      </main>
    </div>
  );
}