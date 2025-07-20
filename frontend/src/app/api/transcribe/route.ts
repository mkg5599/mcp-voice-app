export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";

const MAX_FILE_MB = 5;
const MAX_BYTES = MAX_FILE_MB * 1024 * 1024;
const ACCEPT_MIME_PREFIXES = ["audio/", "video/webm"];
const DEFAULT_MODEL = process.env.WHISPER_MODEL ?? "whisper-1";

interface LogRecord {
  evt: string;
  [k: string]: unknown;
}

function log(rec: LogRecord) {
  console.log(JSON.stringify(rec));
}

interface ErrorPayload {
  error: string;
  code: string;
  detail?: string;
  latency_ms: number;
}

function errorJSON(
  status: number,
  code: string,
  message: string,
  t0: number,
  detail?: string,
  extra?: Record<string, unknown>
) {
  const latency = Date.now() - t0;
  const payload: ErrorPayload = { error: message, code, detail, latency_ms: latency };
  log({ evt: "transcribe_error", code, message, detail, latency_ms: latency, ...extra });
  return NextResponse.json(payload, { status });
}

export async function POST(req: Request) {
  const t0 = Date.now();
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    return errorJSON(500, "CONFIG_ERROR", "OPENAI_API_KEY not configured on server", t0);
  }

  try {
    const formData = await req.formData();
    const uploaded = formData.get("file");

    if (!uploaded || !(uploaded instanceof Blob)) {
      return errorJSON(422, "NO_FILE", "No file uploaded", t0);
    }

    if (uploaded.size === 0) {
      return errorJSON(400, "EMPTY_FILE", "Uploaded file is empty", t0);
    }

    if (uploaded.size > MAX_BYTES) {
      return errorJSON(
        413,
        "FILE_TOO_LARGE",
        `File exceeds ${MAX_FILE_MB}MB (received ${(uploaded.size / 1_048_576).toFixed(2)}MB)`,
        t0
      );
    }

    const mime = uploaded.type || "application/octet-stream";
    const mimeAllowed = ACCEPT_MIME_PREFIXES.some((p) => mime.startsWith(p));
    if (!mimeAllowed) {
      return errorJSON(415, "UNSUPPORTED_MEDIA_TYPE", `Unsupported media type: ${mime}`, t0);
    }

    const url = new URL(req.url);
    const language = url.searchParams.get("lang") || undefined;

    const filename =
      (uploaded as File).name ||
      `audio.${mime.includes("webm") ? "webm" : (mime.split("/")[1] ?? "dat")}`;
    const arrayBuffer = await uploaded.arrayBuffer();
    const fileForOpenAI = new File([arrayBuffer], filename, { type: mime });

    const client = new OpenAI({ apiKey: OPENAI_API_KEY });

    const resp = await client.audio.transcriptions.create({
      model: DEFAULT_MODEL,
      file: fileForOpenAI,
      response_format: "text",
      language,
    });

    const text =
      typeof resp === "string"
        ? resp
        : (resp as { text?: string }).text ?? JSON.stringify(resp);

    const latency = Date.now() - t0;
    log({
      evt: "transcribe_complete",
      filename,
      size_bytes: uploaded.size,
      mime,
      model: DEFAULT_MODEL,
      char_count: text.length,
      language,
      latency_ms: latency,
    });

    return NextResponse.json({
      text,
      filename,
      bytes: uploaded.size,
      model: DEFAULT_MODEL,
      latency_ms: latency,
      language,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJSON(500, "TRANSCRIBE_FAIL", "Transcription failed", t0, msg);
  }
}