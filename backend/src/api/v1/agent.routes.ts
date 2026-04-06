import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AgentService } from "../../modules/agents/agent.service.js";
import { resolveUserId } from "../../shared/requestIdentity.js";

const agentSchema = z.object({
  goal: z.string().min(1),
  userId: z.string().min(1).optional(),
  chatId: z.string().min(1).optional(),
  mode: z.enum(["default", "thinking", "tools"]).optional()
});

export async function registerV1AgentRoutes(app: FastifyInstance): Promise<void> {
  const service = new AgentService();

  app.post("/agent", async (request, reply) => {
    const parsed = agentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.flatten()
      });
    }

    const userId = parsed.data.userId ?? resolveUserId(request) ?? undefined;
    const mode = parsed.data.mode ?? "default";

    if (mode === "thinking") {
      const result = await service.runAgentWithThinking(parsed.data.goal, userId, parsed.data.chatId);
      return reply.send({
        success: true,
        result: result.result,
        steps: result.steps,
        errors: result.errors,
        iterationCount: result.iterationCount,
        evaluations: result.evaluations
      });
    }

    if (mode === "tools") {
      const result = await service.runAgentWithTools(parsed.data.goal, userId, parsed.data.chatId);
      return reply.send({
        success: result.success,
        result: result.result,
        errors: result.errors,
        toolExecutions: result.toolExecutions,
        iterationCount: result.iterationCount
      });
    }

    const result = await service.runAgent(parsed.data.goal, userId, parsed.data.chatId);
    return reply.send({
      success: true,
      result: result.result,
      steps: result.steps,
      errors: result.errors
    });
  });

  // Dedicated thinking agent endpoint
  app.post("/agent/think", async (request, reply) => {
    const parsed = agentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.flatten()
      });
    }

    const userId = parsed.data.userId ?? resolveUserId(request) ?? undefined;
    const result = await service.runAgentWithThinking(parsed.data.goal, userId, parsed.data.chatId);

    return reply.send({
      success: true,
      result: result.result,
      steps: result.steps,
      errors: result.errors,
      iterationCount: result.iterationCount,
      evaluations: result.evaluations,
      metadata: {
        thinking: true,
        iterations: result.iterationCount,
        finalSuccess: result.success,
        allStepsCount: result.steps.length
      }
    });
  });

  // Dedicated tools agent endpoint
  app.post("/agent/execute", async (request, reply) => {
    const parsed = agentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.flatten()
      });
    }

    const userId = parsed.data.userId ?? resolveUserId(request) ?? undefined;
    const result = await service.runAgentWithTools(parsed.data.goal, userId, parsed.data.chatId);

    return reply.send({
      success: result.success,
      result: result.result,
      toolExecutions: result.toolExecutions,
      errors: result.errors,
      iterationCount: result.iterationCount,
      metadata: {
        toolExecutor: true,
        iterations: result.iterationCount,
        toolsUsed: result.toolExecutions
          .filter((t) => !t.isFinal && t.toolName)
          .map((t) => t.toolName),
        finalSuccess: result.success
      }
    });
  });
}

