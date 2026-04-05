import { FastifyInstance } from "fastify";
import { registerAiRoutes } from "../../modules/ai/ai.routes.js";

export async function registerV1AiRoutes(app: FastifyInstance): Promise<void> {
  await app.register(async (instance) => {
    await registerAiRoutes(instance);
  }, { prefix: "/ai" });
}
