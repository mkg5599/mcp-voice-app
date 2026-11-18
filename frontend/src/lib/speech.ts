"use client";

/** Read a reply aloud with the browser's built-in speech synthesis (free, no API). */
export function speak(markdown: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const text = markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[*_`#>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-+]\s+/gm, "")
    .trim();
  if (!text) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

export const speechSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;
