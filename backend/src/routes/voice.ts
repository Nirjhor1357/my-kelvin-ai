import { FastifyInstance } from "fastify";
import { z } from "zod";
import { VoiceService } from "../voice/voiceService.js";

const sttSchema = z.object({
  audioBase64: z.string().min(1),
  mimeType: z.string().default("audio/webm")
});

const ttsSchema = z.object({
  text: z.string().min(1).max(3000)
});

export async function registerVoiceRoutes(app: FastifyInstance, voiceService: VoiceService): Promise<void> {
  app.post("/api/voice/stt", async (request, reply) => {
    const parsed = sttSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const transcript = await voiceService.transcribeBase64Audio(parsed.data.audioBase64, parsed.data.mimeType);
    return { transcript };
  });

  app.post("/api/voice/tts", async (request, reply) => {
    const parsed = ttsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const audioBase64 = await voiceService.synthesizeSpeechToBase64(parsed.data.text);
    return { audioBase64 };
  });
}
