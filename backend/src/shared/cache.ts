import crypto from "node:crypto";
import { getRedis } from "./redis.js";

function cacheKey(namespace: string, value: string): string {
  return `${namespace}:${crypto.createHash("sha1").update(value).digest("hex")}`;
}

export class CacheService {
  async getJson<T>(namespace: string, value: string): Promise<T | null> {
    const raw = await getRedis().get(cacheKey(namespace, value));
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setJson(namespace: string, value: string, payload: unknown, ttlSeconds = 300): Promise<void> {
    await getRedis().set(cacheKey(namespace, value), JSON.stringify(payload), "EX", ttlSeconds);
  }
}

export const cacheService = new CacheService();
