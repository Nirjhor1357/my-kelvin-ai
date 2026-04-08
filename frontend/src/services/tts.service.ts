import { JarvisApiClient } from "./api/client";

export async function playAssistantAudio(client: JarvisApiClient, text: string): Promise<void> {
  const cleaned = text.replace(/[#*_`>-]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return;
  }

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
}
