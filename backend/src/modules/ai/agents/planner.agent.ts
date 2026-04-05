import { randomUUID } from "node:crypto";
import { completeJson } from "../../../llm/llmClient.js";
import { AiPlanStep } from "../ai.model.js";

interface PlannerResponse {
  reasoning: string;
  steps: string[];
}

export class PlannerAgent {
  async createPlan(goal: string): Promise<{ reasoning: string; steps: AiPlanStep[]; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
    try {
      const response = await completeJson<PlannerResponse>(
        `Goal: ${goal}`,
        `You are the Planner Agent. Return JSON with reasoning and steps array. Produce 2-8 executable steps.`,
        500
      );

      return {
        reasoning: response.content.reasoning,
        steps: (response.content.steps ?? []).slice(0, 8).map((description) => ({
          id: randomUUID(),
          description,
          status: "pending",
          retries: 0
        })),
        usage: response.usage
      };
    } catch {
      const fallback = ["Clarify goal", "Execute the main action", "Validate the result", "Summarize outcome"];
      return {
        reasoning: "Fallback plan generated because planner failed to parse JSON.",
        steps: fallback.map((description) => ({ id: randomUUID(), description, status: "pending", retries: 0 })),
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      };
    }
  }
}
