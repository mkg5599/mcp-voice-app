"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useIsClient } from "./useIsClient";

const MAX_SECONDS = 30;
const PREFERRED_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export type RecorderState = "idle" | "recording" | "transcribing";

/** Records from the microphone and returns a transcript via /api/transcribe. */
export function useRecorder(onTranscript: (text: string) => void, onError: (message: string) => void) {
  const [state, setState] = useState<RecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cbRef = useRef({ onTranscript, onError });
  useEffect(() => {
    cbRef.current = { onTranscript, onError };
  });

  const isClient = useIsClient();
  const supported = isClient && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (state !== "idle") return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      cbRef.current.onError("Microphone access was blocked. Allow it in your browser to use voice.");
      return;
    }

    const mimeType = PREFERRED_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    recorder.onstop = async () => {
      clearTimer();
      stream.getTracks().forEach((t) => t.stop());
      recorderRef.current = null;
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      if (blob.size < 1000) {
        setState("idle");
        return;
      }
      setState("transcribing");
      try {
        const form = new FormData();
        form.append("file", blob, `speech.${blob.type.includes("mp4") ? "m4a" : "webm"}`);
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message ?? "Transcription failed");
        if (data.text) cbRef.current.onTranscript(data.text);
        else cbRef.current.onError("I didn't catch that. Try again a little closer to the mic.");
      } catch (err) {
        cbRef.current.onError(err instanceof Error ? err.message : "Transcription failed");
      } finally {
        setState("idle");
      }
    };

    recorderRef.current = recorder;
    recorder.start();
    setSeconds(0);
    setState("recording");
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += 1;
      setSeconds(elapsed);
      if (elapsed >= MAX_SECONDS && recorder.state === "recording") recorder.stop();
    }, 1000);
  }, [state]);

  useEffect(
    () => () => {
      clearTimer();
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  return { state, seconds, supported, start, stop };
}
