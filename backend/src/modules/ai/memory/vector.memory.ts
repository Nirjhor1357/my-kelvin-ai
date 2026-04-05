import { createEmbedding } from "../../../llm/llmClient.js";
import { prisma } from "../../../lib/prisma.js";
import { MemoryScope } from "../ai.model.js";

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

export class VectorMemory {
  async save(input: { userId?: string; scope: MemoryScope; content: string; metadata?: Record<string, unknown> }): Promise<string> {
    const embedding = await createEmbedding(input.content);
    const record = await prisma.memory.create({
      data: {
        userId: input.userId,
        scope: input.scope,
        content: input.content,
        embedding: JSON.stringify(embedding),
        metadata: JSON.stringify(input.metadata ?? {})
      }
    });

    return record.id;
  }

  async search(input: { userId?: string; query: string; topK?: number; scope?: MemoryScope }): Promise<Array<{ id: string; content: string; score: number }>> {
    const queryEmbedding = await createEmbedding(input.query);
    const memories = await prisma.memory.findMany({
      where: {
        ...(input.userId ? { userId: input.userId } : {}),
        ...(input.scope ? { scope: input.scope } : {})
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return memories
      .map((memory: { id: string; content: string; embedding: string | null }) => ({
        id: memory.id,
        content: memory.content,
        score: cosineSimilarity(queryEmbedding, JSON.parse(memory.embedding ?? "[]") as number[])
      }))
      .sort((left: { score: number }, right: { score: number }) => right.score - left.score)
      .slice(0, input.topK ?? 5);
  }
}
