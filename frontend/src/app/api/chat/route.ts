import {
  GoogleGenAI,
  FunctionCallingConfigMode,
  Type,
  ToolUnion,
  Part,
} from "@google/genai";
import type { Content } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const tools: ToolUnion[] = [
  {
    functionDeclarations: [
      {
        name: "list_products",
        description: "Return all products",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "search_products",
        description: "Filter by colors, city and price",
        parameters: {
          type: Type.OBJECT,
          properties: {
            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
            city: { type: Type.STRING },
            min_price: { type: Type.NUMBER },
            max_price: { type: Type.NUMBER },
          },
        },
      },
    ],
  },
];

async function callApi<T = unknown>(
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const r = await fetch(`${BACKEND_URL}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: name,
      params: args,
      id: Date.now(),
    }),
  });
  if (!r.ok) throw new Error(`MCP ${r.status}`);
  const body = await r.json();
  if (body.error) throw new Error(body.error.message);
  return body.result as T;
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (typeof text !== "string" || text.trim() === "")
      return NextResponse.json({ error: "No text" }, { status: 400 });

    const first = await ai.models.generateContent({
      model: "gemini-2.0-flash-001",
      contents: text,
      config: {
        tools,
        toolConfig: {
          functionCallingConfig: { mode: FunctionCallingConfigMode.ANY },
        },
      },
    });

    const fc = first.functionCalls?.[0];
    if (!fc || typeof fc.name !== "string") {
      return NextResponse.json({ message: first.text ?? "" });
    }

    const toolResult = await callApi(fc.name, fc.args ?? {});

    if (Array.isArray(toolResult)) {
      return NextResponse.json({
        products: toolResult,
        message: `Found ${toolResult.length} matching products.`,
      });
    }

    const conversation: Content[] = [
      { role: "user", parts: [{ text }] },
      { role: "model", parts: [{ functionCall: fc }] },
      {
        role: "user",
        parts: [
          {
            functionResponse: {
              name: fc.name,
              response: toolResult as Record<string, unknown>,
            },
          } as Part,
        ],
      },
    ];

    const second = await ai.models.generateContent({
      model: "gemini-2.0-flash-001",
      contents: conversation,
      config: {
        toolConfig: {
          functionCallingConfig: { mode: FunctionCallingConfigMode.NONE },
        },
      },
    });

    return NextResponse.json({
      message: second.text ?? "",
      result: toolResult,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/chat]", msg);
    return NextResponse.json(
      { error: "chat failed", details: msg },
      { status: 500 },
    );
  }
}