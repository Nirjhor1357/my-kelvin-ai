import { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health.routes.js";
import { registerV1AuthRoutes } from "./auth.routes.js";
import { registerV1UserRoutes } from "./user.routes.js";
import { registerV1ChatRoutes } from "./chat.routes.js";
import { registerV1AiRoutes } from "./ai.routes.js";

export async function registerApiV1(app: FastifyInstance): Promise<void> {
  await app.register(async (instance) => {
    await registerHealthRoutes(instance);
    await registerV1AuthRoutes(instance);
    await registerV1UserRoutes(instance);
    await registerV1ChatRoutes(instance);
    await registerV1AiRoutes(instance);
  }, { prefix: "/api/v1" });
}
