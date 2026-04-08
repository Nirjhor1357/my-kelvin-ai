import { JarvisApiClient } from "./api/client";

let activeAudio: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let activeResolve: (() => void) | null = null;

export function stopAssistantAudio(): void {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }

  if (activeAudioUrl) {
    URL.revokeObjectURL(activeAudioUrl);
    activeAudioUrl = null;
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
  const cleaned = text.replace(/[#*_`>-]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return;
  }

  try {
    stopAssistantAudio();
    const blob = await client.textToSpeech(cleaned);
    const audioUrl = URL.createObjectURL(blob);
    activeAudioUrl = audioUrl;

    await new Promise<void>((resolve, reject) => {
      const audio = new Audio(audioUrl);
      activeAudio = audio;
      activeResolve = resolve;
      audio.onended = () => {
        if (activeAudioUrl) {
          URL.revokeObjectURL(activeAudioUrl);
          activeAudioUrl = null;
        }
        activeAudio = null;
        activeResolve = null;
        resolve();
      };
      audio.onerror = () => {
        if (activeAudioUrl) {
          URL.revokeObjectURL(activeAudioUrl);
          activeAudioUrl = null;
        }
        activeAudio = null;
        activeResolve = null;
        reject(new Error("Audio playback failed"));
      };

      void audio.play().catch((error) => {
        if (activeAudioUrl) {
          URL.revokeObjectURL(activeAudioUrl);
          activeAudioUrl = null;
        }
        activeAudio = null;
        activeResolve = null;
        reject(error instanceof Error ? error : new Error("Audio playback failed"));
      });
    });
  } catch (error) {
    try {
      await speakWithBrowserTts(cleaned);
    } catch {
      throw error instanceof Error ? error : new Error("Voice playback failed");
    }
  }
}
