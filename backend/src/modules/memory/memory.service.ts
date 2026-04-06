import { completeJson, completeText } from "../../llm/llmClient.js";
import { createEmbedding } from "../../llm/llmClient.js";
import { prisma } from "../../lib/prisma.js";

export type PersistentMemoryType = "preference" | "goal" | "fact";

const MAX_MEMORIES_PER_USER = 200;
const MAX_RELEVANT_MEMORIES = 8;

function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  if (!leftMagnitude || !rightMagnitude) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export class MemoryService {
  async saveMemory(userId: string, type: PersistentMemoryType, content: string): Promise<string | null> {
    const normalizedContent = content.trim();
    if (!userId || !normalizedContent || normalizedContent.length < 8) {
      return null;
    }

    const dedupe = await prisma.memory.findFirst({
      where: {
        userId,
        type,
        content: normalizedContent,
        scope: "USER"
      }
    });

    if (dedupe) {
      return dedupe.id;
    }

    const embedding = await createEmbedding(normalizedContent);
    const record = await prisma.memory.create({
      data: {
        userId,
        type,
        scope: "USER",
        content: normalizedContent,
        embedding: JSON.stringify(embedding),
        metadata: JSON.stringify({ source: "persistent-memory", memoryType: type })
      }
    });

    await this.enforceUserMemoryLimit(userId, MAX_MEMORIES_PER_USER);
    return record.id;
  }

  async getMemories(userId: string): Promise<Array<{ id: string; type: string; content: string; createdAt: Date }>> {
    return prisma.memory.findMany({
      where: { userId, scope: "USER" },
      orderBy: { createdAt: "desc" },
      take: MAX_MEMORIES_PER_USER
    });
  }

  async getRelevantMemories(userId: string, query: string): Promise<Array<{ id: string; type: string; content: string; score: number }>> {
    const normalizedQuery = query.trim();
    if (!userId || !normalizedQuery) {
      return [];
    }

    const queryEmbedding = await createEmbedding(normalizedQuery);
    const memories = await prisma.memory.findMany({
      where: { userId, scope: "USER" },
      orderBy: { createdAt: "desc" },
      take: 120
    });

    return memories
      .map((memory) => ({
        id: memory.id,
        type: memory.type,
        content: memory.content,
        score: cosineSimilarity(queryEmbedding, JSON.parse(memory.embedding ?? "[]") as number[])
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, MAX_RELEVANT_MEMORIES);
  }

  async extractAndStoreLongTermMemories(input: {
    userId: string;
    userMessage: string;
    assistantMessage: string;
  }): Promise<Array<{ type: PersistentMemoryType; content: string }>> {
    const prompt = [
      "Extract important long-term memory from this conversation.",
      "Store only durable user profile knowledge.",
      "Allowed types: preference | goal | fact.",
      "Return JSON array only with items: { type, content }.",
      "Skip temporary or noisy details.",
      "",
      `USER: ${input.userMessage}`,
      `ASSISTANT: ${input.assistantMessage}`
    ].join("\n");

    let extracted: Array<{ type: PersistentMemoryType; content: string }> = [];

    try {
      const structured = await completeJson<Array<{ type: string; content: string }>>(
        prompt,
        "You are Jarvis memory extractor. Keep only useful long-term memories.",
        400
      );

      extracted = (structured.content ?? [])
        .map((item) => {
          const memoryType: PersistentMemoryType =
            item.type === "preference" || item.type === "goal" || item.type === "fact"
              ? item.type
              : "fact";

          return {
            type: memoryType,
            content: String(item.content ?? "").trim()
          };
        })
        .filter((item) => item.content.length >= 8 && item.content.length <= 280)
        .slice(0, 5);
    } catch {
      const fallback = await completeText(
        prompt,
        "If JSON fails, return short bullet points in format: [type] content",
        250
      );

      extracted = fallback.content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const match = line.match(/^[-*\d.)\s]*\[(preference|goal|fact)\]\s*(.+)$/i);
          if (!match) {
            return null;
          }
          return {
            type: match[1].toLowerCase() as PersistentMemoryType,
            content: match[2].trim()
          };
        })
        .filter((item): item is { type: PersistentMemoryType; content: string } => item !== null)
        .slice(0, 5);
    }

    const saved: Array<{ type: PersistentMemoryType; content: string }> = [];
    for (const item of extracted) {
      const id = await this.saveMemory(input.userId, item.type, item.content);
      if (id) {
        saved.push(item);
      }
    }

    return saved;
  }

  buildMemoryInjectionBlock(memories: Array<{ type: string; content: string; score?: number }>): string {
    if (!memories.length) {
      return "";
    }

    const confidenceLabel = (score?: number): string => {
      if (score === undefined) {
        return "unknown";
      }
      if (score >= 0.75) {
        return "high";
      }
      if (score >= 0.5) {
        return "medium";
      }
      return "low";
    };

    return [
      "User memory:",
      ...memories.map((memory) => `- (${memory.type}|confidence:${confidenceLabel(memory.score)}) ${memory.content}`),
      "",
      "Use these memories when relevant while responding."
    ].join("\n");
  }

  private async enforceUserMemoryLimit(userId: string, maxCount: number): Promise<void> {
    const records = await prisma.memory.findMany({
      where: { userId, scope: "USER" },
      orderBy: { createdAt: "desc" },
      select: { id: true }
    });

    if (records.length <= maxCount) {
      return;
    }

    const toDelete = records.slice(maxCount).map((record) => record.id);
    await prisma.memory.deleteMany({
      where: { id: { in: toDelete } }
    });
  }
}
