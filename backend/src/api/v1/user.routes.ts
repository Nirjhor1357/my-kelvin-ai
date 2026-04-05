import { FastifyInstance } from "fastify";
import { registerUserRoutes } from "../../modules/user/user.routes.js";

export async function registerV1UserRoutes(app: FastifyInstance): Promise<void> {
  await app.register(async (instance) => {
    await registerUserRoutes(instance);
  }, { prefix: "/users" });
}
