"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatEvent, ChatTurn } from "./chatTypes";
import { LIMITS } from "./chatTypes";
import type { Product } from "../types/product";

export interface ToolRun {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: "running" | "ok" | "error";
  method?: string;
  count?: number;
  products?: Product[];
  error?: string;
}

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools: ToolRun[];
  status: "streaming" | "done" | "error" | "stopped";
  error?: string;
}

let seq = 0;
const nextId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

export function useChat(opts: { onTurnComplete?: (m: UiMessage) => void; onProducts?: (run: ToolRun) => void } = {}) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  const send = useCallback(
    async (text: string) => {
      const content = text.trim().slice(0, LIMITS.maxCharsPerTurn);
      if (!content || abortRef.current) return;

      const user: UiMessage = { id: nextId(), role: "user", content, tools: [], status: "done" };
      const assistantId = nextId();
      const history: ChatTurn[] = [...messages, user]
        .filter((m) => m.content.trim() && (m.role === "user" || m.status === "done"))
        .map((m) => ({ role: m.role, content: m.content }))
        .slice(-LIMITS.maxTurns);

      // The assistant message is tracked locally (synchronously) and mirrored into state.
      let local: UiMessage = { id: assistantId, role: "assistant", content: "", tools: [], status: "streaming" };
      setMessages((prev) => [...prev, user, local]);
      setBusy(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      // Tool-call arguments by id, so results can be reported with them synchronously.
      const callArgs = new Map<string, Record<string, unknown>>();
      const update = (fn: (m: UiMessage) => UiMessage) => {
        local = fn(local);
        const snapshot = local;
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? snapshot : m)));
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message ?? `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.trim()) handleEvent(JSON.parse(line) as ChatEvent);
          }
        }
        update((m) => (m.status === "streaming" ? { ...m, status: "done" } : m));
      } catch (err) {
        if (ctrl.signal.aborted) {
          update((m) => ({ ...m, status: "stopped", tools: m.tools.map(stopTool) }));
        } else {
          const message = err instanceof Error ? err.message : "Network error";
          update((m) => ({ ...m, status: "error", error: message, tools: m.tools.map(stopTool) }));
        }
      } finally {
        abortRef.current = null;
        setBusy(false);
        optsRef.current.onTurnComplete?.(local);
      }

      function handleEvent(e: ChatEvent) {
        switch (e.type) {
          case "text":
            update((m) => ({ ...m, content: m.content + e.delta }));
            break;
          case "tool_call":
            callArgs.set(e.id, e.args);
            update((m) => ({
              ...m,
              tools: [...m.tools, { id: e.id, name: e.name, args: e.args, status: "running" }],
            }));
            break;
          case "tool_result": {
            const run: Partial<ToolRun> = {
              status: e.ok ? "ok" : "error",
              method: e.method,
              count: e.count,
              products: e.products,
              error: e.error,
            };
            update((m) => ({
              ...m,
              tools: m.tools.map((t) => (t.id === e.id ? { ...t, ...run } : t)),
            }));
            if (e.ok && e.products) {
              optsRef.current.onProducts?.({ id: e.id, name: e.name, args: callArgs.get(e.id) ?? {}, ...run, status: "ok" });
            }
            break;
          }
          case "error":
            update((m) => ({ ...m, status: "error", error: e.message }));
            break;
          case "done":
            update((m) => ({ ...m, status: "done" }));
            break;
        }
      }
    },
    [messages],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
  }, []);

  return { messages, busy, send, stop, reset };
}

function stopTool(t: ToolRun): ToolRun {
  return t.status === "running" ? { ...t, status: "error", error: "Stopped" } : t;
}
