import { prisma } from "../../lib/prisma.js";
import { AIService } from "../ai/ai.service.js";
import { ChatSummary } from "./chat.model.js";

export class ChatService {
  constructor(private readonly aiService = new AIService()) {}

  async ensureChat(userId: string, chatId?: string, title?: string): Promise<ChatSummary> {
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@jarvis.local`,
        name: "Guest",
        passwordHash: "guest-session"
      }
    });

    if (chatId) {
      const existing = await prisma.chat.findUnique({ where: { id: chatId } });
      if (existing) {
        return {
          id: existing.id,
          userId: existing.userId,
          title: existing.title,
          summary: existing.summary,
          status: existing.status
        };
      }
    }

    const created = await prisma.chat.create({
      data: {
        userId,
        title: title ?? "New conversation"
      }
    });

    return {
      id: created.id,
      userId: created.userId,
      title: created.title,
      summary: created.summary,
      status: created.status
    };
  }

  async sendMessage(input: { userId: string; chatId?: string; message: string; memoryTopK?: number }): Promise<{ chat: ChatSummary; answer: string; retrievedMemories: Array<{ id: string; content: string; score: number }> }> {
    const chat = await this.ensureChat(input.userId, input.chatId, input.message.slice(0, 48));
    const response = await this.aiService.createChatReply({
      userId: input.userId,
      chatId: chat.id,
      message: input.message,
      memoryTopK: input.memoryTopK
    });

    return {
      chat,
      answer: response.answer,
      retrievedMemories: response.retrievedMemories
    };
  }

  async listChats(userId: string): Promise<ChatSummary[]> {
    const chats = await prisma.chat.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
    return chats.map((chat: { id: string; userId: string; title: string | null; summary: string | null; status: string }) => ({
      id: chat.id,
      userId: chat.userId,
      title: chat.title,
      summary: chat.summary,
      status: chat.status
    }));
  }

  async getMessages(chatId: string) {
    return prisma.message.findMany({ where: { chatId }, orderBy: { createdAt: "asc" } });
  }
}
