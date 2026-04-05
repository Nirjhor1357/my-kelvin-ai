import { FastifyInstance } from "fastify";
import { registerAuthRoutes } from "../../modules/auth/auth.routes.js";

export async function registerV1AuthRoutes(app: FastifyInstance): Promise<void> {
  await app.register(async (instance) => {
    await registerAuthRoutes(instance);
  }, { prefix: "/auth" });
}
