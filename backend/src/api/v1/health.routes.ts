import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { checkRedisHealth } from "../../shared/redis.js";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (_request, reply) => {
    const started = Date.now();

    const db = await (async () => {
      try {
        await prisma.$queryRawUnsafe("SELECT 1");
        return { ok: true as const };
      } catch (error) {
        return { ok: false as const, message: error instanceof Error ? error.message : "Unknown DB error" };
      }
    })();

    const redis = await checkRedisHealth();
    const ok = db.ok && redis.ok;

    if (!ok) {
      reply.code(503);
    }

    return {
      ok,
      service: "jarvis-backend",
      version: "v1",
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - started,
      dependencies: {
        db,
        redis
      }
    };
  });
}
