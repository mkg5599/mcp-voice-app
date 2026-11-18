import { ApiError } from "@google/genai";

/** Map provider and network failures to messages a visitor can act on. */
export function describeError(err: unknown): { code: string; message: string; status: number } {
  const raw = err instanceof Error ? err.message : String(err);
  // The SDK nests Google's JSON error inside the message; the innermost "code" is the real HTTP status.
  const codes = [...raw.matchAll(/"code":\s*(\d{3})/g)].map((m) => Number(m[1]));
  const status = codes.at(-1) ?? (err instanceof ApiError ? err.status : undefined);

  if (status !== undefined) {
    // Google reports depleted prepaid credits as 402 + RESOURCE_EXHAUSTED, so check 402 first.
    if (status === 402) {
      return {
        code: "quota_exhausted",
        status: 503,
        message: "The AI service's usage credits are used up. The site owner needs to top up the Gemini project.",
      };
    }
    if (status === 429) {
      return {
        code: "rate_limited",
        status: 429,
        message: "The AI service is busy or its usage limit was reached. Wait a minute and try again.",
      };
    }
    if (status === 400 && /API key/i.test(raw)) {
      return { code: "bad_api_key", status: 500, message: "The server's Gemini API key is invalid." };
    }
    if (status === 401 || status === 403) {
      return { code: "bad_api_key", status: 500, message: "The server's Gemini API key was rejected." };
    }
    if (status === 404) {
      return {
        code: "model_not_found",
        status: 500,
        message: "The configured Gemini model is unavailable. Check GEMINI_MODEL.",
      };
    }
    if (status >= 500) {
      return { code: "provider_error", status: 502, message: "The AI service had a temporary problem. Try again." };
    }
  }

  if (/ECONNREFUSED|fetch failed|ENOTFOUND|Streamable HTTP|MCP error/i.test(raw)) {
    return { code: "catalog_unreachable", status: 502, message: "Couldn't reach the product catalog server." };
  }

  return { code: "internal_error", status: 500, message: "Something went wrong. Please try again." };
}
