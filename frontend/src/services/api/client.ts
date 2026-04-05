import { ChatResponse, MemoryResult, TaskRun } from "../../lib/types";

export interface JarvisClientOptions {
  baseUrl: string;
  versionPrefix?: string;
}

export class JarvisApiClient {
  private readonly root: string;
  private readonly timeoutMs: number;

  constructor(options: JarvisClientOptions) {
    this.root = `${options.baseUrl.replace(/\/$/, "")}${options.versionPrefix ?? "/api/v1"}`;
    this.timeoutMs = 20000;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const accessToken = typeof window !== "undefined" ? window.localStorage.getItem("jarvis_access_token") ?? "" : "";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("Request timed out"), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.root}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(init?.headers ?? {})
        }
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timed out for ${path}`);
      }

      throw new Error(`Network error for ${path}: ${(error as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`Request failed (${response.status}) for ${path}`);
    }

    return (await response.json()) as T;
  }

  async chat(input: { userId: string; chatId?: string; message: string; memoryTopK?: number }): Promise<ChatResponse> {
    return this.request<ChatResponse>("/chat/message", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  async runGoal(input: { userId: string; chatId: string; goal: string }): Promise<{ run: TaskRun }> {
    return this.request<{ run: TaskRun }>("/ai/goals/run", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  async searchMemory(input: { userId: string; query: string; topK?: number }): Promise<{ results: MemoryResult[] }> {
    const params = new URLSearchParams({ userId: input.userId, query: input.query, topK: String(input.topK ?? 5) });
    return this.request<{ results: MemoryResult[] }>(`/ai/memory/search?${params.toString()}`);
  }

  async health(): Promise<{ ok: boolean; version: string }> {
    return this.request<{ ok: boolean; version: string }>("/health");
  }
}

export function createJarvisClient(baseUrl: string, versionPrefix = process.env.NEXT_PUBLIC_API_VERSION ?? "/api/v1"): JarvisApiClient {
  return new JarvisApiClient({ baseUrl, versionPrefix });
}
