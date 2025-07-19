export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn("[/api/transcribe] OPENAI_API_KEY missing at module load.");
}

const MAX_FILE_MB = 5;
const MAX_BYTES = MAX_FILE_MB * 1024 * 1024;
const ALLOWED_MIME_PREFIX = "audio/";

export async function POST(req: Request) {
  const t0 = Date.now();

  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error: "config_error",
        detail: "OPENAI_API_KEY not configured on server",
      },
      { status: 500 },
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return errorJSON("No file uploaded", 400, t0);
    }

    if (file.size > MAX_BYTES) {
      return errorJSON(
        `File exceeds ${MAX_FILE_MB}MB (${(file.size / 1_048_576).toFixed(
          2,
        )}MB)`,
        400,
        t0,
      );
    }

    if (!file.type.startsWith(ALLOWED_MIME_PREFIX)) {
      return errorJSON("Invalid file type (expect audio/*)", 400, t0);
    }

    // Convert Blob → File for SDK
    const audioFile = new File([file], file instanceof File ? file.name : "audio.webm", {
      type: file.type,
    });

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const transcript = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: audioFile,
      response_format: "text",
    });

    type TranscriptResponse = string | { text: string };

    const typedTranscript = transcript as TranscriptResponse;

    const text =
      typeof typedTranscript === "string"
        ? typedTranscript
        : typedTranscript.text ?? typedTranscript;

    log({
      evt: "transcribe_complete",
      size_bytes: file.size,
      latency_ms: Date.now() - t0,
    });

    return NextResponse.json({ text });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log({
      evt: "transcribe_error",
      error: msg,
      latency_ms: Date.now() - t0,
    });
    return NextResponse.json(
      { error: "transcription_failed", detail: msg },
      { status: 500 },
    );
  }
}

function errorJSON(message: string, status: number, t0: number) {
  log({
    evt: "transcribe_error",
    error: message,
    latency_ms: Date.now() - t0,
  });
  return NextResponse.json({ error: message }, { status });
}

function log(obj: Record<string, unknown>) {
  console.log(JSON.stringify(obj));
}