export type Role = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: Role;
  content: string;
  timestamp?: string;
}

export interface PlanStep {
  id: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
  error?: string;
  retries: number;
}

export interface Plan {
  goal: string;
  steps: PlanStep[];
  reasoning: string;
}

export interface AgentExecutionLimits {
  maxSteps: number;
  maxRetriesPerStep: number;
  timeoutMs: number;
  maxInputTokens: number;
  maxOutputTokens: number;
}

export interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  ok: boolean;
  output: string;
  data?: unknown;
}

export interface TaskRun {
  taskId: string;
  sessionId: string;
  goal: string;
  status: "running" | "completed" | "failed" | "timeout" | "halted";
  startedAt: string;
  completedAt?: string;
  steps: PlanStep[];
  summary?: string;
  errors: string[];
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
