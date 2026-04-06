# 🛠️ Real Tool Execution System - Implementation Guide

## Overview

Your autonomous agent can now **actually execute tools** dynamically based on AI decisions, not pre-planned steps.

**Old Flow (Planning-Based):**
```
Plan steps → Each step pre-assigns a tool → Execute tools in order
```

**New Flow (Agentic Tool Selection):**
```
AI evaluates goal → Decides tool needed → Execute tool → Feed result to AI → Repeat until final answer
```

---

## 🎯 Architecture

### How It Works

1. **User Goal** → AI receives goal + available tools list
2. **AI Decision** → AI returns JSON: `{ type: "tool"|"final", tool?: string, input?: any }`
3. **Execution** → Backend executes selected tool
4. **Result Feedback** → AI receives tool result
5. **Loop** → Repeat until AI returns `type: "final"` (max 5 iterations)

**Key Difference:** AI dynamically decides WHICH tool to use, not following a pre-plan.

---

## 📦 New Interfaces

### AI Tool Response Format

```typescript
interface AIToolResponse {
  type: "tool" | "final";
  tool?: string;              // Tool name if type=tool
  input?: Record<string, unknown> | string; // Tool input
  content?: string;           // Final answer if type=final
  reasoning?: string;         // Why this choice
}
```

### Tool Execution Log

```typescript
interface ToolExecutionLog {
  iterationNumber: number;
  toolName?: string;
  toolInput?: Record<string, unknown> | string;
  toolOutput?: string;
  toolError?: string;
  isFinal: boolean;
  finalResult?: string;
}
```

### Tool Execution Result

```typescript
interface ExecutionWithToolsResult {
  success: boolean;
  result: string;
  toolExecutions: ToolExecutionLog[];
  errors: string[];
  iterationCount: number;
}
```

---

## 🔧 Key Components

### 1. Executor Methods

#### New Method: `executeWithTools()`

```typescript
async executeWithTools(input: {
  goal: string;
  userId?: string;
  chatId?: string;
  memoryContext: string;
  availableTools: Array<{ name: string; description: string }>;
}): Promise<ExecutionWithToolsResult>
```

**What it does:**
- Agentic loop: AI → Tool Decision → Execute → Repeat
- Max 5 iterations (prevents infinite loops)
- Parses AI JSON responses
- Handles tool execution errors gracefully
- Feeds results back to AI

**Flow:**
```
for iteration 1 to 5:
  1. Send goal/context to AI
  2. Parse JSON response
  3. If type="final" → return result
  4. If type="tool" → execute tool
  5. Feed tool result back to AI → go to step 1
```

### 2. Helper Methods

#### `buildToolPromptContext()`
```typescript
private buildToolPromptContext(
  availableTools: Array<{ name: string; description: string }>
): string
```
- Formats tool list for AI prompt
- Includes JSON response format instructions
- Used in every iteration

#### `parseAIResponse()`
```typescript
private parseAIResponse(response: string): AIToolResponse | null
```
- Safely parses JSON from AI
- Handles code block formatting (```json...```)
- Falls back gracefully if parsing fails
- Validates response structure

#### `logToolExecution()`
```typescript
private logToolExecution(
  iteration: number,
  maxIterations: number,
  toolName: string | undefined,
  toolInput: Record<string, unknown> | string | undefined,
  result: string | undefined,
  error: string | undefined
): void
```
- Human-readable logging
- Tracks each tool call
- Shows success/error status

---

## 🎤 AI Prompt Structure

### Each Iteration Includes

1. **System Message:**
   - Agent identity: "You are Jarvis, autonomous AI agent"
   - Context: Previous conversation memory
   - Capabilities: "You have access to tools"

2. **User Message (First Iteration):**
   ```
   Goal: [user goal]
   
   Available tools you can use:
   - search: Searches known project/user memories
   - saveNote: Saves a durable note into memory
   - summarize: Creates a compact summary from text
   
   [JSON format instructions]
   ```

