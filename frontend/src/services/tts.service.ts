import { JarvisApiClient } from "./api/client";

let currentAudio: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let activeResolve: (() => void) | null = null;

export function stopAudio(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }

  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  activeUtterance = null;

  if (activeResolve) {
    const resolve = activeResolve;
    activeResolve = null;
    resolve();
  }
}

export const stopAssistantAudio = stopAudio;

async function speakWithBrowserTts(text: string): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    throw new Error("Browser TTS is unavailable");
  }

  await new Promise<void>((resolve, reject) => {
    activeResolve = resolve;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    activeUtterance = utterance;
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => {
      activeResolve = null;
      activeUtterance = null;
      resolve();
    };
    utterance.onerror = () => {
      activeResolve = null;
      activeUtterance = null;
      reject(new Error("Browser TTS playback failed"));
    };
    window.speechSynthesis.speak(utterance);
  });
}

export async function playAssistantAudio(client: JarvisApiClient, text: string): Promise<void> {
  void client;
  const cleaned = text.replace(/[#*_`>-]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return;
  }

  stopAudio();
  await speakWithBrowserTts(cleaned);
}
