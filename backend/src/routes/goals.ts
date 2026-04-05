import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppContext } from "../appContext.js";

const runGoalSchema = z.object({
  sessionId: z.string().min(1),
  goal: z.string().min(1),
  limits: z
    .object({
      maxSteps: z.number().int().min(1).max(20).optional(),
      maxRetriesPerStep: z.number().int().min(0).max(5).optional(),
      timeoutMs: z.number().int().min(5_000).max(300_000).optional(),
      maxInputTokens: z.number().int().min(500).max(30_000).optional(),
      maxOutputTokens: z.number().int().min(500).max(20_000).optional()
    })
    .optional()
});

export async function registerGoalRoutes(app: FastifyInstance, context: AppContext): Promise<void> {
  app.post("/api/goals/run", async (request, reply) => {
    const parsed = runGoalSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const run = await context.orchestrator.runGoal(parsed.data);
    return { run };
  });

  app.get("/api/goals/:taskId", async (request, reply) => {
    const params = z.object({ taskId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: params.error.flatten() });
    }

    const run = context.memory.getTaskRun(params.data.taskId);
    if (!run) {
      return reply.status(404).send({ error: "Task run not found" });
    }

    return { run };
  });
}
