import { completeText } from "../../llm/llmClient.js";
import { prisma } from "../../lib/prisma.js";
import { AgentExecutor, AgentStepResult, ToolExecutionLog } from "./executor.js";
import { AgentOrchestrator } from "./orchestrator.js";
import { AgentPlanner } from "./planner.js";
import { AgentToolRegistry, defaultAgentTools } from "./tools.js";
import { MemoryService } from "../memory/memory.service.js";

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

export interface AgentResultWithTools {
  success: boolean;
  result: string;
  toolExecutions: ToolExecutionLog[];
  errors: string[];
  iterationCount: number;
}

export class AgentService {
  private readonly planner = new AgentPlanner();
  private readonly tools = new AgentToolRegistry(defaultAgentTools);
  private readonly executor = new AgentExecutor(this.tools);
  private readonly orchestrator = new AgentOrchestrator(this.planner, this.tools);
  private readonly memoryService = new MemoryService();

  private async buildMemoryContext(goal: string, userId?: string, chatId?: string): Promise<string> {
    const recentMessages = await prisma.message.findMany({
      where: chatId
        ? { chatId }
        : userId
          ? { chat: { userId } }
          : undefined,
      orderBy: { createdAt: "desc" },
      take: 12
    });

    const chatContext = recentMessages
      .reverse()
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join("\n");

    if (!userId) {
      return chatContext;
    }

    const relevantMemories = await this.memoryService.getRelevantMemories(userId, goal);
    const memoryBlock = this.memoryService.buildMemoryInjectionBlock(relevantMemories);
    return memoryBlock ? `${memoryBlock}\n\n${chatContext}` : chatContext;
  }

  async runAgent(goal: string, userId?: string, chatId?: string): Promise<AgentResult> {
    const task: AgentTask = {
      id: `agent-${Date.now()}`,
      goal,
      userId,
      chatId
    };

    const memoryContext = await this.buildMemoryContext(goal, userId, chatId);

    const orchestration = await this.orchestrator.run({
      goal,
      userId,
      chatId,
      memoryContext,
      availableTools: this.tools.list()
    });

    const finalResult = orchestration.stages.finalOutput || "Agent execution completed with no summary.";

    const memoryContent = [
      `Task: ${goal}`,
      `Result: ${finalResult}`,
      `Errors: ${orchestration.errors.length ? orchestration.errors.join("; ") : "None"}`
    ].join("\n");

    await prisma.memory.create({
      data: {
        userId,
        type: "goal",
        scope: "PROJECT",
        content: memoryContent,
        metadata: JSON.stringify({
          source: "agent-orchestrated",
          taskId: task.id,
          chatId: chatId ?? null,
          steps: orchestration.steps.map((step) => ({ id: step.id, status: step.status })),
          stageData: {
            planCount: orchestration.stages.plan.length,
            researchCount: orchestration.stages.research.length
          }
        })
      }
    });

    if (userId) {
      await this.memoryService.extractAndStoreLongTermMemories({
        userId,
        userMessage: goal,
        assistantMessage: finalResult
      });
    }

    return {
      success: orchestration.success,
      result: finalResult,
      steps: orchestration.steps,
      errors: orchestration.errors
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

  async runAgentWithTools(goal: string, userId?: string, chatId?: string): Promise<AgentResultWithTools> {
    const task: AgentTask = {
      id: `agent-tools-${Date.now()}`,
      goal,
      userId,
      chatId
    };

    console.log(`[Agent] Starting agentic tool execution for goal: "${goal}"`);

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

    const toolsExecution = await this.executor.executeWithTools({
      goal,
      userId,
      chatId,
      memoryContext,
      availableTools: this.tools.list()
    });

    // Store comprehensive memory record
    const toolUsageSummary = toolsExecution.toolExecutions
      .map((exec, index) => {
        if (exec.isFinal) {
          return `Final [${index + 1}]: ${exec.finalResult?.substring(0, 100)}...`;
        }
        return `Tool [${index + 1}] ${exec.toolName}: Input=${JSON.stringify(exec.toolInput)}, Output=${exec.toolOutput?.substring(0, 50)}...`;
      })
      .join("\n");

    const memoryContent = [
      `Task: ${goal}`,
      `Result: ${toolsExecution.result}`,
      `Method: Agentic Tool Execution`,
      `Iterations: ${toolsExecution.iterationCount}`,
      `Success: ${toolsExecution.success}`,
      `Errors: ${toolsExecution.errors.length ? toolsExecution.errors.join("; ") : "None"}`,
      `Tool Execution Timeline:`,
      toolUsageSummary
    ].join("\n");

    await prisma.memory.create({
      data: {
        userId,
        scope: "PROJECT",
        content: memoryContent,
        metadata: JSON.stringify({
          source: "agent-tools",
          taskId: task.id,
          chatId: chatId ?? null,
          iterationCount: toolsExecution.iterationCount,
          success: toolsExecution.success,
          toolsUsed: toolsExecution.toolExecutions
            .filter((t) => !t.isFinal && t.toolName)
            .map((t) => t.toolName)
        })
      }
    });

    return {
      success: toolsExecution.success,
      result: toolsExecution.result,
      toolExecutions: toolsExecution.toolExecutions,
      errors: toolsExecution.errors,
      iterationCount: toolsExecution.iterationCount
    };
  }
}
