import { config } from "../../../lib/config";
import { describeError } from "../../../lib/errors";
import { gemini } from "../../../lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024;

const PROMPT =
  "Transcribe the speech in this audio exactly as spoken, in the speaker's language. " +
  "Return only the transcript, with no quotes, labels or commentary. " +
  "If there is no intelligible speech, return an empty response.";

/** Speech-to-text with Gemini's native audio understanding (replaces Whisper). */
export async function POST(req: Request) {
  const t0 = Date.now();
  if (!config.geminiApiKey) {
    return Response.json({ code: "config_error", message: "Server is missing GEMINI_API_KEY" }, { status: 500 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ code: "no_audio", message: "No audio received" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ code: "too_large", message: "Recording is too long" }, { status: 413 });
  }
  const mimeType = (file.type || "audio/webm").split(";")[0];
  if (!mimeType.startsWith("audio/") && mimeType !== "video/webm") {
    return Response.json({ code: "unsupported_type", message: `Unsupported audio type ${mimeType}` }, { status: 415 });
  }

  try {
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const result = await gemini().models.generateContent({
      model: config.transcribeModel,
      contents: [{ role: "user", parts: [{ inlineData: { mimeType, data } }, { text: PROMPT }] }],
      config: { temperature: 0 },
    });
    const text = (result.text ?? "").trim();
    console.log(JSON.stringify({ evt: "transcribe", bytes: file.size, chars: text.length, latency_ms: Date.now() - t0 }));
    return Response.json({ text, model: config.transcribeModel, latency_ms: Date.now() - t0 });
  } catch (err) {
    const { code, message, status } = describeError(err);
    console.error(JSON.stringify({ evt: "transcribe_error", code, detail: String(err).slice(0, 500) }));
    return Response.json({ code, message }, { status });
  }
}
