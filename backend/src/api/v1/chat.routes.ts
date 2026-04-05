import { FastifyInstance } from "fastify";
import { registerChatRoutes } from "../../modules/chat/chat.routes.js";

export async function registerV1ChatRoutes(app: FastifyInstance): Promise<void> {
  await app.register(async (instance) => {
    await registerChatRoutes(instance);
  }, { prefix: "/chat" });
}
