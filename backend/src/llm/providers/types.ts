export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse<T = string> {
  content: T;
  usage: LLMUsage;
}

export interface LLMProvider {
  readonly name: "groq" | "openai";
  completeText(input: { prompt: string; system: string; maxOutputTokens: number; timeoutMs: number }): Promise<LLMResponse<string>>;
  streamText(input: { prompt: string; system: string; maxOutputTokens: number; timeoutMs: number }): AsyncGenerator<string>;
  createEmbedding(text: string): Promise<number[]>;
}
