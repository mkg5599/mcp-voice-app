import "server-only";

import { GoogleGenAI } from "@google/genai";
import { config } from "./config";

let client: GoogleGenAI | null = null;

/**
 * Shared Gemini client. Pinned to v1beta: the SDK's default (v1) doesn't serve the
 * `gemini-*-latest` model aliases, which return 404 there.
 */
export function gemini(): GoogleGenAI {
  client ??= new GoogleGenAI({
    apiKey: config.geminiApiKey,
    apiVersion: "v1beta",
    httpOptions: config.geminiBaseUrl ? { baseUrl: config.geminiBaseUrl } : undefined,
  });
  return client;
}
