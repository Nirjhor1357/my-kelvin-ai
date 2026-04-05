import OpenAI from "openai";
import { env } from "../config/env.js";

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse<T = string> {
  content: T;
  usage: LLMUsage;
}

const openAiClient = env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
  : null;

const groqClient = env.GROQ_API_KEY
  ? new OpenAI({
      apiKey: env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1"
    })
  : null;

function resolveTextClient(): { client: OpenAI | null; model: string; provider: "groq" | "openai" } {
  if (env.AI_PROVIDER === "groq") {
    return {
      client: groqClient ?? openAiClient,
      model: groqClient ? env.GROQ_MODEL : env.OPENAI_MODEL,
      provider: groqClient ? "groq" : "openai"
    };
  }

  return {
    client: openAiClient ?? groqClient,
    model: openAiClient ? env.OPENAI_MODEL : env.GROQ_MODEL,
    provider: openAiClient ? "openai" : "groq"
  };
}

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
  const { client, model, provider } = resolveTextClient();
  if (!client) {
    return {
      content: "No AI API key configured. Set GROQ_API_KEY (preferred) or OPENAI_API_KEY.",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    };
  }

  const response = await client.chat.completions.create({
    model,
    max_tokens: maxOutputTokens,
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt }
    ]
  });

  const text = normalizeMessageContent(response.choices[0]?.message?.content ?? "");
  return {
    content: text || `Empty completion from ${provider} provider`,
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0
    }
  };
}

export async function completeJson<T>(prompt: string, system: string, maxOutputTokens = 700): Promise<LLMResponse<T>> {
  const result = await completeText(prompt, system, maxOutputTokens);
  return {
    content: parseJson<T>(result.content),
    usage: result.usage
  };
}

export async function createEmbedding(text: string): Promise<number[]> {
  if (!openAiClient || !env.OPENAI_EMBEDDING_MODEL) {
    return deterministicEmbedding(text, 256);
  }

  const response = await openAiClient.embeddings.create({
    model: env.OPENAI_EMBEDDING_MODEL,
    input: text.slice(0, 8000)
  });

  return response.data[0]?.embedding ?? deterministicEmbedding(text, 256);
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
