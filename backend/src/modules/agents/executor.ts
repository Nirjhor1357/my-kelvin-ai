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

export interface ExecutionWithThinkingResult {
  steps: AgentStepResult[];
  errors: string[];
  iterationCount: number;
  evaluations: EvaluationResult[];
  finalResult: string;
  success: boolean;
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
}
