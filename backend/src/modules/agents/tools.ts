import { createEmbedding } from "../../llm/llmClient.js";
import { prisma } from "../../lib/prisma.js";

export interface AgentToolContext {
  userId?: string;
  chatId?: string;
  goal: string;
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  run: (input: Record<string, unknown>, context: AgentToolContext) => Promise<string>;
}

export class AgentToolRegistry {
  private readonly tools = new Map<string, AgentToolDefinition>();

  constructor(definitions: AgentToolDefinition[]) {
    for (const tool of definitions) {
      this.tools.set(tool.name, tool);
    }
  }

  list(): Array<{ name: string; description: string }> {
    return [...this.tools.values()].map((tool) => ({ name: tool.name, description: tool.description }));
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  async execute(name: string, input: Record<string, unknown>, context: AgentToolContext): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    return tool.run(input, context);
  }
}

export const defaultAgentTools: AgentToolDefinition[] = [
  {
    name: "search",
    description: "Searches known project/user memories for relevant context.",
    run: async (input, context) => {
      const query = String(input.query ?? context.goal).trim();
      if (!query) {
        return "No query provided for search tool.";
      }

      const memories = await prisma.memory.findMany({
        where: context.userId ? { userId: context.userId } : undefined,
        orderBy: { createdAt: "desc" },
        take: 5
      });

      if (!memories.length) {
        return `No stored memory found for query: ${query}`;
      }

      const normalizedQuery = query.toLowerCase();
      const ranked = memories
        .map((memory) => ({
          content: memory.content,
          score: memory.content.toLowerCase().includes(normalizedQuery) ? 1 : 0
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, 3)
        .map((entry, index) => `${index + 1}. ${entry.content}`)
        .join("\n");

      return ranked || `No relevant memory found for query: ${query}`;
    }
  },
  {
    name: "saveNote",
    description: "Saves a durable note into long-term memory.",
    run: async (input, context) => {
      const content = String(input.content ?? "").trim();
      if (!content) {
        return "No content provided to saveNote tool.";
      }

      const embedding = await createEmbedding(content);
      const record = await prisma.memory.create({
        data: {
          userId: context.userId,
          scope: "PROJECT",
          content,
          embedding: JSON.stringify(embedding),
          metadata: JSON.stringify({ source: "agent", chatId: context.chatId ?? null })
        }
      });

      return `Saved note ${record.id}`;
    }
  },
  {
    name: "summarize",
    description: "Creates a compact summary from long text content.",
    run: async (input) => {
      const text = String(input.text ?? input.content ?? "").trim();
      if (!text) {
        return "No content provided to summarize tool.";
      }

      const limited = text.slice(0, 1200);
      const short = limited.length <= 220 ? limited : `${limited.slice(0, 220)}...`;
      return `Summary: ${short}`;
    }
  }
];
