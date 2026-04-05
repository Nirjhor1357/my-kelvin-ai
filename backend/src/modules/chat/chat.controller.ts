import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { ChatService } from "./chat.service.js";
import { resolveUserId } from "../../shared/requestIdentity.js";

const sendMessageSchema = z.object({
  userId: z.string().min(1).optional(),
  chatId: z.string().optional(),
  message: z.string().min(1),
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

    reply.send(await this.chatService.sendMessage({ ...parsed.data, userId }));
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
