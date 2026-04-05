import { FastifyInstance } from "fastify";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const controller = new AuthController(new AuthService());

  app.post("/register", controller.register);
  app.post("/login", controller.login);
  app.post("/refresh", controller.refresh);
  app.get("/me", controller.me);
}
