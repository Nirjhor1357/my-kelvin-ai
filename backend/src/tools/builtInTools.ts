import { z } from "zod";
import { ToolDefinition } from "./types.js";

const fetchJsonInputSchema = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST"]).default("GET"),
  body: z.record(z.string(), z.unknown()).optional()
});

const saveMemoryInputSchema = z.object({
  scope: z.enum(["user", "project", "global"]).default("project"),
  content: z.string().min(1),
  tags: z.array(z.string()).optional()
});

const searchMemoryInputSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().min(1).max(10).default(5)
});

export const builtInTools: ToolDefinition[] = [
  {
    name: "time.now",
    description: "Get current ISO timestamp.",
    inputSchema: {},
    run: async () => new Date().toISOString()
  },
  {
    name: "http.fetchJson",
    description: "Fetch JSON from an allowed public API endpoint.",
    inputSchema: {
      url: "string URL",
      method: "GET | POST",
      body: "optional object"
    },
    run: async (input) => {
      const parsed = fetchJsonInputSchema.parse(input);
      const allowedHosts = ["api.github.com", "httpbin.org", "jsonplaceholder.typicode.com"];
      const host = new URL(parsed.url).hostname;

      if (!allowedHosts.includes(host)) {
        throw new Error(`Host ${host} is not allowed by policy.`);
      }

      const response = await fetch(parsed.url, {
        method: parsed.method,
        headers: { "Content-Type": "application/json" },
        body: parsed.method === "POST" ? JSON.stringify(parsed.body ?? {}) : undefined
      });

      const json = await response.json();
      return JSON.stringify(json).slice(0, 8000);
    }
  },
  {
    name: "memory.save",
    description: "Persist a durable memory record.",
    inputSchema: {
      scope: "user | project | global",
      content: "string",
      tags: "optional string[]"
    },
    run: async (input, context) => {
      const parsed = saveMemoryInputSchema.parse(input);
      const id = await context.memory.addLongTermMemory({
        sessionId: context.sessionId,
        scope: parsed.scope,
        content: parsed.content,
        metadata: { tags: parsed.tags ?? [] }
      });

      return `memory_saved:${id}`;
    }
  },
  {
    name: "memory.search",
    description: "Semantic search over long-term memory.",
    inputSchema: {
      query: "string",
      topK: "number (1-10)"
    },
    run: async (input, context) => {
      const parsed = searchMemoryInputSchema.parse(input);
      const results = await context.memory.searchMemories(parsed.query, {
        sessionId: context.sessionId,
        topK: parsed.topK
      });

      return JSON.stringify(
        results.map((result) => ({ id: result.id, content: result.content, score: result.score ?? 0 })),
        null,
        2
      );
    }
  }
];
