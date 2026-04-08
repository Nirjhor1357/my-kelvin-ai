import { JarvisApiClient } from "./api/client";

async function speakWithBrowserTts(text: string): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    throw new Error("Browser TTS is unavailable");
  }

  await new Promise<void>((resolve, reject) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error("Browser TTS playback failed"));
    window.speechSynthesis.speak(utterance);
  });
}

export async function playAssistantAudio(client: JarvisApiClient, text: string): Promise<void> {
  const cleaned = text.replace(/[#*_`>-]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return;
  }

  try {
    const blob = await client.textToSpeech(cleaned);
    const audioUrl = URL.createObjectURL(blob);

    await new Promise<void>((resolve, reject) => {
      const audio = new Audio(audioUrl);
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        reject(new Error("Audio playback failed"));
      };

      void audio.play().catch((error) => {
        URL.revokeObjectURL(audioUrl);
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