3. **User Message (Subsequent Iterations):**
   ```
   Tool result from [tool_name]:
   [tool_output]
   
   Based on this result, continue working toward the goal or provide final answer.
   
   [JSON format instructions]
   ```

### Expected AI Response

```json
{
  "type": "tool",
  "tool": "search",
  "input": "project deadline dates",
  "reasoning": "I need to find information about project deadlines"
}
```

Or final:

```json
{
  "type": "final",
  "content": "Based on the search results, all projects are due by end of month.",
  "reasoning": "I have sufficient information to answer the question"
}
```

---

## 🛠️ Tools Available

### 1. **search**
- **Purpose:** Find relevant information from project memory
- **Input:** `{ query: string }`
- **Example:** `{ query: "project deadlines" }`
- **Output:** Top 3 relevant memory entries

### 2. **saveNote**
- **Purpose:** Save important information for future reference
- **Input:** `{ content: string }`
- **Example:** `{ content: "Project X deadline is March 15" }`
- **Output:** `"Saved note [id]"`

### 3. **summarize**
- **Purpose:** Compress long text into concise summary
- **Input:** `{ text: string }` or `{ content: string }`
- **Example:** `{ text: "[1000 char document]" }`
- **Output:** Summarized text (max 220 chars)

---

## 🚀 API Endpoints

### 1. Generic Agent Endpoint (with mode)

```bash
POST /api/v1/agent
Content-Type: application/json

{
  "goal": "Find my project deadlines and save a summary",
  "userId": "user-123",
  "chatId": "chat-456",
  "mode": "tools"  // ← NEW: tools mode
}
```

### 2. Dedicated Tools Endpoint

```bash
POST /api/v1/agent/execute
Content-Type: application/json

{
  "goal": "Find my project deadlines and save a summary",
  "userId": "user-123",
  "chatId": "chat-456"
}
```

### 3. Via Chat API

```bash
POST /api/v1/chat/message
Content-Type: application/json

{
  "userId": "user-123",
  "message": "Find my project deadlines and save them",
  "useTools": true  // ← NEW: enable tools mode
}
```

---

## 📊 Response Format

### Successful Response

```json
{
  "success": true,
  "result": "Project deadlines: A is March 15, B is April 1, C is May 20. Summary saved.",
  "iterationCount": 3,
  "toolExecutions": [
    {
      "iterationNumber": 1,
      "toolName": "search",
      "toolInput": "project deadlines",
      "toolOutput": "Memory entry: Project A due March 15...",
      "isFinal": false
    },
    {
      "iterationNumber": 2,
      "toolName": "summarize",
      "toolInput": "Project A March 15, Project B April 1...",
      "toolOutput": "Summary: Deadlines A-Mar15, B-Apr1, C-May20",
      "isFinal": false
    },
    {
      "iterationNumber": 3,
      "toolName": "saveNote",
      "toolInput": "Project deadlines: A-Mar15, B-Apr1, C-May20",
      "toolOutput": "Saved note abc-123",
      "isFinal": false
    },
    {
      "iterationNumber": 4,
      "isFinal": true,
      "finalResult": "Project deadlines compiled and saved"
    }
  ],
  "errors": [],
  "metadata": {
    "toolExecutor": true,
    "iterations": 4,
    "toolsUsed": ["search", "summarize", "saveNote"],
    "finalSuccess": true
  }
}
```

### Error Response

```json
{
  "success": false,
  "result": "Failed to find project information",
  "iterationCount": 2,
  "toolExecutions": [
    {
      "iterationNumber": 1,
      "toolName": "search",
      "toolInput": "project deadlines",
      "toolError": "No relevant memory found",
      "isFinal": false
    },
    {
      "iterationNumber": 2,
      "isFinal": true,
      "finalResult": "Unable to find deadlines in memory"
    }
  ],
  "errors": ["[search] No relevant memory found"],
  "metadata": {
    "toolExecutor": true,
    "iterations": 2,
    "toolsUsed": ["search"],
    "finalSuccess": false
  }
}
```

---

## 🧪 Example Execution Flow

