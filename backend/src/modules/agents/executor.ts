import { completeText } from "../../llm/llmClient.js";
import { AgentPlanStep } from "./planner.js";
import { AgentToolRegistry } from "./tools.js";

export type AgentStepStatus = "pending" | "running" | "completed" | "failed";

export interface AgentStepResult {
  id: string;
  title: string;
  status: AgentStepStatus;
  tool?: string;
  output?: string;
  error?: string;
}

export class AgentExecutor {
  constructor(private readonly tools: AgentToolRegistry) {}

  async execute(input: {
    goal: string;
    userId?: string;
    chatId?: string;
    steps: AgentPlanStep[];
    memoryContext: string;
  }): Promise<{ steps: AgentStepResult[]; errors: string[] }> {
    const results: AgentStepResult[] = [];
    const errors: string[] = [];

    for (const step of input.steps) {
      const result: AgentStepResult = {
        id: step.id,
        title: step.title,
        status: "running",
        tool: step.tool
      };

      try {
        if (step.tool && this.tools.has(step.tool)) {
          result.output = await this.tools.execute(step.tool, step.input ?? { query: step.title }, {
            userId: input.userId,
            chatId: input.chatId,
            goal: input.goal
          });
        } else {
          const synthesis = await completeText(
            [
              `Goal: ${input.goal}`,
              `Step: ${step.title}`,
              "",
              "Context:",
              input.memoryContext || "None",
              "",
              "Previous outputs:",
              results.map((entry) => `- ${entry.title}: ${entry.output ?? entry.error ?? "n/a"}`).join("\n") || "None",
              "",
              "Execute this step and provide practical output."
            ].join("\n"),
            "You are Jarvis executor. Be concise and actionable.",
            500
          );
          result.output = synthesis.content;
        }

        result.status = "completed";
      } catch (error) {
        result.status = "failed";
        result.error = error instanceof Error ? error.message : "Unknown step failure";
        errors.push(`${step.id}: ${result.error}`);
      }

      results.push(result);
    }

    return { steps: results, errors };
  }
}
