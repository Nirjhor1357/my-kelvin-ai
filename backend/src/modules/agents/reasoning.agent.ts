import { completeText } from "../../llm/llmClient.js";
import { AgentPlanStep } from "./planner.js";
import { ResearchItem } from "./researcher.agent.js";

export interface ReasoningAgentInput {
  goal: string;
  steps: AgentPlanStep[];
  researchItems: ResearchItem[];
  researchData: string;
}

export interface ReasoningAgentOutput {
  analysis: string;
  keyInsights: string[];
}

export class ReasoningAgent {
  async run(input: ReasoningAgentInput): Promise<ReasoningAgentOutput> {
    const prompt = [
      `Goal: ${input.goal}`,
      "",
      "Plan steps:",
      input.steps.map((step) => `- ${step.title}`).join("\n") || "None",
      "",
      "Raw research data:",
      input.researchData || "None",
      "",
      "Analyze the data and return:",
      "1) Key insights that matter for the goal",
      "2) Important caveats or uncertainty",
      "3) A concise logical conclusion"
    ].join("\n");

    try {
      const synthesis = await completeText(
        prompt,
        "You are Jarvis reasoning agent. Extract signal, remove noise, and produce structured reasoning.",
        700
      );

      const analysis = synthesis.content || "No analysis generated.";
      const keyInsights = analysis
        .split("\n")
        .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 6);

      return {
        analysis,
        keyInsights: keyInsights.length ? keyInsights : ["No explicit insight extracted."]
      };
    } catch {
      const fallbackInsights = input.researchItems.slice(0, 4).map((item) => `${item.query}: ${item.content.slice(0, 140)}`);
      return {
        analysis: input.researchData || "Reasoning fallback used due to model failure.",
        keyInsights: fallbackInsights.length ? fallbackInsights : ["No data available for reasoning."]
      };
    }
  }
}
