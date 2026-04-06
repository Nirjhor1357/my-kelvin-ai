import { completeText } from "../../llm/llmClient.js";
import { AgentEvaluator, EvaluationResult } from "./evaluator.js";
import { AgentPlanner, AgentPlanStep } from "./planner.js";
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

// Tool execution response from AI
export interface AIToolResponse {
  type: "tool" | "final";
  tool?: string;
  input?: Record<string, unknown> | string;
  content?: string;
  reasoning?: string;
}

export interface ToolExecutionLog {
  iterationNumber: number;
  toolName?: string;
  toolInput?: Record<string, unknown> | string;
  toolOutput?: string;
  toolError?: string;
  isFinal: boolean;
  finalResult?: string;
}

export interface ExecutionWithThinkingResult {
  steps: AgentStepResult[];
  errors: string[];
  iterationCount: number;
  evaluations: EvaluationResult[];
  finalResult: string;
  success: boolean;
}

export interface ExecutionWithToolsResult {
  success: boolean;
  result: string;
  toolExecutions: ToolExecutionLog[];
  errors: string[];
  iterationCount: number;
}

export class AgentExecutor {
  private readonly evaluator = new AgentEvaluator();
  private readonly planner = new AgentPlanner();
  private readonly maxIterations = 3;

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

  async executeWithThinking(input: {
    goal: string;
    userId?: string;
    chatId?: string;
    steps: AgentPlanStep[];
    memoryContext: string;
    availableTools: Array<{ name: string; description: string }>;
  }): Promise<ExecutionWithThinkingResult> {
    let currentSteps = input.steps;
    const evaluations: EvaluationResult[] = [];
    let allResults: AgentStepResult[] = [];
    let allErrors: string[] = [];

    console.log(`\n[Agent Thinking] Starting self-improving loop for goal: "${input.goal}"`);

    for (let iteration = 1; iteration <= this.maxIterations; iteration++) {
      console.log(`\n[Agent Thinking] === Iteration ${iteration}/${this.maxIterations} ===`);

      // Execute plan
      const execution = await this.execute({
        goal: input.goal,
        userId: input.userId,
        chatId: input.chatId,
        steps: currentSteps,
        memoryContext: input.memoryContext
      });

      allResults = execution.steps;
      allErrors = execution.errors;

      // Generate result summary
      const resultSummary = execution.steps
        .map((step) => `- ${step.title}: ${step.output ?? step.error ?? "completed"}`)
        .join("\n");

      // Evaluate result
      const evaluation = await this.evaluator.evaluate({
        goal: input.goal,
        result: resultSummary,
        previousAttempts: iteration
      });

      evaluations.push(evaluation);
      this.evaluator.logEvaluation(iteration, input.goal, resultSummary, evaluation, this.maxIterations);

      // If successful or last iteration, return
      if (evaluation.success || iteration === this.maxIterations) {
        console.log(`\n[Agent Thinking] Loop completed after ${iteration} iteration(s)`);

        return {
          steps: allResults,
          errors: allErrors,
          iterationCount: iteration,
          evaluations,
          finalResult: resultSummary,
          success: evaluation.success
        };
      }

      // Improve plan for next iteration
      console.log(`[Agent Thinking] Improving plan based on feedback...`);

      try {
        currentSteps = await this.planner.improvePlan({
          goal: input.goal,
          currentSteps,
          feedback: evaluation.feedback,
          availableTools: input.availableTools
        });

        console.log(
          `[Agent Thinking] Plan improved with ${currentSteps.length} steps for next iteration`
        );
      } catch (error) {
        console.error("[Agent Thinking] Plan improvement failed, keeping current steps:", error);
        // Keep current steps if improvement fails
      }
    }

    // Fallback: should not reach here
    return {
      steps: allResults,
      errors: allErrors,
      iterationCount: this.maxIterations,
      evaluations,
      finalResult: allResults
        .map((step) => `- ${step.title}: ${step.output ?? step.error ?? "completed"}`)
        .join("\n"),
      success: false
    };
  }

