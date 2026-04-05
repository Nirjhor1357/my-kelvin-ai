import { createApp } from "./app.js";
import { env } from "./shared/env.js";
import { logger } from "./shared/logger.js";
import { prisma } from "./lib/prisma.js";
import { startGoalWorker } from "./modules/ai/ai.queue.js";

async function start(): Promise<void> {
  try {
    console.log("[startup] Loaded environment variables");
    console.log(`[startup] NODE_ENV=${env.NODE_ENV}, PORT=${env.PORT}, LOG_LEVEL=${env.LOG_LEVEL}`);
    
    console.log("[startup] Connecting to database...");
    await prisma.$connect();
    console.log("[startup] Database connected successfully");
    
    console.log("[startup] Starting goal worker...");
    startGoalWorker();
    console.log("[startup] Goal worker started");
    
    console.log("[startup] Creating Fastify app...");
    const app = await createApp();
    console.log("[startup] Fastify app created");
    
    console.log(`[startup] Listening on ${env.HOST}:${env.PORT}...`);
    await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(`Jarvis backend listening on ${env.HOST}:${env.PORT}`);
  } catch (error) {
    console.error("[startup] FATAL ERROR:", error);
    if (error instanceof Error) {
      console.error("[startup] Error message:", error.message);
      console.error("[startup] Error stack:", error.stack);
    }
    process.exit(1);
  }
}

void start();
