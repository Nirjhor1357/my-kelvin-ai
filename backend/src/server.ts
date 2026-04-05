import { createApp } from "./app.js";
import { env } from "./shared/env.js";
import { logger } from "./shared/logger.js";
import { prisma } from "./lib/prisma.js";
import { startGoalWorker } from "./modules/ai/ai.queue.js";

async function start(): Promise<void> {
  try {
    await prisma.$connect();
    startGoalWorker();
    const app = await createApp();
    await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(`Jarvis backend listening on ${env.HOST}:${env.PORT}`);
  } catch (error) {
    logger.error("Failed to start backend server", { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

void start();
