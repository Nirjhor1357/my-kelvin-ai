import { env } from "../config/env.js";
import { withRetry } from "../shared/retry.js";
import { createProvider } from "./providers/factory.js";
import { LLMResponse, LLMUsage } from "./providers/types.js";

const provider = createProvider();

function normalizeMessageContent(content: string | Array<{ type: string; text?: string }> | null): string {
  if (!content) {
    return "";
  }

  if (typeof content === "string") {
    return content;
  }

  return content
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}

function parseJson<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(`LLM JSON parse failed: ${(error as Error).message}. Raw: ${raw}`);
  }
}

export async function completeText(prompt: string, system: string, maxOutputTokens = 700): Promise<LLMResponse<string>> {
  if (!provider) {
    return {
      content: "No AI API key configured. Set GROQ_API_KEY (preferred) or OPENAI_API_KEY.",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    };
  }

  try {
    return await withRetry(
      async (attempt) => provider.completeText({
        prompt,
        system,
        maxOutputTokens,
        timeoutMs: env.AI_TIMEOUT_MS + attempt * 1000
      }),
      {
        retries: env.AI_MAX_RETRIES,
        baseDelayMs: 500,
        maxDelayMs: 2500,
        shouldRetry: (error) => {
          const status = (error as { status?: number })?.status;
          return !(status === 401 || status === 403);
        }
      }
    );
  } catch {
    return {
      content: env.AI_FALLBACK_MESSAGE,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    };
  }
}

export async function* streamText(prompt: string, system: string, maxOutputTokens = 700): AsyncGenerator<string> {
  if (!provider) {
    yield "No AI API key configured. Set GROQ_API_KEY (preferred) or OPENAI_API_KEY.";
    return;
  }

  try {
    for await (const token of provider.streamText({
      prompt,
      system,
      maxOutputTokens,
      timeoutMs: env.AI_TIMEOUT_MS
    })) {
      yield token;
    }
  } catch {
    yield env.AI_FALLBACK_MESSAGE;
  }
}

export async function completeJson<T>(prompt: string, system: string, maxOutputTokens = 700): Promise<LLMResponse<T>> {
  const result = await completeText(prompt, system, maxOutputTokens);
  return {
    content: parseJson<T>(result.content),
    usage: result.usage
  };
}

export async function createEmbedding(text: string): Promise<number[]> {
  if (!provider) {
    return deterministicEmbedding(text, 256);
  }

  return provider.createEmbedding(text);
}

function deterministicEmbedding(text: string, dimensions: number): number[] {
  const vec = new Array<number>(dimensions).fill(0);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    const index = (code + i * 31) % dimensions;
    vec[index] += 1;
  }

  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}
