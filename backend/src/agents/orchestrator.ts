import { randomUUID } from "node:crypto";
import { AgentExecutionLimits, TaskRun } from "../types.js";
import { MemoryService } from "../memory/memoryService.js";
import { InMemoryToolRegistry } from "../tools/registry.js";
import { ToolDefinition } from "../tools/types.js";
import { PlannerAgent } from "./plannerAgent.js";
import { ExecutorAgent } from "./executorAgent.js";
import { CriticAgent } from "./criticAgent.js";

const DEFAULT_LIMITS: AgentExecutionLimits = {
  maxSteps: 8,
  maxRetriesPerStep: 2,
  timeoutMs: 90_000,
  maxInputTokens: 6000,
  maxOutputTokens: 1500
};

function mergeUsage(
  aggregate: TaskRun["tokenUsage"],
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
): TaskRun["tokenUsage"] {
  return {
    promptTokens: aggregate.promptTokens + usage.promptTokens,
    completionTokens: aggregate.completionTokens + usage.completionTokens,
    totalTokens: aggregate.totalTokens + usage.totalTokens
  };
}

export class Orchestrator {
  private readonly planner = new PlannerAgent();
  private readonly executor = new ExecutorAgent();
  private readonly critic = new CriticAgent();
  private readonly toolRegistry: InMemoryToolRegistry;

  constructor(private readonly memory: MemoryService, tools: ToolDefinition[]) {
    this.toolRegistry = new InMemoryToolRegistry(tools);
  }

  async runGoal(input: {
    sessionId: string;
    goal: string;
    limits?: Partial<AgentExecutionLimits>;
  }): Promise<TaskRun> {
    const limits = { ...DEFAULT_LIMITS, ...input.limits };
    const startedAt = new Date().toISOString();
    const taskId = randomUUID();

    const run: TaskRun = {
      taskId,
      sessionId: input.sessionId,
      goal: input.goal,
      status: "running",
      startedAt,
      steps: [],
      errors: [],
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    };

    const timeoutAt = Date.now() + limits.timeoutMs;
    const planResult = await this.planner.createPlan(input.goal);
    run.tokenUsage = mergeUsage(run.tokenUsage, planResult.usage);
    run.steps = planResult.plan.steps.slice(0, limits.maxSteps);

    for (const step of run.steps) {
      if (Date.now() > timeoutAt) {
        step.status = "failed";
        step.error = "Execution timeout exceeded";
        run.status = "timeout";
        run.errors.push("Timeout while processing plan steps");
        break;
      }

      if (run.tokenUsage.totalTokens > limits.maxInputTokens + limits.maxOutputTokens) {
        step.status = "failed";
        step.error = "Token budget exceeded";
        run.status = "halted";
        run.errors.push("Token budget exceeded");
        break;
      }

      let stepCompleted = false;
      let lastResult = "";

      for (let attempt = 0; attempt <= limits.maxRetriesPerStep; attempt += 1) {
        step.status = "running";
        step.retries = attempt;

        try {
          const decisionResult = await this.executor.decide({
            goal: input.goal,
            step: step.description,
            previousResult: lastResult,
            availableTools: this.toolRegistry.list()
          });
          run.tokenUsage = mergeUsage(run.tokenUsage, decisionResult.usage);

          const decision = decisionResult.decision;
          let executionOutput = decision.directResponse ?? "";

          if (decision.tool && decision.tool !== "none") {
            executionOutput = await this.toolRegistry.execute(decision.tool, decision.input ?? {}, {
              sessionId: input.sessionId,
              memory: this.memory
            });
          }

          const criticResult = await this.critic.evaluate({
            goal: input.goal,
            step: step.description,
            stepResult: executionOutput
          });
          run.tokenUsage = mergeUsage(run.tokenUsage, criticResult.usage);

          if (criticResult.verdict.pass) {
            step.status = "completed";
            step.result = executionOutput;
            stepCompleted = true;
            break;
          }

          lastResult = `Critic feedback: ${criticResult.verdict.feedback}. Retry hint: ${criticResult.verdict.retryHint ?? "none"}`;
          step.error = lastResult;
        } catch (error) {
          lastResult = (error as Error).message;
          step.error = lastResult;
        }
      }

      if (!stepCompleted) {
        step.status = "failed";
        run.errors.push(`Step failed: ${step.description} - ${step.error ?? "unknown"}`);
      }
    }

    const allCompleted = run.steps.length > 0 && run.steps.every((step) => step.status === "completed");
    if (run.status === "running") {
      run.status = allCompleted ? "completed" : "failed";
    }

    run.summary = allCompleted
      ? "Goal completed successfully"
      : `Goal ended with status ${run.status}. ${run.errors.length} issue(s) recorded.`;
    run.completedAt = new Date().toISOString();

    this.memory.saveTaskRun(run);
    await this.memory.addLongTermMemory({
      sessionId: input.sessionId,
      scope: "project",
      content: `Task ${taskId}: ${input.goal}. Status: ${run.status}. Summary: ${run.summary}`,
      metadata: { taskId, status: run.status }
    });

    return run;
  }
}