  private buildToolPromptContext(availableTools: Array<{ name: string; description: string }>): string {
    if (!availableTools.length) {
      return "No tools available.";
    }

    return [
      "Available tools you can use:",
      availableTools
        .map((tool) => `- ${tool.name}: ${tool.description}`)
        .join("\n"),
      "",
      "Respond in JSON format:",
      '{',
      '  "type": "tool" or "final",',
      '  "tool": "tool_name (only if type=tool)",',
      '  "input": "tool input as string or object",',
      '  "content": "final answer (only if type=final)",',
      '  "reasoning": "brief explanation of your choice"',
      '}'
    ].join("\n");
  }

  private parseAIResponse(response: string): AIToolResponse | null {
    try {
      const cleaned = response
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      const parsed = JSON.parse(cleaned) as AIToolResponse;

      if (parsed.type === "tool" && !parsed.tool) {
        console.warn("[Tool Executor] Invalid response: type=tool but no tool specified");
        return null;
      }

      if (parsed.type === "final" && !parsed.content) {
        console.warn("[Tool Executor] Invalid response: type=final but no content");
        return null;
      }

      return parsed;
    } catch (error) {
      console.warn("[Tool Executor] Failed to parse AI response as JSON:", error);
      return null;
    }
  }

  private logToolExecution(
    iteration: number,
    maxIterations: number,
    toolName: string | undefined,
    toolInput: Record<string, unknown> | string | undefined,
    result: string | undefined,
    error: string | undefined
  ): void {
    if (toolName && result) {
      console.log(`[Tool Executor] [${iteration}/${maxIterations}] ✅ Executed tool: ${toolName}`);
      console.log(`  Input: ${JSON.stringify(toolInput)}`);
      console.log(`  Output: ${result.substring(0, 100)}...`);
    } else if (error) {
      console.log(`[Tool Executor] [${iteration}/${maxIterations}] ❌ Tool error: ${error}`);
    } else {
      console.log(`[Tool Executor] [${iteration}/${maxIterations}] ✅ Final answer provided`);
    }
  }

