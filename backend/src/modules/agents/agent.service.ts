import { completeText } from "../../llm/llmClient.js";
import { prisma } from "../../lib/prisma.js";
import { AgentExecutor, AgentStepResult, ExecutionWithThinkingResult } from "./executor.js";
import { AgentPlanner } from "./planner.js";
import { AgentToolRegistry, defaultAgentTools } from "./tools.js";

export interface AgentTask {
  id: string;
  goal: string;
  userId?: string;
  chatId?: string;
}

export interface AgentResult {
  success: boolean;
  result: string;
  steps: AgentStepResult[];
  errors: string[];
}

export interface AgentResultWithThinking extends AgentResult {
  iterationCount: number;
  evaluations: Array<{ success: boolean; feedback: string; score?: number }>;
}

export class AgentService {
  private readonly planner = new AgentPlanner();
  private readonly tools = new AgentToolRegistry(defaultAgentTools);
  private readonly executor = new AgentExecutor(this.tools);

  async runAgent(goal: string, userId?: string, chatId?: string): Promise<AgentResult> {
    const task: AgentTask = {
      id: `agent-${Date.now()}`,
      goal,
      userId,
      chatId
    };

    const recentMessages = await prisma.message.findMany({
      where: chatId
        ? { chatId }
        : userId
          ? { chat: { userId } }
          : undefined,
      orderBy: { createdAt: "desc" },
      take: 12
    });

    const memoryContext = recentMessages
      .reverse()
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join("\n");

    const steps = await this.planner.createPlan({
      goal,
      memoryContext,
      availableTools: this.tools.list()
    });

    const execution = await this.executor.execute({
      goal,
      userId,
      chatId,
      steps,
      memoryContext
    });

    const summaryPrompt = [
      `Goal: ${goal}`,
      "",
      "Execution results:",
      execution.steps
        .map((step) => `- ${step.title} [${step.status}]: ${step.output ?? step.error ?? "no output"}`)
        .join("\n")
    ].join("\n");

    const summary = await completeText(summaryPrompt, "You are Jarvis agent summarizer. Produce final concise outcome.", 500);
    const finalResult = summary.content || "Agent execution completed with no summary.";

    const memoryContent = [
      `Task: ${goal}`,
      `Result: ${finalResult}`,
      `Errors: ${execution.errors.length ? execution.errors.join("; ") : "None"}`
    ].join("\n");

    await prisma.memory.create({
      data: {
        userId,
        scope: "PROJECT",
        content: memoryContent,
        metadata: JSON.stringify({
          source: "agent",
          taskId: task.id,
          chatId: chatId ?? null,
          steps: execution.steps.map((step) => ({ id: step.id, status: step.status }))
        })
      }
    });

    return {
      success: execution.errors.length === 0,
      result: finalResult,
      steps: execution.steps,
      errors: execution.errors
    };
  }

  async runAgentWithThinking(goal: string, userId?: string, chatId?: string): Promise<AgentResultWithThinking> {
    const task: AgentTask = {
      id: `agent-thinking-${Date.now()}`,
      goal,
      userId,
      chatId
    };

    console.log(`[Agent] Starting thinking agent for goal: "${goal}"`);

    const recentMessages = await prisma.message.findMany({
      where: chatId
        ? { chatId }
        : userId
          ? { chat: { userId } }
          : undefined,
      orderBy: { createdAt: "desc" },
      take: 12
    });

    const memoryContext = recentMessages
      .reverse()
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join("\n");

    const steps = await this.planner.createPlan({
      goal,
      memoryContext,
      availableTools: this.tools.list()
    });

    const thinkingExecution = await this.executor.executeWithThinking({
      goal,
      userId,
      chatId,
      steps,
      memoryContext,
      availableTools: this.tools.list()
    });

    const summaryPrompt = [
      `Goal: ${goal}`,
      "",
      `Execution completed after ${thinkingExecution.iterationCount} iteration(s)`,
      "Execution results:",
      thinkingExecution.steps
        .map((step) => `- ${step.title} [${step.status}]: ${step.output ?? step.error ?? "no output"}`)
        .join("\n")
    ].join("\n");

    const summary = await completeText(
      summaryPrompt,
      "You are Jarvis agent summarizer. Produce final concise outcome. Mention that solution was found through iterative thinking.",
      500
    );
    const finalResult = summary.content || thinkingExecution.finalResult;

    const memoryContent = [
      `Task: ${goal}`,
      `Result: ${finalResult}`,
      `Iterations: ${thinkingExecution.iterationCount}`,
      `Success: ${thinkingExecution.success}`,
      `Errors: ${thinkingExecution.errors.length ? thinkingExecution.errors.join("; ") : "None"}`,
      `Evaluations:`,
      thinkingExecution.evaluations
        .map((e, i) => `  ${i + 1}. ${e.success ? "✅" : "❌"} Score: ${e.score}/100 - ${e.feedback.substring(0, 100)}...`)
        .join("\n")
    ].join("\n");

    await prisma.memory.create({
      data: {
        userId,
        scope: "PROJECT",
        content: memoryContent,
        metadata: JSON.stringify({
          source: "agent-thinking",
          taskId: task.id,
          chatId: chatId ?? null,
          iterationCount: thinkingExecution.iterationCount,
          success: thinkingExecution.success,
          steps: thinkingExecution.steps.map((step) => ({ id: step.id, status: step.status }))
        })
      }
    });

    return {
      success: thinkingExecution.success,
      result: finalResult,
      steps: thinkingExecution.steps,
      errors: thinkingExecution.errors,
      iterationCount: thinkingExecution.iterationCount,
      evaluations: thinkingExecution.evaluations.map((e) => ({
        success: e.success,
        feedback: e.feedback,
        score: e.score
      }))
    };
  }
}
