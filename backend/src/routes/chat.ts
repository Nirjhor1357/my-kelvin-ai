import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppContext } from "../appContext.js";
import { completeText } from "../llm/llmClient.js";
import { SYSTEM_PROMPT } from "../llm/prompts.js";

const chatRequestSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),
  includeMemoryTopK: z.number().int().min(1).max(10).default(4)
});

function buildPrompt(input: {
  message: string;
  recentMessages: Array<{ role: string; content: string }>;
  memorySnippets: string[];
}): string {
  const history = input.recentMessages
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join("\n");

  const memory = input.memorySnippets.length
    ? input.memorySnippets.map((item, idx) => `[${idx + 1}] ${item}`).join("\n")
    : "No relevant long-term memories";

  return [
    "Conversation history:",
    history || "No prior messages",
    "",
    "Relevant memories:",
    memory,
    "",
    "User message:",
    input.message,
    "",
    "Respond with practical, actionable output."
  ].join("\n");
}

export async function registerChatRoutes(app: FastifyInstance, context: AppContext): Promise<void> {
  app.post("/api/chat", async (request, reply) => {
    const parsed = chatRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { sessionId, message, includeMemoryTopK } = parsed.data;

    context.memory.addMessage(sessionId, { role: "user", content: message });
    const recentMessages = context.memory.getRecentMessages(sessionId, 12);
    const memoryResults = await context.memory.searchMemories(message, { sessionId, topK: includeMemoryTopK });
    const prompt = buildPrompt({
      message,
      recentMessages: recentMessages.map((msg) => ({ role: msg.role, content: msg.content })),
      memorySnippets: memoryResults.map((entry) => entry.content)
    });

    const completion = await completeText(prompt, SYSTEM_PROMPT, 800);
    const answer = completion.content || "No response generated.";

    context.memory.addMessage(sessionId, { role: "assistant", content: answer });

    return {
      answer,
      usage: completion.usage,
      retrievedMemories: memoryResults.map((entry) => ({ id: entry.id, score: entry.score ?? 0 }))
    };
  });
}
