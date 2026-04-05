import { FastifyInstance } from "fastify";
import { ChatController } from "./chat.controller.js";
import { ChatService } from "./chat.service.js";

export async function registerChatRoutes(app: FastifyInstance): Promise<void> {
  const controller = new ChatController(new ChatService());

  app.get("/", controller.listChats);
  app.post("/message", controller.sendMessage);
  app.get("/:chatId/messages", controller.getMessages);
}
