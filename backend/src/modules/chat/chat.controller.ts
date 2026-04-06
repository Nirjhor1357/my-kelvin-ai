import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { ChatService } from "./chat.service.js";
import { resolveUserId } from "../../shared/requestIdentity.js";
import { sanitizeText } from "../../shared/sanitize.js";
import { env } from "../../shared/env.js";

const sendMessageSchema = z.object({
  userId: z.string().min(1).optional(),
  chatId: z.string().optional(),
  message: z.string().min(1).max(env.MAX_INPUT_CHARS),
  memoryTopK: z.number().int().min(1).max(10).optional()
});

export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  sendMessage = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const parsed = sendMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send({ error: parsed.error.flatten() });
      return;
    }

    const userId = parsed.data.userId ?? resolveUserId(request);
    if (!userId) {
      reply.status(401).send({ error: "Unauthorized" });
      return;
    }

    const sanitizedMessage = sanitizeText(parsed.data.message, env.MAX_INPUT_CHARS);
    if (!sanitizedMessage) {
      reply.status(400).send({ error: "Message cannot be empty" });
      return;
    }

    reply.send(await this.chatService.sendMessage({ ...parsed.data, message: sanitizedMessage, userId }));
  };

  sendMessageStream = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const parsed = sendMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send({ error: parsed.error.flatten() });
      return;
    }

    const userId = parsed.data.userId ?? resolveUserId(request);
    if (!userId) {
      reply.status(401).send({ error: "Unauthorized" });
      return;
    }

    const sanitizedMessage = sanitizeText(parsed.data.message, env.MAX_INPUT_CHARS);
    if (!sanitizedMessage) {
      reply.status(400).send({ error: "Message cannot be empty" });
      return;
    }

    const { chat, stream } = await this.chatService.streamMessage({ ...parsed.data, message: sanitizedMessage, userId });

    const requestOrigin = request.headers.origin;
    const allowOrigin = requestOrigin && env.CORS_ORIGIN.includes(requestOrigin) ? requestOrigin : env.CORS_ORIGIN;

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin"
    });

    reply.raw.write(`event: meta\ndata: ${JSON.stringify({ chatId: chat.id })}\n\n`);

    for await (const token of stream) {
      reply.raw.write(`event: token\ndata: ${JSON.stringify({ token })}\n\n`);
    }

    reply.raw.write("event: done\\ndata: {}\\n\\n");
    reply.raw.end();
  };

  listChats = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const query = z.object({ userId: z.string().min(1).optional() }).safeParse(request.query);
    if (!query.success) {
      reply.status(400).send({ error: query.error.flatten() });
      return;
    }

    const userId = query.data.userId ?? resolveUserId(request);
    if (!userId) {
      reply.status(401).send({ error: "Unauthorized" });
      return;
    }

    reply.send({ chats: await this.chatService.listChats(userId) });
  };

  getMessages = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const params = z.object({ chatId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      reply.status(400).send({ error: params.error.flatten() });
      return;
    }

    reply.send({ messages: await this.chatService.getMessages(params.data.chatId) });
  };
}
