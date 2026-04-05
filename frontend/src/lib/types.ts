export type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

export type TaskRun = {
  id: string;
  chatId: string;
  goal: string;
  status: string;
  summary?: string | null;
  steps: Array<{ id: string; description: string; status: string; result?: string; error?: string; retries: number }>;
  errors: string[];
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
};

export type MemoryResult = {
  id: string;
  content: string;
  score?: number;
};

export type ChatResponse = {
  chat: { id: string; userId: string; title: string | null; summary: string | null; status: string };
  answer: string;
  retrievedMemories: MemoryResult[];
};
