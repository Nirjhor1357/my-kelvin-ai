import { Server } from "socket.io";
import type { FastifyInstance } from "fastify";
import { env } from "./env.js";

let io: Server | null = null;

export function initializeRealtime(server: FastifyInstance["server"]): Server {
  io = new Server(server, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    socket.emit("system:ready", { ok: true, timestamp: new Date().toISOString() });
  });

  return io;
}

export function emitRealtimeEvent(event: string, payload: unknown): void {
  io?.emit(event, payload);
}
