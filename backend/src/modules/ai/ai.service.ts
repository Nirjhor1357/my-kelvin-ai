import { randomUUID } from "node:crypto";
import { completeText } from "../../llm/llmClient.js";
import { prisma } from "../../lib/prisma.js";
import { SYSTEM_PROMPT } from "./prompts/system.prompt.js";
import { CHAT_PROMPT } from "./prompts/chat.prompt.js";
import { PlannerAgent } from "./agents/planner.agent.js";
import { ExecutorAgent } from "./agents/executor.agent.js";
import { CriticAgent } from "./agents/critic.agent.js";
import { ShortTermMemory } from "./memory/shortTerm.memory.js";
import { LongTermMemory } from "./memory/longTerm.memory.js";
import { ToolRegistry } from "./tools/tool-registry.js";
import { aiTools } from "./tools/index.js";
import { AiTaskRun, MemoryScope } from "./ai.model.js";
import { emitRealtimeEvent } from "../../shared/realtime.js";
import { cacheService } from "../../shared/cache.js";

const planner = new PlannerAgent();
const executor = new ExecutorAgent();
const critic = new CriticAgent();
const shortTermMemory = new ShortTermMemory();
const longTermMemory = new LongTermMemory();
const toolRegistry = new ToolRegistry(aiTools);

function mergeUsage(
  aggregate: AiTaskRun["tokenUsage"],
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
): AiTaskRun["tokenUsage"] {
  return {
    promptTokens: aggregate.promptTokens + usage.promptTokens,
    completionTokens: aggregate.completionTokens + usage.completionTokens,
    totalTokens: aggregate.totalTokens + usage.totalTokens
  };
}

