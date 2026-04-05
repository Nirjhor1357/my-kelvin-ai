import { FastifyReply, FastifyRequest } from "fastify";
import { verifyAccessToken } from "./jwt.js";

export interface AuthContext {
  userId: string;
  role: "USER" | "ADMIN";
  email: string;
}

function resolveBearerToken(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice(7);
}

export function getAuthContext(request: FastifyRequest): AuthContext | null {
  const token = resolveBearerToken(request);
  if (!token) {
    return null;
  }

  try {
    const payload = verifyAccessToken(token);
    return {
      userId: payload.sub,
      role: payload.role as AuthContext["role"],
      email: payload.email
    };
  } catch {
    return null;
  }
}

export function requireAuth() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const auth = getAuthContext(request);
    if (!auth) {
      reply.status(401).send({ error: "Unauthorized" });
      return;
    }

    (request as FastifyRequest & { auth?: AuthContext }).auth = auth;
  };
}

export function requireRole(role: AuthContext["role"]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const auth = getAuthContext(request);
    if (!auth) {
      reply.status(401).send({ error: "Unauthorized" });
      return;
    }

    if (auth.role !== role) {
      reply.status(403).send({ error: "Forbidden" });
      return;
    }

    (request as FastifyRequest & { auth?: AuthContext }).auth = auth;
  };
}
