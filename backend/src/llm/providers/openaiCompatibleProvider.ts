import OpenAI from "openai";
import { LLMProvider, LLMResponse } from "./types.js";

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

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: "groq" | "openai";
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly embeddingModel?: string;

  constructor(options: { name: "groq" | "openai"; apiKey: string; model: string; baseURL?: string; embeddingModel?: string }) {
    this.name = options.name;
    this.model = options.model;
    this.embeddingModel = options.embeddingModel;
    this.client = new OpenAI({ apiKey: options.apiKey, baseURL: options.baseURL });
  }

  async completeText(input: { prompt: string; system: string; maxOutputTokens: number; timeoutMs: number }): Promise<LLMResponse<string>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(`AI timeout after ${input.timeoutMs}ms`), input.timeoutMs);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: input.maxOutputTokens,
        temperature: 0.2,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.prompt }
        ]
      }, {
        signal: controller.signal
      });

      const text = normalizeMessageContent(response.choices[0]?.message?.content ?? "");
      return {
        content: text,
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0
        }
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async *streamText(input: { prompt: string; system: string; maxOutputTokens: number; timeoutMs: number }): AsyncGenerator<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(`AI stream timeout after ${input.timeoutMs}ms`), input.timeoutMs);

    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: input.maxOutputTokens,
        temperature: 0.2,
        stream: true,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.prompt }
        ]
      }, {
        signal: controller.signal
      });

      for await (const chunk of stream) {
        const piece = chunk.choices?.[0]?.delta?.content ?? "";
        if (piece) {
          yield piece;
        }
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async createEmbedding(text: string): Promise<number[]> {
    if (!this.embeddingModel || this.name === "groq") {
      return deterministicEmbedding(text, 256);
    }

    const response = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: text.slice(0, 8000)
    });

    return response.data[0]?.embedding ?? deterministicEmbedding(text, 256);
  }
}
