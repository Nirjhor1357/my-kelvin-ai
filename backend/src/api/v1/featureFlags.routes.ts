import { FastifyInstance } from "fastify";
import { registerFeatureFlagsRoutes } from "../../modules/featureFlags/featureFlags.routes.js";

export async function registerV1FeatureFlagsRoutes(app: FastifyInstance): Promise<void> {
  await app.register(async (instance) => {
    await registerFeatureFlagsRoutes(instance);
  }, { prefix: "/flags" });
}
