import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { env } from "../config/env.js";

function ensureDataDirectory(dbPath: string): void {
  const resolved = path.resolve(dbPath);
  const dir = path.dirname(resolved);
  fs.mkdirSync(dir, { recursive: true });
}

ensureDataDirectory(env.DATABASE_PATH);

export const db = new Database(env.DATABASE_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  scope TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding TEXT NOT NULL,
  metadata TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_runs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  goal TEXT NOT NULL,
  status TEXT NOT NULL,
  steps_json TEXT NOT NULL,
  summary TEXT,
  errors_json TEXT NOT NULL,
  token_usage_json TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope, created_at);
CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_task_runs_session ON task_runs(session_id, started_at);
`);
