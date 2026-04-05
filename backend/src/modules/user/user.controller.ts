import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { UserService } from "./user.service.js";
import { resolveUserId } from "../../shared/requestIdentity.js";

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["USER", "ADMIN"]).optional()
});

export class UserController {
  constructor(private readonly userService: UserService) {}

  list = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    reply.send({ users: await this.userService.list() });
  };

  profile = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const userId = resolveUserId(request) ?? "";
    if (!userId) {
      reply.status(401).send({ error: "Unauthorized" });
      return;
    }

    const user = await this.userService.getById(userId);
    if (!user) {
      reply.status(404).send({ error: "User not found" });
      return;
    }

    reply.send({ user });
  };

  update = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const userId = resolveUserId(request) ?? "";
    if (!userId) {
      reply.status(401).send({ error: "Unauthorized" });
      return;
    }

    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send({ error: parsed.error.flatten() });
      return;
    }

    reply.send({ user: await this.userService.updateProfile(userId, parsed.data) });
  };
}
