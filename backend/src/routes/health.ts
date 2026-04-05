import { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async () => ({
    ok: true,
    service: "jarvis-backend",
    timestamp: new Date().toISOString()
  }));
}
