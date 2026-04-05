import { getGoalQueue, createQueueWorker, queueConfig } from "../../shared/queue.js";
import { AIService } from "./ai.service.js";

interface GoalJobInput {
  userId: string;
  chatId: string;
  goal: string;
  limits?: {
    maxSteps?: number;
    maxRetriesPerStep?: number;
    timeoutMs?: number;
  };
}

const aiService = new AIService();
let workerStarted = false;

export function startGoalWorker(): void {
  if (workerStarted || !queueConfig.enabled) {
    return;
  }

  createQueueWorker<GoalJobInput, Awaited<ReturnType<AIService["runGoal"]>>>("jarvis-goals", async (data) => {
    return aiService.runGoal(data);
  });

  workerStarted = true;
}

export async function enqueueGoalJob(input: GoalJobInput): Promise<string> {
  if (!queueConfig.enabled) {
    throw new Error("Queue is disabled");
  }

  const job = await getGoalQueue().add("run-goal", input, {
    removeOnComplete: 200,
    removeOnFail: 200,
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 1000
    }
  });

  return job.id ?? "";
}

export async function getGoalJobStatus(jobId: string): Promise<{
  id: string;
  state: string;
  progress: number;
  returnValue?: unknown;
  failedReason?: string;
}> {
  if (!queueConfig.enabled) {
    throw new Error("Queue is disabled");
  }

  const job = await getGoalQueue().getJob(jobId);
  if (!job) {
    throw new Error("Job not found");
  }

  const state = await job.getState();
  return {
    id: job.id ?? jobId,
    state,
    progress: typeof job.progress === "number" ? job.progress : 0,
    returnValue: job.returnvalue,
    failedReason: job.failedReason
  };
}
