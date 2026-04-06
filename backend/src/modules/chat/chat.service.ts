import { prisma } from "../../lib/prisma.js";
import { AIService } from "../ai/ai.service.js";
import { ChatSummary } from "./chat.model.js";
import { AgentService } from "../agents/agent.service.js";

export class ChatService {
  constructor(
    private readonly aiService = new AIService(),
    private readonly agentService = new AgentService()
  ) {}

  private isAgentPrompt(message: string): boolean {
    const normalized = message.toLowerCase();
    return /\b(plan|create|do|research|execute|build|organize|automate)\b/.test(normalized);
  }

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

  async sendMessage(input: { userId: string; chatId?: string; message: string; memoryTopK?: number; useThinking?: boolean; useTools?: boolean }): Promise<{ chat: ChatSummary; answer: string; retrievedMemories: Array<{ id: string; content: string; score: number }> }> {
    const chat = await this.ensureChat(input.userId, input.chatId, input.message.slice(0, 48));

    if (this.isAgentPrompt(input.message)) {
      const mode = input.useTools ? "agent-tools" : input.useThinking ? "agent-thinking" : "agent";

      await prisma.message.create({
        data: {
          chatId: chat.id,
          role: "user",
          content: input.message,
          metadata: JSON.stringify({ mode })
        }
      });

      let run: any;

      if (input.useTools) {
        run = await this.agentService.runAgentWithTools(input.message, input.userId, chat.id);
      } else if (input.useThinking) {
        run = await this.agentService.runAgentWithThinking(input.message, input.userId, chat.id);
      } else {
        run = await this.agentService.runAgent(input.message, input.userId, chat.id);
      }

      await prisma.message.create({
        data: {
          chatId: chat.id,
          role: "assistant",
          content: run.result,
          metadata: JSON.stringify({
            mode,
            steps: "steps" in run ? run.steps : undefined,
            errors: run.errors,
            iterations: "iterationCount" in run ? run.iterationCount : undefined,
            evaluations: "evaluations" in run ? run.evaluations : undefined,
            toolExecutions: "toolExecutions" in run ? run.toolExecutions : undefined
          })
        }
      });

      return {
        chat,
        answer: run.result,
        retrievedMemories: []
      };
    }

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

  async streamMessage(input: { userId: string; chatId?: string; message: string; memoryTopK?: number }): Promise<{ chat: ChatSummary; stream: AsyncGenerator<string> }> {
    const chat = await this.ensureChat(input.userId, input.chatId, input.message.slice(0, 48));
    const stream = this.aiService.createChatReplyStream({
      userId: input.userId,
      chatId: chat.id,
      message: input.message,
      memoryTopK: input.memoryTopK
    });

    return { chat, stream };
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
