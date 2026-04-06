import { FastifyInstance } from "fastify";
import { FeatureFlagsController } from "./featureFlags.controller.js";
import { FeatureFlagsService } from "./featureFlags.service.js";
import { requireAuth } from "../../shared/authz.js";

export async function registerFeatureFlagsRoutes(app: FastifyInstance): Promise<void> {
  const controller = new FeatureFlagsController(new FeatureFlagsService());

  app.get("/", { preHandler: requireAuth() }, controller.list);
  app.patch("/:key", { preHandler: requireAuth() }, controller.set);
}
