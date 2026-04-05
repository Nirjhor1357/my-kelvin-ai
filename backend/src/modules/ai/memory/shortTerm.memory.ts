import { prisma } from "../../../lib/prisma.js";

export class ShortTermMemory {
  async addMessage(chatId: string, role: string, content: string, metadata?: Record<string, unknown>): Promise<void> {
    await prisma.message.create({
      data: {
        chatId,
        role,
        content,
        metadata: JSON.stringify(metadata ?? {})
      }
    });
  }

  async getRecentMessages(chatId: string, limit = 12): Promise<Array<{ role: string; content: string }>> {
    const messages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "desc" },
      take: limit
    });

    return messages.reverse().map((message: { role: string; content: string }) => ({ role: message.role, content: message.content }));
  }
}
