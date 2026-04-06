import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { FeatureFlagsService } from "./featureFlags.service.js";

const listSchema = z.object({
  userId: z.string().min(1).optional()
});

const setSchema = z.object({
  enabled: z.boolean(),
  userId: z.string().min(1).optional()
});

const keySchema = z.object({
  key: z.string().min(1)
});

export class FeatureFlagsController {
  constructor(private readonly service: FeatureFlagsService) {}

  list = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const parsed = listSchema.safeParse(request.query);
    if (!parsed.success) {
      reply.status(400).send({ error: parsed.error.flatten() });
      return;
    }

    reply.send({ flags: await this.service.list(parsed.data.userId) });
  };

  set = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const params = keySchema.safeParse(request.params);
    if (!params.success) {
      reply.status(400).send({ error: params.error.flatten() });
      return;
    }

    const body = setSchema.safeParse(request.body);
    if (!body.success) {
      reply.status(400).send({ error: body.error.flatten() });
      return;
    }

    await this.service.set({ key: params.data.key, enabled: body.data.enabled, userId: body.data.userId });
    reply.send({ ok: true });
  };
}
