import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AuthService } from "./auth.service.js";
import { resolveUserId } from "../../shared/requestIdentity.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send({ error: parsed.error.flatten() });
      return;
    }

    const result = await this.authService.register(parsed.data);
    reply.send(result);
  };

  login = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send({ error: parsed.error.flatten() });
      return;
    }

    const result = await this.authService.login(parsed.data);
    reply.send(result);
  };

  refresh = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send({ error: parsed.error.flatten() });
      return;
    }

    const result = await this.authService.refresh(parsed.data.refreshToken);
    reply.send(result);
  };

  me = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const userId = resolveUserId(request) ?? "";
    if (!userId) {
      reply.status(401).send({ error: "Unauthorized" });
      return;
    }

    const user = await this.authService.me(userId);
    if (!user) {
      reply.status(404).send({ error: "User not found" });
      return;
    }

    reply.send({ user });
  };
}
