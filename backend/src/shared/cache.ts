import crypto from "node:crypto";
import { getRedis, isRedisEnabled } from "./redis.js";

function cacheKey(namespace: string, value: string): string {
  return `${namespace}:${crypto.createHash("sha1").update(value).digest("hex")}`;
}

export class CacheService {
  async getJson<T>(namespace: string, value: string): Promise<T | null> {
    if (!isRedisEnabled()) {
      return null;
    }

    const client = getRedis();
    if (!client) {
      return null;
    }

    try {
      const raw = await client.get(cacheKey(namespace, value));
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async setJson(namespace: string, value: string, payload: unknown, ttlSeconds = 300): Promise<void> {
    if (!isRedisEnabled()) {
      return;
    }

    const client = getRedis();
    if (!client) {
      return;
    }

    await client.set(cacheKey(namespace, value), JSON.stringify(payload), "EX", ttlSeconds).catch(() => undefined);
  }
}

export const cacheService = new CacheService();
