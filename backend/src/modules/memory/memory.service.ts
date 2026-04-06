import { completeJson, completeText } from "../../llm/llmClient.js";
import { createEmbedding } from "../../llm/llmClient.js";
import { prisma } from "../../lib/prisma.js";

export type PersistentMemoryType = "preference" | "goal" | "fact";
export type MemoryConfidence = "low" | "medium" | "high";

interface StructuredMemory {
  type: PersistentMemoryType;
  key: string;
  value: string;
  confidence: MemoryConfidence;
  content: string;
}

const MAX_MEMORIES_PER_USER = 200;
const MAX_RELEVANT_MEMORIES = 8;

const CONFIDENCE_RANK: Record<MemoryConfidence, number> = {
  low: 1,
  medium: 2,
  high: 3
};

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
  private normalizeConfidence(value: string | undefined | null): MemoryConfidence {
    if (value === "high" || value === "medium" || value === "low") {
      return value;
    }
    return "medium";
  }

  private composeMemoryStatement(type: PersistentMemoryType, key: string, value: string): string {
    if (type === "preference" && key === "study_time") {
      return `User prefers studying at ${value}.`;
    }

    if (type === "preference") {
      return `User preference (${key}): ${value}.`;
    }

    if (type === "goal") {
      return `User goal (${key}): ${value}.`;
    }

    return `User fact (${key}): ${value}.`;
  }

  async saveMemory(
    userId: string,
    type: PersistentMemoryType,
    content: string,
    options?: { key?: string; value?: string; confidence?: MemoryConfidence }
  ): Promise<string | null> {
    const normalizedContent = content.trim();
    if (!userId || !normalizedContent || normalizedContent.length < 8) {
      return null;
    }

    const confidence = options?.confidence ?? "medium";
    if (confidence === "low") {
      return null;
    }

    const semanticKey = String(options?.key ?? "").trim() || undefined;
    const semanticValue = String(options?.value ?? "").trim() || undefined;

    if (semanticKey) {
      const existingByKey = await prisma.memory.findFirst({
        where: {
          userId,
          scope: "USER",
          type,
          key: semanticKey
        },
        orderBy: { createdAt: "desc" }
      });

      if (existingByKey) {
        const previousConfidence = this.normalizeConfidence(existingByKey.confidence);
        if (CONFIDENCE_RANK[confidence] < CONFIDENCE_RANK[previousConfidence]) {
          return existingByKey.id;
        }

        const updatedEmbedding = await createEmbedding(normalizedContent);
        const updated = await prisma.memory.update({
          where: { id: existingByKey.id },
          data: {
            value: semanticValue,
            confidence,
            content: normalizedContent,
            embedding: JSON.stringify(updatedEmbedding),
            metadata: JSON.stringify({
              source: "persistent-memory",
              memoryType: type,
              overwrite: true
            })
          }
        });

        return updated.id;
      }
    }

    const dedupe = await prisma.memory.findFirst({
      where: {
        userId,
        type,
        content: normalizedContent,
        scope: "USER",
        confidence: { not: "low" }
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
        key: semanticKey,
        value: semanticValue,
        confidence,
        scope: "USER",
        content: normalizedContent,
        embedding: JSON.stringify(embedding),
        metadata: JSON.stringify({
          source: "persistent-memory",
          memoryType: type,
          key: semanticKey,
          value: semanticValue,
          confidence
        })
      }
    });

    await this.enforceUserMemoryLimit(userId, MAX_MEMORIES_PER_USER);
    return record.id;
  }

  async getMemories(userId: string): Promise<Array<{ id: string; type: string; content: string; createdAt: Date }>> {
    const records = await prisma.memory.findMany({
      where: { userId, scope: "USER" },
      orderBy: { createdAt: "desc" },
      take: MAX_MEMORIES_PER_USER
    });

    return records.map((record) => ({
      id: record.id,
      type: record.type,
      content: record.content,
      createdAt: record.createdAt
    }));
  }

  async getRelevantMemories(userId: string, query: string): Promise<Array<{ id: string; type: string; key?: string; value?: string; confidence: MemoryConfidence; content: string; score: number }>> {
    const normalizedQuery = query.trim();
    if (!userId || !normalizedQuery) {
      return [];
    }

    const queryEmbedding = await createEmbedding(normalizedQuery);
    const queryLower = normalizedQuery.toLowerCase();
    const memories = await prisma.memory.findMany({
      where: {
        userId,
        scope: "USER",
        confidence: { not: "low" }
      },
      orderBy: { createdAt: "desc" },
      take: 120
    });

    return memories
      .map((memory) => ({
        id: memory.id,
        type: memory.type,
        key: memory.key ?? undefined,
        value: memory.value ?? undefined,
        confidence: this.normalizeConfidence(memory.confidence),
        content: memory.content,
        score:
          cosineSimilarity(queryEmbedding, JSON.parse(memory.embedding ?? "[]") as number[]) +
          (memory.key && queryLower.includes(memory.key.toLowerCase()) ? 0.25 : 0) +
          (memory.value && queryLower.includes(memory.value.toLowerCase()) ? 0.2 : 0)
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, MAX_RELEVANT_MEMORIES);
  }

  async extractAndStoreLongTermMemories(input: {
    userId: string;
    userMessage: string;
    assistantMessage: string;
  }): Promise<Array<{ type: PersistentMemoryType; key: string; value: string; confidence: MemoryConfidence; content: string }>> {
    const prompt = [
      "Extract structured long-term memory.",
      "Store only durable user profile knowledge.",
      "Return JSON array:",
      "[",
      "  {",
      '    "type": "preference | goal | fact",',
      '    "key": "string",',
      '    "value": "string",',
      '    "confidence": "low | medium | high"',
      "  }",
      "]",
      "Skip temporary or noisy details.",
      "",
      `USER: ${input.userMessage}`,
      `ASSISTANT: ${input.assistantMessage}`
    ].join("\n");

    let extracted: Array<{ type: PersistentMemoryType; key: string; value: string; confidence: MemoryConfidence; content: string }> = [];

    try {
      const structured = await completeJson<Array<{ type: string; key: string; value: string; confidence: string }>>(
        prompt,
        "You are Jarvis memory extractor. Keep only useful, structured long-term memories.",
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
            key: String(item.key ?? "").trim().toLowerCase().replace(/\s+/g, "_"),
            value: String(item.value ?? "").trim(),
            confidence: this.normalizeConfidence(item.confidence),
            content: this.composeMemoryStatement(memoryType, String(item.key ?? "").trim().toLowerCase().replace(/\s+/g, "_"), String(item.value ?? "").trim())
          };
        })
        .filter((item) => item.key.length >= 2 && item.value.length >= 2 && item.confidence !== "low")
        .slice(0, 5);
    } catch {
      const fallback = await completeText(
        prompt,
        "If JSON fails, return short bullet points in format: [type] [key] [value] [confidence]",
        250
      );

      extracted = fallback.content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const match = line.match(/^[-*\d.)\s]*\[(preference|goal|fact)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[(low|medium|high)\]$/i);
          if (!match) {
            return null;
          }

          const memoryType = match[1].toLowerCase() as PersistentMemoryType;
          const key = match[2].trim().toLowerCase().replace(/\s+/g, "_");
          const value = match[3].trim();
          const confidence = this.normalizeConfidence(match[4].toLowerCase());

          return {
            type: memoryType,
            key,
            value,
            confidence,
            content: this.composeMemoryStatement(memoryType, key, value)
          };
        })
        .filter((item): item is { type: PersistentMemoryType; key: string; value: string; confidence: MemoryConfidence; content: string } => item !== null && item.confidence !== "low")
        .slice(0, 5);
    }

    const saved: Array<{ type: PersistentMemoryType; key: string; value: string; confidence: MemoryConfidence; content: string }> = [];
    for (const item of extracted) {
      const id = await this.saveMemory(input.userId, item.type, item.content, {
        key: item.key,
        value: item.value,
        confidence: item.confidence
      });
      if (id) {
        saved.push(item);
      }
    }

    return saved;
  }

  buildMemoryInjectionBlock(memories: Array<{ type: string; key?: string; value?: string; confidence?: MemoryConfidence; content: string; score?: number }>): string {
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
      ...memories
        .filter((memory) => (memory.confidence ?? "medium") !== "low")
        .map((memory) => {
          const key = memory.key ?? "";
          const value = memory.value ?? "";
          const confidence = memory.confidence ?? confidenceLabel(memory.score);

          if (memory.type === "preference" && key === "study_time" && value) {
            return `- (preference|confidence:${confidence}) User prefers studying at ${value}.`;
          }

          if (key && value) {
            return `- (${memory.type}|confidence:${confidence}) ${key}: ${value}.`;
          }

          return `- (${memory.type}|confidence:${confidence}) ${memory.content}`;
        }),
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
