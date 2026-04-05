export type MemoryScope = "SESSION" | "USER" | "PROJECT" | "GLOBAL";

export type TaskStatus = "RUNNING" | "COMPLETED" | "FAILED" | "TIMEOUT" | "HALTED";

export interface AiPlanStep {
  id: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
  error?: string;
  retries: number;
}

export interface AiTaskRun {
  id: string;
  chatId: string;
  goal: string;
  status: TaskStatus;
  summary?: string | null;
  steps: AiPlanStep[];
  errors: string[];
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
