import IORedis from "ioredis";
import { env } from "./env.js";

const globalForRedis = globalThis as unknown as {
  redis?: any;
};

export function getRedis(): any {
  if (!globalForRedis.redis) {
    globalForRedis.redis = new (IORedis as any)(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });
  }

  return globalForRedis.redis;
}

export async function closeRedis(): Promise<void> {
  if (globalForRedis.redis) {
    await globalForRedis.redis.quit();
    globalForRedis.redis = undefined;
  }
}
