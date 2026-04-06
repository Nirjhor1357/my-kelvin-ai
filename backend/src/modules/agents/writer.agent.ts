import { completeText } from "../../llm/llmClient.js";
import { AgentPlanStep } from "./planner.js";

export interface WriterAgentInput {
  goal: string;
  steps: AgentPlanStep[];
  analysis: string;
  keyInsights: string[];
  memoryContext?: string;
}

export interface WriterAgentOutput {
  content: string;
}

export class WriterAgent {
  async run(input: WriterAgentInput): Promise<WriterAgentOutput> {
    console.log("✍️ Writer Agent running...");
    const prompt = [
      `Goal: ${input.goal}`,
      "",
      "Plan used:",
      input.steps.map((step) => `- ${step.title}`).join("\n") || "None",
      "",
      "Reasoning analysis:",
      input.analysis || "None",
      "",
      "Relevant user memory:",
      input.memoryContext || "None",
      "",
      "Key insights:",
      input.keyInsights.map((insight) => `- ${insight}`).join("\n") || "None",
      "",
      "Response policy:",
      "- If relevant user memory exists, use it to make decisions without asking unnecessary follow-up questions.",
      "- Prioritize action over asking questions when memory already contains required details.",
      "- If memory is uncertain, use soft confirmation (e.g., proceed based on known preference and mention user can correct it).",
      "- Do not ask for confirmation.",
      "- Ask at most one critical question only if absolutely required.",
      "- If details are missing, assume reasonable defaults and state assumptions briefly.",
      "",
      "Write the final response in a clear, human-readable format with concise structure."
    ].join("\n");

    try {
      const finalDraft = await completeText(
        prompt,
        "You are Jarvis writer agent. Produce polished, helpful final output. Be decisive, avoid confirmation loops, and ask at most one critical question if absolutely necessary.",
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
