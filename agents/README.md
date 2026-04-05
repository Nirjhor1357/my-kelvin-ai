# Multi-Agent System Design

## Agents
- Planner Agent: converts a high-level goal into bounded executable steps.
- Executor Agent: selects one action per step, optionally invoking tools.
- Critic Agent: validates step outcomes and provides retry hints.
- Orchestrator: runs the control loop, enforces safeguards, tracks status.

## Communication Flow
1. User submits goal via `POST /api/goals/run`.
2. Orchestrator calls Planner to generate ordered steps.
3. For each step, Orchestrator calls Executor for an action decision.
4. If a tool is selected, Orchestrator executes the tool securely.
5. Orchestrator passes output to Critic for pass/fail verdict.
6. On fail, Orchestrator retries within configured retry budget.
7. On completion/failure/timeout, run is persisted to `task_runs` table.

## Failure and Retry Strategy
- Each step has `maxRetriesPerStep` attempts.
- Retry uses critic feedback as additional context.
- Loop halts early on timeout or token budget exhaustion.
- Final status values: `completed`, `failed`, `timeout`, `halted`.

## Safeguards
- Max steps per plan.
- Global timeout per run.
- Token budget enforcement.
- Tool allowlist validation.
