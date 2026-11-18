"use client";

import { ArrowUp, Mic, RotateCcw, Square, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { speak, speechSupported, stopSpeaking } from "../lib/speech";
import { useChat, type ToolRun } from "../lib/useChat";
import { useIsClient } from "../lib/useIsClient";
import { useRecorder } from "../lib/useRecorder";
import type { Product, ProductResults } from "../types/product";
import { ChatMessage } from "./ChatMessage";
import { ProductCard } from "./ProductCard";

const SUGGESTIONS = [
  "Something warm for a winter hike",
  "Red items under $50",
  "Compare your two cheapest hoodies",
  "What's available in Portland?",
  "A gift for someone who runs",
  "What sizes does the black hoodie come in?",
];

interface Results {
  title: string;
  products: Product[];
}

export function ShoppingAgent() {
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [voiceReplies, setVoiceReplies] = useState(false);
  const [results, setResults] = useState<Results | null>(null);
  const [catalog, setCatalog] = useState<Product[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const voiceRef = useRef(voiceReplies);
  const isClient = useIsClient();

  useEffect(() => {
    voiceRef.current = voiceReplies;
    if (!voiceReplies) stopSpeaking();
  }, [voiceReplies]);

  // A search's results stay in the panel even if the agent then looks up one item's details.
  const turnHasListRef = useRef(false);
  const showRun = (run: ToolRun) =>
    run.products && setResults({ title: resultTitle(run), products: run.products });

  const { messages, busy, send, stop, reset } = useChat({
    onProducts: (run) => {
      if (run.name === "get_product" && turnHasListRef.current) return;
      if (run.name !== "get_product") turnHasListRef.current = true;
      showRun(run);
    },
    onTurnComplete: (m) => {
      if (voiceRef.current && m.status === "done" && m.content) speak(m.content);
    },
  });

  const recorder = useRecorder(
    (text) => {
      setNotice(null);
      turnHasListRef.current = false;
      void send(text);
    },
    (message) => setNotice(message),
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products")
      .then((r) => (r.ok ? (r.json() as Promise<ProductResults>) : Promise.reject()))
      .then((d) => !cancelled && setCatalog(d.products))
      .catch(() => !cancelled && setCatalog([]));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const submit = (text = input) => {
    if (!text.trim() || busy) return;
    setNotice(null);
    setInput("");
    stopSpeaking();
    turnHasListRef.current = false;
    void send(text);
  };

  const newChat = () => {
    reset();
    setResults(null);
    setNotice(null);
    stopSpeaking();
    inputRef.current?.focus();
  };

  const shown = results ?? (catalog ? { title: "All products", products: catalog } : null);
  const recording = recorder.state === "recording";
  const transcribing = recorder.state === "transcribing";

  return (
    <div className="mx-auto grid h-[calc(100dvh-3.5rem)] max-w-7xl grid-cols-1 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
      {/* Chat column */}
      <section className="flex min-h-0 flex-col border-border lg:border-r" aria-label="Shopping assistant chat">
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5" aria-live="polite">
          {messages.length === 0 ? (
            <div className="space-y-5 pt-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">What are you shopping for?</h1>
                <p className="mt-1.5 text-muted">
                  Type or tap the mic. The assistant searches the catalog through MCP tools and shows each step it
                  takes.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => <ChatMessage key={m.id} message={m} onSelectRun={showRun} />)
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-bg px-4 pb-4 pt-3">
          {notice && (
            <p role="status" className="mb-2 text-sm text-danger">
              {notice}
            </p>
          )}
          <form
            className="flex items-end gap-2 rounded-2xl border border-border bg-surface p-2 focus-within:border-accent"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={recording ? `Listening… ${recorder.seconds}s` : transcribing ? "Transcribing…" : input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              disabled={recording || transcribing}
              placeholder="Ask about products…"
              aria-label="Message"
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 outline-none placeholder:text-muted disabled:text-muted"
            />
            {recorder.supported && (
              <button
                type="button"
                onClick={recording ? recorder.stop : recorder.start}
                disabled={busy || transcribing}
                aria-label={recording ? "Stop recording" : "Speak your request"}
                title={recording ? "Stop recording" : "Speak your request"}
                className={`grid size-9 shrink-0 place-items-center rounded-full disabled:opacity-40 ${
                  recording ? "animate-pulse bg-danger text-white" : "text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                {recording ? <Square className="size-4" /> : <Mic className="size-5" />}
              </button>
            )}
            {busy ? (
              <button
                type="button"
                onClick={stop}
                aria-label="Stop generating"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-text text-bg"
              >
                <Square className="size-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || recording || transcribing}
                aria-label="Send"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-text disabled:opacity-40"
              >
                <ArrowUp className="size-5" />
              </button>
            )}
          </form>
          <div className="mt-2 flex items-center justify-between text-xs text-muted">
            <button type="button" onClick={newChat} className="flex items-center gap-1 hover:text-text">
              <RotateCcw className="size-3.5" /> New chat
            </button>
            {isClient && speechSupported() && (
              <button
                type="button"
                onClick={() => setVoiceReplies((v) => !v)}
                aria-pressed={voiceReplies}
                className={`flex items-center gap-1 hover:text-text ${voiceReplies ? "text-accent" : ""}`}
              >
                {voiceReplies ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
                Read replies aloud
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Results column (large screens) */}
      <section className="hidden min-h-0 flex-col lg:flex" aria-label="Product results">
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <h2 className="text-sm font-medium">
            {shown?.title ?? "Loading catalog…"}
            {shown && (
              <span className="ml-2 text-muted">
                {shown.products.length} {shown.products.length === 1 ? "item" : "items"}
              </span>
            )}
          </h2>
          {results && (
            <button type="button" onClick={() => setResults(null)} className="text-xs text-muted hover:text-text">
              Show all products
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {shown && shown.products.length === 0 ? (
            <p className="text-muted">{results ? "No matching products." : "The catalog couldn't be loaded."}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {shown?.products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function resultTitle(run: ToolRun): string {
  const q = typeof run.args.query === "string" ? `“${run.args.query}”` : "";
  switch (run.name) {
    case "semantic_product_search":
      return `Results for ${q || "your search"}`;
    case "search_products":
      return "Filtered results";
    case "get_product":
      return "Product details";
    case "list_products":
      return "All products";
    default:
      return run.name;
  }
}
