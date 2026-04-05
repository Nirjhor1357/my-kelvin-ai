import { FastifyInstance } from "fastify";
import { AIController } from "./ai.controller.js";
import { AIService } from "./ai.service.js";
import { requireAuth } from "../../shared/authz.js";

export async function registerAiRoutes(app: FastifyInstance): Promise<void> {
  const controller = new AIController(new AIService());

  app.post("/goals/run", { preHandler: requireAuth() }, controller.runGoal);
  app.post("/goals/queue", { preHandler: requireAuth() }, controller.queueGoal);
  app.get("/goals/jobs/:jobId", { preHandler: requireAuth() }, controller.getQueuedGoal);
  app.get("/tasks/:taskId", { preHandler: requireAuth() }, controller.getTask);
  app.post("/memory", { preHandler: requireAuth() }, controller.saveMemory);
  app.get("/memory/search", { preHandler: requireAuth() }, controller.searchMemory);
}
