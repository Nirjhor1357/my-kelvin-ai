# Memory System Design

## Memory Types
- Short-term memory: recent chat turns from `messages` table by `session_id`.
- Long-term memory: durable semantic entries in `memories` table.
- Vector retrieval: embedding similarity ranking with cosine similarity.

## Storage Schema
- `sessions`: lifecycle container for user interactions.
- `messages`: chronological chat context.
- `memories`: semantic records with embeddings and metadata JSON.
- `task_runs`: persisted autonomous execution traces.

## Retrieval Strategy
1. Build embedding for current query.
2. Fetch candidate memory rows for session/global scope.
3. Rank by cosine similarity.
4. Inject top-k memory snippets into prompt context.

## Context Injection Pattern
- Prompt includes:
  - Conversation history (recent messages)
  - Top-k memory snippets
  - Current user objective
- Memory budget is bounded via top-k and content truncation.
