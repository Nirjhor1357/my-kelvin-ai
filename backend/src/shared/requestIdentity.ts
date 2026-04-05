import { FastifyRequest } from "fastify";
import { verifyAccessToken } from "./jwt.js";

export function resolveUserId(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith("Bearer ")) {
    try {
      const payload = verifyAccessToken(authorization.slice(7));
      return payload.sub;
    } catch {
      // Fall through to alternate identity hints.
    }
  }

  const headerUserId = request.headers["x-user-id"];
  if (typeof headerUserId === "string" && headerUserId.trim()) {
    return headerUserId.trim();
  }

  const body = request.body as { userId?: string } | undefined;
  if (body?.userId) {
    return body.userId;
  }

  const query = request.query as { userId?: string } | undefined;
  if (query?.userId) {
    return query.userId;
  }

  return null;
}
