import { FastifyInstance } from "fastify";
import { UserController } from "./user.controller.js";
import { UserService } from "./user.service.js";
import { requireAuth, requireRole } from "../../shared/authz.js";

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  const controller = new UserController(new UserService());

  app.get("/", { preHandler: requireRole("ADMIN") }, controller.list);
  app.get("/profile", { preHandler: requireAuth() }, controller.profile);
  app.patch("/profile", { preHandler: requireAuth() }, controller.update);
}
