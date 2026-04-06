import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AgentService } from "../../modules/agents/agent.service.js";
import { resolveUserId } from "../../shared/requestIdentity.js";

const agentSchema = z.object({
  goal: z.string().min(1),
  userId: z.string().min(1).optional(),
  chatId: z.string().min(1).optional()
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
    const result = await service.runAgent(parsed.data.goal, userId, parsed.data.chatId);

    return reply.send({
      success: true,
      result: result.result,
      steps: result.steps,
      errors: result.errors
    });
  });
}
