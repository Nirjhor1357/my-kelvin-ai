import { randomUUID } from "node:crypto";
import { db } from "./sqliteStore.js";
import { createEmbedding } from "../llm/llmClient.js";
import { ChatMessage, TaskRun } from "../types.js";
import { MemoryVector, rankBySimilarity } from "./vectorStore.js";

interface RawMemoryRow {
  id: string;
  content: string;
  embedding: string;
  metadata: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class MemoryService {
  ensureSession(sessionId: string): void {
    const existing = db.prepare("SELECT id FROM sessions WHERE id = ?").get(sessionId) as { id: string } | undefined;
    const now = nowIso();

    if (!existing) {
      db.prepare("INSERT INTO sessions (id, created_at, updated_at) VALUES (?, ?, ?)").run(sessionId, now, now);
      return;
    }

    db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(now, sessionId);
  }

  addMessage(sessionId: string, message: ChatMessage): void {
    this.ensureSession(sessionId);
    db.prepare(
      "INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(randomUUID(), sessionId, message.role, message.content, nowIso());
  }

  getRecentMessages(sessionId: string, limit = 12): ChatMessage[] {
    this.ensureSession(sessionId);
    const rows = db
      .prepare("SELECT role, content, created_at FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?")
      .all(sessionId, limit) as Array<{ role: ChatMessage["role"]; content: string; created_at: string }>;

    return rows
      .reverse()
      .map((row) => ({ role: row.role, content: row.content, timestamp: row.created_at }));
  }

  async addLongTermMemory(input: {
    sessionId?: string;
    scope: "user" | "project" | "global";
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const id = randomUUID();
    const embedding = await createEmbedding(input.content);
    db.prepare(
      "INSERT INTO memories (id, session_id, scope, content, embedding, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(
      id,
      input.sessionId ?? null,
      input.scope,
      input.content,
      JSON.stringify(embedding),
      JSON.stringify(input.metadata ?? {}),
      nowIso()
    );

    return id;
  }

  async searchMemories(query: string, options?: { sessionId?: string; topK?: number }): Promise<MemoryVector[]> {
    const topK = options?.topK ?? 5;
    const queryEmbedding = await createEmbedding(query);

    const rows = options?.sessionId
      ? (db
          .prepare("SELECT id, content, embedding, metadata FROM memories WHERE session_id = ?")
          .all(options.sessionId) as RawMemoryRow[])
      : (db.prepare("SELECT id, content, embedding, metadata FROM memories").all() as RawMemoryRow[]);

    const vectors: MemoryVector[] = rows.map((row) => ({
      id: row.id,
      content: row.content,
      embedding: JSON.parse(row.embedding) as number[],
      metadata: JSON.parse(row.metadata) as Record<string, unknown>
    }));

    return rankBySimilarity(queryEmbedding, vectors, topK);
  }

  saveTaskRun(run: TaskRun): void {
    db.prepare(
      `INSERT OR REPLACE INTO task_runs
      (id, session_id, goal, status, steps_json, summary, errors_json, token_usage_json, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      run.taskId,
      run.sessionId,
      run.goal,
      run.status,
      JSON.stringify(run.steps),
      run.summary ?? null,
      JSON.stringify(run.errors),
      JSON.stringify(run.tokenUsage),
      run.startedAt,
      run.completedAt ?? null
    );
  }

  getTaskRun(taskId: string): TaskRun | null {
    const row = db
      .prepare("SELECT * FROM task_runs WHERE id = ?")
      .get(taskId) as
      | {
          id: string;
          session_id: string;
          goal: string;
          status: TaskRun["status"];
          steps_json: string;
          summary: string | null;
          errors_json: string;
          token_usage_json: string;
          started_at: string;
          completed_at: string | null;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      taskId: row.id,
      sessionId: row.session_id,
      goal: row.goal,
      status: row.status,
      steps: JSON.parse(row.steps_json),
      summary: row.summary ?? undefined,
      errors: JSON.parse(row.errors_json),
      tokenUsage: JSON.parse(row.token_usage_json),
      startedAt: row.started_at,
      completedAt: row.completed_at ?? undefined
    };
  }
}
