import { FastifyInstance } from "fastify";
import { ChatController } from "./chat.controller.js";
import { ChatService } from "./chat.service.js";

export async function registerChatRoutes(app: FastifyInstance): Promise<void> {
  const controller = new ChatController(new ChatService());

  app.get("/", controller.listChats);
  app.post("/message", {
    schema: {
      body: {
        type: "object",
        required: ["message"],
        additionalProperties: false,
        properties: {
          userId: { type: "string", minLength: 1 },
          chatId: { type: "string" },
          message: { type: "string", minLength: 1, maxLength: 2000 },
          memoryTopK: { type: "number", minimum: 1, maximum: 10 }
        }
      }
    }
  }, controller.sendMessage);
  app.post("/message/stream", {
    schema: {
      body: {
        type: "object",
        required: ["message"],
        additionalProperties: false,
        properties: {
          userId: { type: "string", minLength: 1 },
          chatId: { type: "string" },
          message: { type: "string", minLength: 1, maxLength: 2000 },
          memoryTopK: { type: "number", minimum: 1, maximum: 10 }
        }
      }
    }
  }, controller.sendMessageStream);
  app.get("/:chatId/messages", controller.getMessages);
}
