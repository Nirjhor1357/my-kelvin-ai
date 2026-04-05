import Fastify from "fastify";
import crypto from "node:crypto";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { env } from "./shared/env.js";
import { initializeMonitoring, Sentry } from "./shared/monitoring.js";
import { logger } from "./shared/logger.js";
import { initializeRealtime } from "./shared/realtime.js";
import { registerApiV1 } from "./api/v1/index.js";
import { getRedis, isRedisEnabled } from "./shared/redis.js";
import { resolveUserId } from "./shared/requestIdentity.js";

initializeMonitoring(process.env.SENTRY_DSN);

export async function createApp() {
  const app = Fastify({
    genReqId: () => crypto.randomUUID(),
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: { translateTime: "SYS:standard", ignore: "pid,hostname" }
            }
          : undefined
    },
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "requestId",
    bodyLimit: 2 * 1024 * 1024
  });

  app.addHook("onResponse", async (request, reply) => {
    request.log.info({
      requestId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs: reply.elapsedTime
    }, "request.completed");
  });

  app.addHook("onSend", async (request, reply, payload) => {
    const payloadSize = typeof payload === "string"
      ? Buffer.byteLength(payload, "utf8")
      : Buffer.isBuffer(payload)
        ? payload.byteLength
        : 0;
    if (payloadSize > env.MAX_RESPONSE_BYTES) {
      request.log.warn({ requestId: request.id, payloadSize }, "response_too_large");
      reply.code(413);
      return JSON.stringify({ error: "Response payload too large" });
    }

    return payload;
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie);
  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    redis: isRedisEnabled() ? getRedis() : undefined,
    keyGenerator: (request) => resolveUserId(request) ?? request.ip
  });
  await app.register(multipart);

  await registerApiV1(app);

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "Unhandled error");
    logger.error("Unhandled error", { error: error instanceof Error ? error.message : String(error) });
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error);
    }

    reply.status(500).send({
      error: "Internal server error",
      message: env.NODE_ENV === "production" ? "Unexpected failure" : error instanceof Error ? error.message : "Unexpected failure"
    });
  });

  initializeRealtime(app.server);
  return app;
}
