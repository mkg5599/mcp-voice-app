import type { Product } from "../types/product";

/** One line of the NDJSON stream sent by /api/chat. */
export type ChatEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; id: string; name: string; args: Record<string, unknown> }
  | {
      type: "tool_result";
      id: string;
      name: string;
      ok: boolean;
      method?: string;
      count?: number;
      products?: Product[];
      error?: string;
    }
  | { type: "error"; code: string; message: string }
  | { type: "done"; model: string; latency_ms: number; steps: number };

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export const LIMITS = {
  maxTurns: 30,
  maxCharsPerTurn: 4000,
};
