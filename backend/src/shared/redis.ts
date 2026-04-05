import IORedis from "ioredis";
import { env } from "./env.js";

const globalForRedis = globalThis as unknown as {
  redis?: any;
};

export function getRedis(): any {
  if (!isRedisEnabled()) {
    return null;
  }

  if (!globalForRedis.redis) {
    globalForRedis.redis = new (IORedis as any)(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true
    });

    globalForRedis.redis.on("error", (error: unknown) => {
      // Do not crash process on transient Redis errors.
      console.error("[redis] connection error", error);
    });
  }

  return globalForRedis.redis;
}

export function isRedisEnabled(): boolean {
  return env.REDIS_URL.trim().length > 0;
}

export async function checkRedisHealth(timeoutMs = 1500): Promise<{ ok: boolean; latencyMs: number | null; message?: string }> {
  if (!isRedisEnabled()) {
    return { ok: true, latencyMs: null, message: "disabled" };
  }

  const client = getRedis();
  if (!client) {
    return { ok: false, latencyMs: null, message: "client unavailable" };
  }

  const started = Date.now();
  try {
    await Promise.race([
      client.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Redis health timeout")), timeoutMs))
    ]);

    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : "Unknown Redis error" };
  }
}

export async function closeRedis(): Promise<void> {
  if (globalForRedis.redis) {
    await globalForRedis.redis.quit().catch(() => undefined);
    globalForRedis.redis = undefined;
  }
}
