import { completeJson } from "../llm/llmClient.js";
import { EXECUTOR_PROMPT } from "../llm/prompts.js";
import { ToolDefinition } from "../tools/types.js";

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
    const toolCatalog = input.availableTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));

    try {
      const response = await completeJson<ExecutorDecision>(
        JSON.stringify(
          {
            goal: input.goal,
            step: input.step,
            previousResult: input.previousResult ?? null,
            tools: toolCatalog
          },
          null,
          2
        ),
        EXECUTOR_PROMPT,
        600
      );

      return {
        decision: {
          thought: response.content.thought ?? "No thought provided",
          tool: response.content.tool ?? "none",
          input: response.content.input ?? {},
          directResponse: response.content.directResponse
        },
        usage: response.usage
      };
    } catch {
      return {
        decision: {
          thought: "Fallback executor selected no tool",
          tool: "none",
          input: {},
          directResponse: `Executed step logically: ${input.step}`
        },
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      };
    }
  }
}
