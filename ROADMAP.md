# Jarvis Roadmap

## Current State

Completed foundation includes:

- Workspace split into `backend/` and `frontend/`
- Multi-agent runtime (`planner`, `researcher`, `reasoning`, `writer`)
- Orchestrator dual-mode routing (direct execution vs planner fallback)
- Persistent memory extraction and retrieval
- Tool execution flow with safety constraints
- Next.js dashboard with chat, tasks, memory, and settings views

## Phase 1: Product Hardening

- Strengthen auth UX in frontend (register/login/session lifecycle)
- Add route-level audit logging for sensitive operations
- Expand integration tests for chat, memory, and agent flows
- Standardize error envelopes across all API modules

## Phase 2: Agent Quality

- Add scoring metrics for plan quality and response usefulness
- Implement deterministic fallback templates for common goals
- Add richer tool selection telemetry and replay traces
- Improve memory conflict resolution and confidence weighting

## Phase 3: Scale Readiness

- Migrate persistence from SQLite to Postgres
- Run Redis-backed queues in dedicated worker process
- Introduce idempotency keys for long-running task APIs
- Add OpenTelemetry traces and dashboard alerts

## Phase 4: Enterprise Readiness

- Multi-tenant isolation model with scoped memory partitions
- Fine-grained RBAC and policy controls
- Immutable audit trails for tool side effects
- SSO/SAML integration and org-level admin controls

## Definition of Done (Near-Term)

- Stable production deploys for backend and frontend
- End-to-end tests passing in CI
- Mean response latency and failure budgets tracked
- Clear operator docs for rollback and incident response
