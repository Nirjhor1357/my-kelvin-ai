import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AIService } from "./ai.service.js";
import { resolveUserId } from "../../shared/requestIdentity.js";
import { MemoryScope } from "./ai.model.js";
import { enqueueGoalJob, getGoalJobStatus } from "./ai.queue.js";

const saveMemorySchema = z.object({
  userId: z.string().min(1).optional(),
  scope: z.enum(["SESSION", "USER", "PROJECT", "GLOBAL"]),
  content: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const searchMemorySchema = z.object({
  userId: z.string().min(1).optional(),
  query: z.string().min(1),
  topK: z.coerce.number().int().min(1).max(10).default(5)
});

const runGoalSchema = z.object({
  userId: z.string().min(1).optional(),
  chatId: z.string().min(1),
  goal: z.string().min(1),
  limits: z
    .object({
      maxSteps: z.number().int().min(1).max(20).optional(),
      maxRetriesPerStep: z.number().int().min(0).max(5).optional(),
      timeoutMs: z.number().int().min(5000).max(300000).optional()
    })
    .optional()
});

export class AIController {
  constructor(private readonly aiService: AIService) {}

  runGoal = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const parsed = runGoalSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send({ error: parsed.error.flatten() });
      return;
    }

    const userId = parsed.data.userId ?? resolveUserId(request);
    if (!userId) {
      reply.status(401).send({ error: "Unauthorized" });
      return;
    }

    reply.send({ run: await this.aiService.runGoal({ ...parsed.data, userId }) });
  };

  queueGoal = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const parsed = runGoalSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send({ error: parsed.error.flatten() });
      return;
    }

    const userId = parsed.data.userId ?? resolveUserId(request);
    if (!userId) {
      reply.status(401).send({ error: "Unauthorized" });
      return;
    }

    try {
      const jobId = await enqueueGoalJob({ ...parsed.data, userId });
      reply.status(202).send({ jobId, status: "queued" });
    } catch (error) {
      reply.status(503).send({ error: error instanceof Error ? error.message : "Queue unavailable" });
    }
  };

  getQueuedGoal = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const params = z.object({ jobId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      reply.status(400).send({ error: params.error.flatten() });
      return;
    }

    try {
      const job = await getGoalJobStatus(params.data.jobId);
      reply.send({ job });
    } catch {
      reply.status(404).send({ error: "Job not found" });
    }
  };

  saveMemory = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const parsed = saveMemorySchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send({ error: parsed.error.flatten() });
      return;
    }

    const userId = parsed.data.userId ?? resolveUserId(request);
    if (!userId) {
      reply.status(401).send({ error: "Unauthorized" });
      return;
    }

    reply.send({ id: await this.aiService.saveMemory({ ...parsed.data, userId }) });
  };

  searchMemory = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const parsed = searchMemorySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.status(400).send({ error: parsed.error.flatten() });
      return;
    }

    const userId = parsed.data.userId ?? resolveUserId(request);
    if (!userId) {
      reply.status(401).send({ error: "Unauthorized" });
      return;
    }

    reply.send({ results: await this.aiService.searchMemory({ ...parsed.data, userId }) });
  };

  getTask = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const params = z.object({ taskId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      reply.status(400).send({ error: params.error.flatten() });
      return;
    }

    const task = await this.aiService.getTask(params.data.taskId);
    if (!task) {
      reply.status(404).send({ error: "Task not found" });
      return;
    }

    reply.send({ task });
  };
}