  async executeWithTools(input: {
    goal: string;
    userId?: string;
    chatId?: string;
    memoryContext: string;
    availableTools: Array<{ name: string; description: string }>;
  }): Promise<ExecutionWithToolsResult> {
    const maxToolIterations = 5;
    const toolExecutions: ToolExecutionLog[] = [];
    const errors: string[] = [];
    let conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [];

    console.log(`\n[Tool Executor] Starting agentic tool loop for goal: "${input.goal}"`);
    console.log(`[Tool Executor] Available tools: ${input.availableTools.map((t) => t.name).join(", ")}`);

    // Initial system prompt with memory context
    const systemPrompt = [
      "You are Jarvis, an autonomous AI agent with access to tools.",
      "Your goal is to accomplish the user's task by using available tools to gather information, save notes, and synthesize results.",
      "",
      "Context from previous conversation:",
      input.memoryContext || "No previous context.",
      "",
      "Always respond in valid JSON format. Choose between using a tool or providing the final answer.",
      "Think step-by-step about what information you need to complete the task."
    ].join("\n");

    for (let iteration = 1; iteration <= maxToolIterations; iteration++) {
      console.log(`\n[Tool Executor] === Iteration ${iteration}/${maxToolIterations} ===`);

      // Build the user message
      let userMessage: string;

      if (iteration === 1) {
        // First iteration: present goal and available tools
        userMessage = [
          `Goal: ${input.goal}`,
          "",
          this.buildToolPromptContext(input.availableTools)
        ].join("\n");
      } else {
        // Subsequent iterations: include tool results
        const lastLog = toolExecutions[toolExecutions.length - 1];

        if (lastLog?.toolOutput) {
          userMessage = [
            `Tool result from ${lastLog.toolName}:`,
            lastLog.toolOutput,
            "",
            "Based on this result, continue working toward the goal or provide the final answer.",
            "",
            this.buildToolPromptContext(input.availableTools)
          ].join("\n");
        } else if (lastLog?.toolError) {
          userMessage = [
            `Tool error from ${lastLog.toolName}: ${lastLog.toolError}`,
            "Try a different approach or tool.",
            "",
            this.buildToolPromptContext(input.availableTools)
          ].join("\n");
        } else {
          userMessage = [
            "Continue with the next step or provide the final answer.",
            "",
            this.buildToolPromptContext(input.availableTools)
          ].join("\n");
        }
      }

      // Add to conversation history
      conversationHistory.push({ role: "user", content: userMessage });

      // Call AI to decide next action
      let aiResponse: string;
      try {
        const result = await completeText(userMessage, systemPrompt, 800);
        aiResponse = result.content;
      } catch (error) {
        const errorMsg = `AI call failed: ${error instanceof Error ? error.message : "unknown error"}`;
        console.error(`[Tool Executor] ${errorMsg}`);
        errors.push(errorMsg);

        return {
          success: false,
          result: `Failed to call AI: ${errorMsg}`,
          toolExecutions,
          errors,
          iterationCount: iteration
        };
      }

      console.log(`[Tool Executor] AI response: ${aiResponse.substring(0, 150)}...`);

      // Parse AI response
      const decision = this.parseAIResponse(aiResponse);

      if (!decision) {
        const fallback = aiResponse;
        console.log("[Tool Executor] Failed to parse JSON, treating as final answer");

        toolExecutions.push({
          iterationNumber: iteration,
          isFinal: true,
          finalResult: fallback
        });

        return {
          success: true,
          result: fallback,
          toolExecutions,
          errors,
          iterationCount: iteration
        };
      }

      conversationHistory.push({ role: "assistant", content: aiResponse });

      // Handle final response
      if (decision.type === "final") {
        console.log(`[Tool Executor] Final answer provided`);

        toolExecutions.push({
          iterationNumber: iteration,
          isFinal: true,
          finalResult: decision.content
        });

        return {
          success: true,
          result: decision.content || "Task completed",
          toolExecutions,
          errors,
          iterationCount: iteration
        };
      }

      // Handle tool execution
      if (decision.type === "tool" && decision.tool) {
        const toolName = decision.tool;
        const toolInput = decision.input || { query: input.goal };

        console.log(`[Tool Executor] Executing tool: ${toolName}`);

        let toolResult: string | undefined;
        let toolError: string | undefined;

        try {
          if (!this.tools.has(toolName)) {
            throw new Error(`Unknown tool: ${toolName}. Available: ${input.availableTools.map((t) => t.name).join(", ")}`);
          }

          const normalizedInput = typeof toolInput === "string" ? { query: toolInput } : toolInput;
          toolResult = await this.tools.execute(toolName, normalizedInput, {
            userId: input.userId,
            chatId: input.chatId,
            goal: input.goal
          });

          this.logToolExecution(iteration, maxToolIterations, toolName, toolInput, toolResult, undefined);
        } catch (error) {
          toolError = error instanceof Error ? error.message : "Unknown tool error";
          this.logToolExecution(iteration, maxToolIterations, toolName, toolInput, undefined, toolError);
          errors.push(`[${toolName}] ${toolError}`);
        }

        toolExecutions.push({
          iterationNumber: iteration,
          toolName,
          toolInput,
          toolOutput: toolResult,
          toolError,
          isFinal: false
        });

        // Continue to next iteration with tool result
        continue;
      }

      // Safety: if we get an invalid decision, exit
      console.warn("[Tool Executor] Invalid decision structure, exiting loop");
      errors.push("Invalid AI decision structure");

      return {
        success: false,
        result: "Failed to process AI decision",
        toolExecutions,
        errors,
        iterationCount: iteration
      };
    }

    // Max iterations reached
    console.log(`[Tool Executor] Reached max iterations (${maxToolIterations})`);

    const lastExecution = toolExecutions[toolExecutions.length - 1];
    const finalResult = lastExecution?.toolOutput || lastExecution?.finalResult || "Max iterations reached without final answer";

    return {
      success: false,
      result: finalResult,
      toolExecutions,
      errors: [...errors, `Max iterations (${maxToolIterations}) reached`],
      iterationCount: maxToolIterations
    };
  }
}
