# Jarvis

Production-oriented personal AI assistant platform with a modular backend, a feature-based Next.js dashboard, multi-agent orchestration, semantic memory, realtime events, and secure tool execution.

## Refactored Structure

- `frontend/` Next.js dashboard, feature modules, API client, Zustand store
- `backend/` Fastify API, Prisma data layer, auth/user/chat/ai modules
- `agents/` architecture notes for the agent loop
- `memory/` memory design and retrieval strategy
- `tools/` tool execution model and security notes
- `config/` runtime configuration examples

## Backend Architecture

Request flow:

`Request -> Route -> Controller -> Service -> AI / DB -> Response`

Domain modules:

- `backend/src/modules/auth`
- `backend/src/modules/user`
- `backend/src/modules/chat`
- `backend/src/modules/ai`
- `backend/src/modules/agents`

AI submodules:

- `agents/` Planner, Executor, Critic
- `memory/` short-term, long-term, vector retrieval
- `tools/` web search, calculator, file system sandbox
- `prompts/` system and chat prompts
- `llm/providers/` provider-agnostic adapters (Groq/OpenAI-compatible)

Versioned API:

- `GET /api/v1/health`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/me`
- `GET /api/v1/users/profile`
- `PATCH /api/v1/users/profile`
- `GET /api/v1/chat`
- `POST /api/v1/chat/message`
- `POST /api/v1/chat/message/stream`
- `GET /api/v1/chat/:chatId/messages`
- `POST /api/v1/agent`
- `POST /api/v1/ai/goals/run`
- `POST /api/v1/ai/goals/queue`
- `GET /api/v1/ai/goals/jobs/:jobId`
- `GET /api/v1/ai/tasks/:taskId`
- `POST /api/v1/ai/memory`
- `GET /api/v1/ai/memory/search`
- `GET /api/v1/flags`
- `PATCH /api/v1/flags/:key`

## Frontend Architecture

- `src/app/` shell and routing
- `src/components/` shared UI primitives
- `src/features/chat/` chat panel
- `src/features/tasks/` autonomous task dashboard
- `src/features/memory/` semantic memory viewer
- `src/features/settings/` endpoint and runtime controls
- `src/services/api/` typed API client
- `src/services/realtime/` Socket.IO client
- `src/lib/store/` Zustand app state

## Data Layer

Prisma schema models:

- `User`
- `Chat`
- `Message`
- `Memory`
- `RefreshToken`
- `FeatureFlag`
- `TaskRun`

Current persistence is SQLite for local dev and simple deployment. The schema is structured so it can be migrated to Postgres later without changing the domain modules.

## Local Development

Backend:

1. Copy `backend/.env.example` to `backend/.env`
2. Run `cd backend && npm install`
3. Run `npm run prisma:generate`
4. Run `npm run dev`

Frontend:

1. Copy `frontend/.env.example` to `frontend/.env.local`
2. Run `cd frontend && npm install`
3. Run `npm run dev`

## Deployment

Frontend:

- Deploy `frontend/` to Vercel
- Set `NEXT_PUBLIC_API_BASE_URL` to the backend URL

Backend:

- Deploy `backend/` to Railway or Render
- Build: `npm run build`
- Start: `npm run start`
- Mount persistent storage for the SQLite database or migrate to Postgres for scale

Recommended production variables:

- `NODE_ENV=production`
- `PORT=8080`
- `HOST=0.0.0.0`
- `CORS_ORIGIN=https://your-frontend.vercel.app`
- `JWT_SECRET` and `JWT_REFRESH_SECRET` with strong random values
- `AI_PROVIDER=groq` (or `openai`)
- `GROQ_API_KEY` or `OPENAI_API_KEY`
- `REDIS_URL` for queue/cache/rate-limit backing store
- `MAX_INPUT_CHARS=2000`
- `MAX_RESPONSE_BYTES=524288`
- `AI_TIMEOUT_MS=25000`
- `AI_MAX_RETRIES=2`

## Security

- Zod validation on all public inputs
- JWT access and refresh token issuance
- RBAC enforcement on admin and protected routes
- Rate limiting, helmet, cookie support, and CORS hardening
- Tool allowlists and workspace-path restrictions
- No arbitrary shell execution exposed by default

## Testing and Delivery

- Jest integration test for the versioned health route
- Jest unit test for a tool execution path
- Dockerfiles for frontend and backend
- GitHub Actions CI for typecheck, tests, lint, and builds

## PostgreSQL Backup Strategy

- Enable daily automatic snapshots in your managed Postgres provider.
- Configure PITR (point-in-time recovery) when available.
- Run periodic logical backups with `pg_dump` to object storage.
- Test restore workflow at least once per sprint in a staging database.

## Upgrade Plan

1. MVP hardening: keep the current SQLite + Prisma stack stable, add auth login UI, and tighten input validation.
2. Agent expansion: add richer tool routing, per-step tracing, and queue-backed goal execution.
3. Production scale: move to Postgres + Redis, add RBAC/feature flags, and split long-running jobs into workers.
4. Enterprise readiness: OpenTelemetry, Sentry alerts, audit logs, multi-tenant isolation, and integration plugins.

## Best Practices

- Keep request handlers thin; place logic in services.
- Treat AI calls as fallible dependencies and always budget retries/timeouts.
- Serialize memory and task traces explicitly; do not rely on implicit ORM shapes.
- Prefer typed clients for API boundaries on both frontend and backend.
- Keep tool execution constrained to allowlisted, observable operations.