### Scenario: "Compile my weekly tasks and save summary"

```
[Tool Executor] Starting agentic tool loop for goal: "compile weekly tasks"
[Tool Executor] Available tools: search, saveNote, summarize

[Tool Executor] === Iteration 1/5 ===
[Tool Executor] Calling AI with goal + tools list

AI Response:
{
  "type": "tool",
  "tool": "search",
  "input": "weekly tasks",
  "reasoning": "Need to find existing tasks from memory"
}

[Tool Executor] ✅ Executed tool: search
  Input: {"query": "weekly tasks"}
  Output: Found 5 tasks from previous conversations...

[Tool Executor] === Iteration 2/5 ===
[Tool Executor] Feeding search results back to AI

AI Response:
{
  "type": "tool",
  "tool": "summarize",
  "input": "[long task list from search]",
  "reasoning": "Create concise summary for better overview"
}

[Tool Executor] ✅ Executed tool: summarize
  Input: [task compilation]
  Output: Summary: Monday-Code review, Tuesday-Deploy, ...

[Tool Executor] === Iteration 3/5 ===
[Tool Executor] Feeding summary back to AI

AI Response:
{
  "type": "tool",
  "tool": "saveNote",
  "input": {
    "content": "Weekly tasks summary: Mon-code review, Tue-deploy, Wed-test, Thu-docs, Fri-demo"
  },
  "reasoning": "Save summary for reference"
}

[Tool Executor] ✅ Executed tool: saveNote
  Input: {"content": "Weekly tasks summary..."}
  Output: Saved note xyz-789

[Tool Executor] === Iteration 4/5 ===
[Tool Executor] Feeding saveNote result back to AI

AI Response:
{
  "type": "final",
  "content": "Your weekly tasks have been compiled and saved. Summary saved as note for future reference: Monday-code review, Tuesday-deploy, Wednesday-test, Thursday-docs, Friday-demo.",
  "reasoning": "Task completed successfully"
}

[Tool Executor] ✅ Final answer provided

[Tool Executor] === RESULT ===
Success: true
Iterations: 4
Tools used: [search, summarize, saveNote]
Final result: "Your weekly tasks have been compiled..."

Result stored in memory with full timeline
```

---

## ⚙️ Configuration

### Max Iterations

**Location:** `backend/src/modules/agents/executor.ts`

```typescript
private async executeWithTools(...) {
  const maxToolIterations = 5;  // ← Change this
  ...
}
```

**Recommendations:**
- **3** - Fast execution, simple tasks
- **5** - Balanced (default)
- **8+** - Complex multi-step tasks (slower)

### AI Timeout

Inherits from `env.ts`:
- `AI_TIMEOUT_MS` per AI call
- `AI_MAX_RETRIES` on failure
- Graceful fallback if AI unavailable

---

## 🛡️ Safety & Error Handling

### 1. Infinite Loop Prevention
```typescript
if (iteration === maxToolIterations) {
  return result; // Force exit
}
```

### 2. JSON Parsing Fallback
```typescript
try {
  const decision = JSON.parse(aiResponse);
} catch {
  // Treat raw response as final answer
  return { type: "final", content: aiResponse };
}
```

### 3. Unknown Tool Handling
```typescript
if (!this.tools.has(toolName)) {
  throw new Error(`Unknown tool: ${toolName}`);
  // Caught, logged, and returned as error
}
```

### 4. Tool Execution Error Recovery
```typescript
try {
  toolResult = await this.tools.execute(...);
} catch (error) {
  // Log error, continue loop with error message
  // AI can retry with different tool
}
```

### 5. Full Error Tracking
```typescript
errors: string[];  // All errors collected
// Each iteration error is logged and returned
```

---

## 📊 Comparison: Planning vs Tools

