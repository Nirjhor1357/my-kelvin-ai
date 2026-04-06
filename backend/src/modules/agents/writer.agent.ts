import { completeText } from "../../llm/llmClient.js";
import { AgentPlanStep } from "./planner.js";

export interface WriterAgentInput {
  goal: string;
  steps: AgentPlanStep[];
  analysis: string;
  keyInsights: string[];
}

export interface WriterAgentOutput {
  content: string;
}

export class WriterAgent {
  async run(input: WriterAgentInput): Promise<WriterAgentOutput> {
    const prompt = [
      `Goal: ${input.goal}`,
      "",
      "Plan used:",
      input.steps.map((step) => `- ${step.title}`).join("\n") || "None",
      "",
      "Reasoning analysis:",
      input.analysis || "None",
      "",
      "Key insights:",
      input.keyInsights.map((insight) => `- ${insight}`).join("\n") || "None",
      "",
      "Write the final response in a clear, human-readable format with concise structure."
    ].join("\n");

    try {
      const finalDraft = await completeText(
        prompt,
        "You are Jarvis writer agent. Produce polished, helpful final output.",
        800
      );

      return {
        content: finalDraft.content || "No final output generated."
      };
    } catch {
      return {
        content: [
          "Final answer (fallback):",
          input.keyInsights.map((insight, index) => `${index + 1}. ${insight}`).join("\n") || input.analysis || "No output available."
        ].join("\n")
      };
    }
  }
}