export class AIService {
  async createChatReply(input: { userId: string; chatId: string; message: string; memoryTopK?: number }): Promise<{ answer: string; retrievedMemories: Array<{ id: string; content: string; score: number }>; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
    const cacheNamespace = "chat-reply";
    const cacheLookup = `${input.userId}:${input.chatId}:${input.message.trim().toLowerCase()}`;
    const cached = await cacheService.getJson<{ answer: string; retrievedMemories: Array<{ id: string; content: string; score: number }>; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }>(cacheNamespace, cacheLookup);
    if (cached) {
      return cached;
    }

    await shortTermMemory.addMessage(input.chatId, "user", input.message);
    const recentMessages = await shortTermMemory.getRecentMessages(input.chatId, 12);
    const memories = await longTermMemory.vector.search({
      userId: input.userId,
      query: input.message,
      topK: input.memoryTopK ?? 4
    });

    const prompt = [
      CHAT_PROMPT,
      "",
      "System:",
      SYSTEM_PROMPT,
      "",
      "Recent messages:",
      recentMessages.map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`).join("\n") || "None",
      "",
      "Relevant memories:",
      memories.map((memory) => `[${memory.score.toFixed(3)}] ${memory.content}`).join("\n") || "None",
      "",
      "User:",
      input.message
    ].join("\n");

    const completion = await completeText(prompt, SYSTEM_PROMPT, 800);
    const answer = completion.content || "No response generated.";
    await shortTermMemory.addMessage(input.chatId, "assistant", answer);
    emitRealtimeEvent("chat:message", { chatId: input.chatId, userId: input.userId, answer });

    const payload = { answer, retrievedMemories: memories, usage: completion.usage };
    await cacheService.setJson(cacheNamespace, cacheLookup, payload, 180);

    return payload;
  }

  async runGoal(input: { userId: string; chatId: string; goal: string; limits?: { maxSteps?: number; maxRetriesPerStep?: number; timeoutMs?: number } }): Promise<AiTaskRun> {
    const taskId = randomUUID();
    const startedAt = new Date();
    const limits = {
      maxSteps: input.limits?.maxSteps ?? 8,
      maxRetriesPerStep: input.limits?.maxRetriesPerStep ?? 2,
      timeoutMs: input.limits?.timeoutMs ?? 90_000
    };

    await prisma.user.upsert({
      where: { id: input.userId },
      update: {},
      create: {
        id: input.userId,
        email: `${input.userId}@jarvis.local`,
        name: "Guest",
        passwordHash: "guest-session"
      }
    });

    await prisma.chat.upsert({
      where: { id: input.chatId },
      update: {},
      create: {
        id: input.chatId,
        userId: input.userId,
        title: input.goal.slice(0, 48)
      }
    });

    const run: AiTaskRun = {
      id: taskId,
      chatId: input.chatId,
      goal: input.goal,
      status: "RUNNING",
      steps: [],
      errors: [],
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      summary: null
    };

    const plan = await planner.createPlan(input.goal);
    run.tokenUsage = mergeUsage(run.tokenUsage, plan.usage);
    run.steps = plan.steps.slice(0, limits.maxSteps);
    const timeoutAt = Date.now() + limits.timeoutMs;

    for (const step of run.steps) {
      let completed = false;
      let previousResult = "";

      for (let attempt = 0; attempt <= limits.maxRetriesPerStep; attempt += 1) {
        step.status = "running";
        step.retries = attempt;

        if (Date.now() > timeoutAt) {
          run.status = "TIMEOUT";
          step.status = "failed";
          step.error = "Execution timeout exceeded";
          run.errors.push("Goal execution timed out");
          break;
        }

        try {
          const decision = await executor.decide({
            goal: input.goal,
            step: step.description,
            previousResult,
            availableTools: toolRegistry.list()
          });
          run.tokenUsage = mergeUsage(run.tokenUsage, decision.usage);

          let output = decision.decision.directResponse ?? "";
          if (decision.decision.tool && decision.decision.tool !== "none") {
            output = await toolRegistry.execute(decision.decision.tool, decision.decision.input ?? {}, {
              userId: input.userId,
              chatId: input.chatId
            });
          }

          const verdict = await critic.evaluate({ goal: input.goal, step: step.description, stepResult: output });
          run.tokenUsage = mergeUsage(run.tokenUsage, verdict.usage);

          if (verdict.verdict.pass) {
            step.status = "completed";
            step.result = output;
            completed = true;
            break;
          }

          previousResult = verdict.verdict.retryHint ? `${verdict.verdict.feedback}. Retry hint: ${verdict.verdict.retryHint}` : verdict.verdict.feedback;
          step.error = previousResult;
        } catch (error) {
          previousResult = error instanceof Error ? error.message : "Unknown execution error";
          step.error = previousResult;
        }
      }

      if (!completed) {
        step.status = "failed";
        if (run.status === "RUNNING") {
          run.status = "FAILED";
        }
        run.errors.push(`${step.description}: ${step.error ?? "unknown failure"}`);
      }
    }

    if (run.status === "RUNNING") {
      run.status = run.steps.length > 0 && run.steps.every((step) => step.status === "completed") ? "COMPLETED" : "FAILED";
    }

    run.summary = run.status === "COMPLETED" ? "Goal completed successfully" : `Goal ended with status ${run.status}. ${run.errors.length} issue(s) recorded.`;

    await prisma.taskRun.create({
      data: {
        id: taskId,
        chatId: input.chatId,
        goal: input.goal,
        status: run.status,
        stepsJson: JSON.stringify(run.steps),
        errorsJson: JSON.stringify(run.errors),
        tokenUsage: JSON.stringify(run.tokenUsage),
        summary: run.summary,
        completedAt: new Date()
      }
    });

    await longTermMemory.add({
      userId: input.userId,
      scope: "PROJECT",
      content: `Task ${taskId}: ${input.goal}. Status: ${run.status}. Summary: ${run.summary}`,
      metadata: { taskId, status: run.status }
    });

    await prisma.chat.update({
      where: { id: input.chatId },
      data: { summary: run.summary ?? undefined }
    });

    emitRealtimeEvent("task:update", { run });

    return run;
  }

  async saveMemory(input: { userId: string; scope: MemoryScope; content: string; metadata?: Record<string, unknown> }): Promise<string> {
    return longTermMemory.add(input);
  }

  async searchMemory(input: { userId: string; query: string; topK?: number }): Promise<Array<{ id: string; content: string; score: number }>> {
    return longTermMemory.vector.search(input);
  }

  async getTask(taskId: string): Promise<AiTaskRun | null> {
    const task = await prisma.taskRun.findUnique({ where: { id: taskId } });
    if (!task) {
      return null;
    }

    return {
      id: task.id,
      chatId: task.chatId,
      goal: task.goal,
      status: task.status as AiTaskRun["status"],
      summary: task.summary,
      steps: JSON.parse(task.stepsJson) as AiTaskRun["steps"],
      errors: JSON.parse(task.errorsJson) as string[],
      tokenUsage: JSON.parse(task.tokenUsage) as AiTaskRun["tokenUsage"]
    };
  }
}
