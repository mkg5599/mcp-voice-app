/**
 * Server-side configuration. Model names come from env vars so a provider
 * retiring a model is a settings change, not a code change.
 */
export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  /** Optional API base URL override (a proxy, or a local mock in tests). */
  geminiBaseUrl: process.env.GEMINI_BASE_URL || undefined,
  /** Chat/agent model. The "-latest" alias follows Google's current Flash model. */
  chatModel: process.env.GEMINI_MODEL ?? "gemini-flash-latest",
  /**
   * How much the chat model reasons before answering: minimal | low | medium | high.
   * Lower is faster and cheaper; "low" is plenty for catalog questions. Set it to an empty
   * value to use the model's default (needed for older models without thinking levels).
   */
  thinkingLevel: (process.env.GEMINI_THINKING_LEVEL ?? "low").trim().toUpperCase(),
  /** Speech-to-text model (Gemini understands audio natively). */
  transcribeModel: process.env.GEMINI_TRANSCRIBE_MODEL ?? "gemini-flash-lite-latest",
  /** Base URL of the FastAPI backend; its MCP endpoint is `${backendUrl}/mcp`. */
  backendUrl: (process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000").replace(/\/+$/, ""),
  /**
   * Rate limits as "max/windowSeconds". Per visitor (by IP) and site-wide per server
   * instance. "0/1" disables a limit.
   */
  limits: {
    chatPerVisitor: process.env.RATE_LIMIT_CHAT ?? "20/600",
    chatGlobal: process.env.RATE_LIMIT_CHAT_GLOBAL ?? "300/3600",
    transcribePerVisitor: process.env.RATE_LIMIT_TRANSCRIBE ?? "15/600",
    transcribeGlobal: process.env.RATE_LIMIT_TRANSCRIBE_GLOBAL ?? "200/3600",
  },
  /** Safety cap on tool-calling rounds per user message. */
  maxAgentSteps: Number(process.env.AGENT_MAX_STEPS ?? 5),
};
