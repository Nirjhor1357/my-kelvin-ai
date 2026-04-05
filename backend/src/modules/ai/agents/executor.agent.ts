import { completeJson } from "../../../llm/llmClient.js";
import { ToolDefinition } from "../tools/tool-registry.js";

interface ExecutorDecision {
  thought: string;
  tool: string;
  input: Record<string, unknown>;
  directResponse?: string;
}

export class ExecutorAgent {
  async decide(input: {
    goal: string;
    step: string;
    previousResult?: string;
    availableTools: ToolDefinition[];
  }): Promise<{ decision: ExecutorDecision; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
    try {
      const response = await completeJson<ExecutorDecision>(
        JSON.stringify(
          {
            goal: input.goal,
            step: input.step,
            previousResult: input.previousResult ?? null,
            tools: input.availableTools.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema }))
          },
          null,
          2
        ),
        `You are the Executor Agent. Decide whether to use a tool. Return JSON with thought, tool, input, and directResponse. Use tool="none" if not needed.`,
        600
      );

      return {
        decision: {
          thought: response.content.thought ?? "",
          tool: response.content.tool ?? "none",
          input: response.content.input ?? {},
          directResponse: response.content.directResponse
        },
        usage: response.usage
      };
    } catch {
      return {
        decision: {
          thought: "Fallback executor response.",
          tool: "none",
          input: {},
          directResponse: `Executed step logically: ${input.step}`
        },
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      };
    }
  }
}
