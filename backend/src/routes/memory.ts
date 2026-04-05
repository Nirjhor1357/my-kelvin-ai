import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppContext } from "../appContext.js";

const saveMemorySchema = z.object({
  sessionId: z.string().min(1),
  scope: z.enum(["user", "project", "global"]),
  content: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const searchMemorySchema = z.object({
  sessionId: z.string().optional(),
  query: z.string().min(1),
  topK: z.coerce.number().int().min(1).max(10).default(5)
});

export async function registerMemoryRoutes(app: FastifyInstance, context: AppContext): Promise<void> {
  app.post("/api/memory", async (request, reply) => {
    const parsed = saveMemorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const id = await context.memory.addLongTermMemory(parsed.data);
    return { id };
  });

  app.get("/api/memory/search", async (request, reply) => {
    const parsed = searchMemorySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const results = await context.memory.searchMemories(parsed.data.query, {
      sessionId: parsed.data.sessionId,
      topK: parsed.data.topK
    });

    return { results };
  });
}
