import { env } from "../../shared/env.js";
import { LLMProvider } from "./types.js";
import { OpenAICompatibleProvider } from "./openaiCompatibleProvider.js";

export function createProvider(): LLMProvider | null {
  if (env.AI_PROVIDER === "groq" && env.GROQ_API_KEY) {
    return new OpenAICompatibleProvider({
      name: "groq",
      apiKey: env.GROQ_API_KEY,
      model: env.GROQ_MODEL,
      baseURL: "https://api.groq.com/openai/v1"
    });
  }

  if (env.OPENAI_API_KEY) {
    return new OpenAICompatibleProvider({
      name: "openai",
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
      embeddingModel: env.OPENAI_EMBEDDING_MODEL
    });
  }

  return null;
}
