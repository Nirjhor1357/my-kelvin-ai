import { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({
    ok: true,
    service: "jarvis-backend",
    version: "v1",
    timestamp: new Date().toISOString()
  }));
}
