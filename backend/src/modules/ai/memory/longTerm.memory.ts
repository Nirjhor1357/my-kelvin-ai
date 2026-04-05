import { prisma } from "../../../lib/prisma.js";
import { VectorMemory } from "./vector.memory.js";
import { MemoryScope } from "../ai.model.js";

export class LongTermMemory {
  constructor(public readonly vector = new VectorMemory()) {}

  async add(input: { userId?: string; scope: MemoryScope; content: string; metadata?: Record<string, unknown> }): Promise<string> {
    return this.vector.save(input);
  }

  async rememberUserPreference(userId: string, content: string): Promise<string> {
    return this.add({ userId, scope: "USER", content, metadata: { kind: "preference" } });
  }

  async list(userId: string): Promise<Array<{ id: string; content: string; createdAt: Date }>> {
    return prisma.memory.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }
}
