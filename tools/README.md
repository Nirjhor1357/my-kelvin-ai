# Tool Execution Framework

## Tool Contract
Each tool defines:
- `name`: unique identifier.
- `description`: semantic usage hint.
- `inputSchema`: expected parameters.
- `run(input, context)`: async executable handler.

## Security Model
- Allowlist only: unknown tools are blocked.
- Input validation with Zod.
- External HTTP limited to known hosts.
- No shell execution exposed by default.
- Memory write and search tools are scoped by session.

## Built-in Tools
- `time.now`
- `http.fetchJson`
- `memory.save`
- `memory.search`

## Extending Tools
1. Add new tool definition to backend tool list.
2. Validate inputs with strict schema.
3. Add rate limits, host restrictions, and audit logs for external side effects.
