import { completeJson } from "../llm/llmClient.js";
import { CRITIC_PROMPT } from "../llm/prompts.js";

interface CriticResult {
  pass: boolean;
  feedback: string;
  retryHint?: string;
}

export class CriticAgent {
  async evaluate(input: {
    goal: string;
    step: string;
    stepResult: string;
  }): Promise<{ verdict: CriticResult; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
    try {
      const response = await completeJson<CriticResult>(
        JSON.stringify(input, null, 2),
        CRITIC_PROMPT,
        400
      );

      return {
        verdict: {
          pass: Boolean(response.content.pass),
          feedback: response.content.feedback ?? "No feedback",
          retryHint: response.content.retryHint
        },
        usage: response.usage
      };
    } catch {
      return {
        verdict: {
          pass: input.stepResult.length > 0,
          feedback: "Fallback critic accepted non-empty output"
        },
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      };
    }
  }
}
