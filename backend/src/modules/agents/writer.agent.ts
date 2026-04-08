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
      "- First extract and prioritize concrete facts from user input + memory: subjects, study hours, and study-time preference (night/day).",
      "- If subjects/hours/preference are present in memory, you must use them in the final plan.",
      "- Never invent random subjects, arbitrary hours, or generic placeholders when memory already has specifics.",
      "- Prioritize action over asking questions when memory already contains required details.",
      "- If memory is uncertain, proceed with only what is known and keep assumptions minimal and explicit.",
      "- Do not ask for confirmation.",
      "- Do not ask follow-up questions for fields already known from memory (for example: subjects or hours).",
      "- Ask at most one critical question only if absolutely required and only for missing critical constraints.",
      "- For study-schedule goals, output a full weekly plan with clear time blocks and subject-specific slots.",
      "- Use only user input and memory for plan details; avoid generic template wording.",
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
