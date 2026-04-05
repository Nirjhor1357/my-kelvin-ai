import { Queue, Worker } from "bullmq";
import { env } from "./env.js";
import { getRedis } from "./redis.js";

let goalQueue: Queue | null = null;

export function getGoalQueue(): Queue {
  if (!queueConfig.enabled) {
    throw new Error("Queue is disabled. Configure REDIS_URL to enable async goals.");
  }

  if (!goalQueue) {
    goalQueue = new Queue("jarvis-goals", {
      connection: getRedis()
    });
  }

  return goalQueue;
}

export function createQueueWorker<TInput, TOutput>(name: string, processor: (data: TInput) => Promise<TOutput>): Worker<TInput, TOutput> {
  if (!queueConfig.enabled) {
    throw new Error("Queue worker requested while queue is disabled.");
  }

  return new Worker<TInput, TOutput>(
    name,
    async (job) => processor(job.data),
    {
      connection: getRedis(),
      concurrency: 2
    }
  );
}

export const queueConfig = {
  enabled: env.REDIS_URL.length > 0
};
