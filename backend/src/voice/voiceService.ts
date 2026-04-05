import OpenAI from "openai";
import { env } from "../config/env.js";

const client = env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
  : null;

export class VoiceService {
  async transcribeBase64Audio(base64Audio: string, mimeType = "audio/webm"): Promise<string> {
    if (!client) {
      return "OPENAI_API_KEY missing. Voice transcription unavailable in degraded mode.";
    }

    const buffer = Buffer.from(base64Audio, "base64");
    const file = await OpenAI.toFile(buffer, `input.${mimeType.includes("wav") ? "wav" : "webm"}`);

    const result = await client.audio.transcriptions.create({
      file,
      model: "gpt-4o-mini-transcribe"
    });

    return result.text;
  }

  async synthesizeSpeechToBase64(text: string): Promise<string> {
    if (!client) {
      return "";
    }

    const speech = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: text.slice(0, 3000)
    });

    const buffer = Buffer.from(await speech.arrayBuffer());
    return buffer.toString("base64");
  }
}