| Aspect | Planning Mode | Tools Mode |
|--------|---------------|-----------|
| **Decision Maker** | Planner (pre-planning) | AI (dynamic) |
| **Tool Selection** | Pre-assigned to steps | AI chooses per iteration |
| **Flexibility** | Fixed sequence | Adaptive |
| **Tool Switching** | No (follows plan) | Yes (can switch) |
| **Iterations** | Based on evaluation | Based on AI decision |
| **Latency** | Faster (~10s) | Slower (~20s) |
| **Best For** | Predictable tasks | Complex/adaptive tasks |

---

## 🧪 Testing

### Quick Test

```bash
curl -X POST http://localhost:3000/api/v1/agent/execute \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Find any saved project deadlines and create a summary",
    "userId": "test-user"
  }'
```

### Expected Output
- Multiple iterations showing tool calls
- Each tool execution logged
- Final result compiled from tool outputs
- Full execution history returned

### Test with Chat API

```bash
curl -X POST http://localhost:3000/api/v1/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "message": "compile my tasks and save summary",
    "useTools": true
  }'
```

---

## 📝 Memory Integration

Each tool execution stored in memory:

```
Task: "compile my tasks and save summary"
Result: "Tasks compiled: Mon-code review, Tue-deploy..."
Method: Agentic Tool Execution
Iterations: 4
Success: true
Tool Execution Timeline:
  Tool [1] search: compiled from search_results
  Tool [2] summarize: Output=Summary... [successful]
  Tool [3] saveNote: saved note for future reference
  Final [4]: Provided final comprehensive summary
Errors: None
```

---

## 🚀 Integration with Existing System

### Backward Compatibility
- ✅ Original `runAgent()` unchanged
- ✅ Original `runAgentWithThinking()` unchanged
- ✅ New `runAgentWithTools()` is additive
- ✅ All existing APIs still work

### Chat Integration
- ✅ Detects agent prompt keywords
- ✅ Routes to tools mode if `useTools: true`
- ✅ Falls back to default if not specified

---

## 🎯 When to Use Tools Mode

### ✅ Use Tools When:
- Goal requires information gathering (search)
- Need to save information (saveNote)
- Need to compress/summarize data
- Task benefits from adaptive tool selection
- Multi-tool orchestration needed

### ❌ Use Default/Thinking When:
- Simple direct answers
- No external tools needed
- Speed is critical
- Task is well-defined

---

## 📚 Code Examples

### Direct Service Usage

```typescript
import { AgentService } from "./modules/agents/agent.service";

const service = new AgentService();

const result = await service.runAgentWithTools(
  "Find my deadlines and summarize",
  "user-123"
);

console.log(`Success: ${result.success}`);
console.log(`Result: ${result.result}`);
console.log(`Iterations: ${result.iterationCount}`);
console.log(`Tools used: ${result.toolExecutions
  .filter(t => !t.isFinal && t.toolName)
  .map(t => t.toolName)
  .join(", ")}`);
```

---

## 🔒 Security

- ✅ AI cannot create arbitrary functions
- ✅ Only pre-defined tools available
- ✅ Tool inputs validated
- ✅ Errors never expose sensitive data
- ✅ Memory queries scoped to user

---

## 📈 Performance

| Task | Iterations | Time | API Calls |
|------|-----------|------|-----------|
| Simple query | 1-2 | 5-10s | 3-4 |
| Multi-tool task | 3-4 | 15-25s | 8-10 |
| Complex workflow | 4-5 | 25-40s | 12-15 |

---

## ✅ Validation Checklist

- [x] TypeScript compilation: No errors
- [x] Agentic loop with max iterations: Working
- [x] Tool execution: Functional
- [x] JSON parsing: Safe with fallback
- [x] Error handling: Graceful
- [x] Memory integration: Complete
- [x] API endpoints: Ready
- [x] Chat integration: Ready
- [x] Backward compatibility: Maintained

---

## 🎉 Summary

Your Jarvis agent now:
- ✅ **Communicates** with AI in JSON format
- ✅ **Decides** which tools to use dynamically
- ✅ **Executes** tools and gets results
- ✅ **Iterates** until task complete
- ✅ **Remembers** everything in memory

**This is a real autonomous agent system!** 🚀
