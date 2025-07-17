"use client";

import { useState, useEffect, useRef } from "react";
import { Product } from "../types/product";
import SearchPromptModal from "../components/SearchPromptModal";

const formatPrice = (p: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    p,
  );

const ProductCard = ({ product }: { product: Product }) => (
  <div className="rounded-lg border p-4 shadow-sm transition hover:shadow-md">
    <div className="mb-2 flex items-start justify-between">
      <h3 className="text-lg font-bold text-gray-800">{product.name}</h3>
      <span className="rounded-full bg-blue-100 px-2 py-1 text-sm font-semibold text-blue-600">
        {formatPrice(product.price)}
      </span>
    </div>
    <div className="space-y-1 text-sm text-gray-600">
      <p>
        <span className="font-semibold">City:</span> {product.city}
      </p>
      <div className="flex items-center">
        <span className="mr-2 font-semibold">Colors:</span>
        <div className="flex gap-2">
          {product.colors.map((c) => (
            <span
              key={c}
              className="h-5 w-5 rounded-full border border-gray-300"
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
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  async function handleSearch(query: string) {
    setIsLoading(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: query }),
      });
      const data = await r.json();
      if (r.ok) {
        if (data.products) setProducts(data.products);
        else setProducts([]);
      } else console.error("chat error", data.error);
    } catch (e) {
      console.error("fetch error", e);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }

  /* initial load */
  useEffect(() => {
    handleSearch("list all products");
  }, []);

  const onPromptSelect = (prompt: string) => {
    setSearchText(prompt);
    handleSearch(prompt);
  };

  const handleMicClick = () => {
    // Toggle behavior: first click starts, second click stops
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return; // onstop handler will finish up
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
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
        };

        mr.start();
        setIsRecording(true);
      })
      .catch((err) => {
        console.error("Error accessing microphone:", err);
      });
  };

  const sendAudioToServer = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    setSearchText("…transcribing audio…");

    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (response.ok && data?.text) {
        // Show transcript in input, then search
        setSearchText(data.text);
        await handleSearch(data.text);
      } else {
        console.error("Transcription error:", data?.error || data);
        setSearchText("");
      }
    } catch (error: unknown) {
      console.error(
        "Error sending audio to server:",
        error instanceof Error ? error.message : error,
      );
      setSearchText("");
    } finally {
      setIsTranscribing(false);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">Product Catalog</h1>

          <div className="flex w-full max-w-md items-center gap-2">
            <input
              type="text"
              disabled={isTranscribing}
              placeholder="Search products..."
              className="w-full rounded-l-md border border-gray-300 px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch(searchText);
              }}
            />
            <button
              onClick={handleMicClick}
              disabled={isTranscribing}
              className={`rounded-r-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isTranscribing
                  ? "bg-yellow-400 text-white animate-pulse"
                  : isRecording
                  ? "bg-red-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {isTranscribing ? "…" : "🎤"}
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4">
          <SearchPromptModal onSelect={onPromptSelect} />
        </div>

        {isLoading ? (
          <p className="text-center text-gray-500">Loading products...</p>
        ) : products.length ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">No products found.</p>
        )}
      </main>
    </div>
  );
}