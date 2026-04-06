# 🧠 Jarvis Thinking Agent System

## Overview

The Jarvis Thinking Agent is an **iterative self-improving AI system** that evaluates its own outputs and refines them until they meet quality standards or reach maximum iterations.

**Flow:**
```
Plan → Execute → Evaluate → Improve → Repeat (max 3 iterations)
```

---

## 🎯 Key Features

### 1. **Self-Evaluation**
- After execution, the evaluator assesses: _"Does the result satisfy the goal?"_
- Returns JSON: `{ success: boolean, feedback: string, score: 0-100 }`
- Intelligent fallback: if JSON parsing fails, uses text-based evaluation

### 2. **Iterative Improvement**
- If evaluation fails, the planner refines the plan based on feedback
- New plan is executed in the next iteration
- Process repeats until: success OR max iterations reached

### 3. **Safety Built-In**
- **Max iterations: 3** (prevents infinite loops)
- Graceful failure fallback (returns last known state)
- Full error tracking and logging
- Memory integration for learning

### 4. **Production-Ready**
- No breaking changes to existing APIs
- Backward compatible with `runAgent()`
- Clean debug logging for observability
- Structured response format

---

## 📦 Implementation Details

### New Files Created

#### 1. `backend/src/modules/agents/evaluator.ts`
```typescript
class AgentEvaluator {
  async evaluate(input: {
    goal: string;
    result: string;
    previousAttempts?: number;
  }): Promise<EvaluationResult>;
  
  logEvaluation(...): void;
}
```

**Responsibilities:**
- Uses AI to evaluate if result meets goal
- Provides specific, actionable feedback
- Handles JSON parsing failures gracefully
- Returns confidence score (0-100)

**Example Output:**
```json
{
  "success": false,
  "feedback": "Plan misses user email specification. Add step to retrieve email field.",
  "score": 42
}
```

---

### Modified Files

#### 2. `backend/src/modules/agents/executor.ts` (Enhanced)

**New Types:**
```typescript
interface ExecutionWithThinkingResult {
  steps: AgentStepResult[];
  errors: string[];
  iterationCount: number;
  evaluations: EvaluationResult[];
  finalResult: string;
  success: boolean;
}
```

**New Method:**
```typescript
async executeWithThinking(input: {
  goal: string;
  userId?: string;
  chatId?: string;
  steps: AgentPlanStep[];
  memoryContext: string;
  availableTools: Array<{ name: string; description: string }>;
}): Promise<ExecutionWithThinkingResult>
```

**Algorithm:**
```
for iteration 1 to MAX_ITERATIONS:
  1. Execute current plan
  2. Evaluate result
    - If success OR last iteration → return
    - Else → improve plan and continue
  3. Log iteration progress
return final result
```

**Original `execute()` method remains unchanged** (backward compatible).

---

#### 3. `backend/src/modules/agents/planner.ts` (Extended)

**New Method:**
```typescript
async improvePlan(input: {
  goal: string;
  currentSteps: AgentPlanStep[];
  feedback: string;
  availableTools: Array<{ name: string; description: string }>;
}): Promise<AgentPlanStep[]>
```

**Process:**
- Takes failed plan + feedback
- Uses AI to generate improved steps
- Returns new plan or fallback to original if parsing fails
- Typical outcome: 5-8 refined steps

---

#### 4. `backend/src/modules/agents/agent.service.ts` (Extended)

**New Types:**
```typescript
interface AgentResultWithThinking extends AgentResult {
  iterationCount: number;
  evaluations: Array<{
    success: boolean;
    feedback: string;
    score?: number;
  }>;
}
```

**New Method:**
```typescript
async runAgentWithThinking(
  goal: string,
  userId?: string,
  chatId?: string
): Promise<AgentResultWithThinking>
```

**Features:**
- Full iteration tracking
- Memory integration (stores all evaluations)
- Detailed logging for debugging
- Graceful error handling

**Example Output:**
```json
{
  "success": true,
  "result": "Completed task after iterative refinement...",
  "steps": [...],
  "errors": [],
  "iterationCount": 2,
  "evaluations": [
    {
      "success": false,
      "feedback": "Plan was too vague...",
      "score": 35
    },
    {
      "success": true,
      "feedback": "Detailed and complete now",
      "score": 92
    }
  ]
}
```

---

#### 5. `backend/src/api/v1/agent.routes.ts` (Updated)

**New Endpoints:**
- `POST /api/v1/agent` with `mode: "thinking"` param
- `POST /api/v1/agent/think` (dedicated thinking endpoint)

**Request:**
```json
{
  "goal": "Plan my day",
  "userId": "user-123",
  "chatId": "chat-456",
  "mode": "thinking"  // optional, defaults to "default"
}
```

**Response:**
```json
{
  "success": true,
  "result": "Here's your day plan...",
  "steps": [...],
  "errors": [],
  "iterationCount": 2,
  "evaluations": [...]
}
```

---

## 🚀 Usage Examples

### 1. **Direct Agent API (Thinking Mode)**

```bash
curl -X POST http://localhost:3000/api/v1/agent/think \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Plan my week as a software engineer",
    "userId": "dev-user"
  }'
```

**Response:**
```json
{
  "success": true,
  "result": "Monday: Code review + bug fixes...",
  "iterationCount": 1,
  "evaluations": [{
    "success": true,
    "feedback": "Comprehensive weekly plan provided",
    "score": 88
  }],
  "metadata": {
    "thinking": true,
    "iterations": 1
  }
}
```

---

### 2. **Through Chat API with Thinking**

```bash
curl -X POST http://localhost:3000/api/v1/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "message": "plan a 3-day trip to London",
    "useThinking": true
  }'
```

**Response:**
```json
{
  "chat": {
    "id": "chat-789",
    "userId": "user-123",
    "title": "plan a 3-day trip to London",
    "status": "active"
  },
  "answer": "Here's your 3-day London itinerary: Day 1: Big Ben and House of Parliament...",
  "retrievedMemories": []
}
```

The evaluation loop runs transparently; user sees final refined result.

---

### 3. **Fallback to Default Agent**

```bash
# No "thinking" mode = uses default agent (single iteration)
curl -X POST http://localhost:3000/api/v1/agent \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Summarize my recent messages",
    "userId": "user-123"
  }'
```

---

## 🔍 Logging & Observability

### Console Output Example

```
[Agent] Starting thinking agent for goal: "plan my morning routine"

[Agent Thinking] === Iteration 1/3 ===

[Agent Thinking] [1/3] Evaluation ❌ FAIL (42/100)
  Goal: plan my morning routine
  Result: Wake up early...
  Feedback: Plan is too generic. Add specific times and include exercise.

[Agent Thinking] Improving plan based on feedback...
[Agent Thinking] Plan improved with 7 steps for next iteration

[Agent Thinking] === Iteration 2/3 ===

[Agent Thinking] [2/3] Evaluation ✅ PASS (88/100)
  Goal: plan my morning routine
  Result: 6:00 AM: Wake and hydrate...
  Feedback: Detailed, specific time-based plan provided. Excellent!

[Agent Thinking] Loop completed after 2 iteration(s)
```

---

## 💾 Memory Integration

Each thinking agent run stores detailed memory:

```json
{
  "content": "Task: plan my day\nResult: Morning: emails and standup...\nIterations: 2\nSuccess: true\nEvaluations:\n  1. ❌ Score: 35/100 - Too vague...\n  2. ✅ Score: 88/100 - Detailed...",
  "metadata": {
    "source": "agent-thinking",
    "iterationCount": 2,
    "success": true,
    "steps": [...],
    "evaluations": [...]
  }
}
```

**Benefits:**
- Tracks agent reasoning over time
- Enables learning from previous failures
- Audit trail for debugging
- Contextual memory for future tasks

---

## ⚙️ Configuration

### Max Iterations
Defined in `executor.ts`:
```typescript
private readonly maxIterations = 3;
```

**To change:** Update `executor.ts` const
- **Min:** 1 (single pass, no improvement)
- **Recommended:** 2-3 (balance quality vs speed)
- **Max:** 5+ (for complex goals)

---

### AI Timeout & Retries
Uses existing config from `env.ts`:
- `AI_TIMEOUT_MS`: Wait time per AI call
- `AI_MAX_RETRIES`: Retry count on failure
- `AI_FALLBACK_MESSAGE`: Message if AI unavailable

---

## 🛡️ Safety Guarantees

### 1. **Infinite Loop Prevention**
```typescript
for (let iteration = 1; iteration <= this.maxIterations; iteration++) {
  // Force exit at max iterations
  if (iteration === this.maxIterations) return;
}
```

### 2. **Graceful Degradation**
- If evaluation fails → use last known state
- If improvement fails → retry with original plan
- If AI unavailable → fallback to completion

### 3. **Error Tracking**
```typescript
evaluations: EvaluationResult[],  // Track all evaluations
errors: string[],                 // Collect step errors
success: boolean                  // Final success flag
```

---

## 🔄 Comparison: Default vs Thinking Agent

| Aspect | Default Agent | Thinking Agent |
|--------|---------------|----------------|
| **Flow** | Plan → Execute → Done | Plan → Execute → Evaluate → Improve → Repeat |
| **Quality** | Single pass | Iteratively refined |
| **Latency** | Fast (~5-10s) | Slower (~15-30s) |
| **API** | `POST /api/v1/agent` | `POST /api/v1/agent/think` |
| **Best For** | Simple tasks | Complex planning tasks |
| **Iterations** | 1 | Up to 3 |
| **Max API Calls** | 3-4 | 8-12 |

---

## 🎓 When to Use Thinking Agent

**Use Thinking Mode When:**
- ✅ Planning complex multi-step tasks
- ✅ Goal is ambiguous or detailed
- ✅ Quality > latency
- ✅ User needs refined output

**Use Default Mode When:**
- ✅ Simple factual queries
- ✅ Real-time responsiveness critical
- ✅ Task is well-defined
- ✅ Quick answers acceptable

---

## 🧪 Testing

### Unit Test Example
```typescript
it("should improve plan on evaluation failure", async () => {
  const executor = new AgentExecutor(mockTools);
  const result = await executor.executeWithThinking({
    goal: "plan my week",
    steps: initialSteps,
    memoryContext: "...",
    availableTools: mockTools.list()
  });

  expect(result.iterationCount).toBe(2);
  expect(result.success).toBe(true);
  expect(result.evaluations[0].success).toBe(false); // First iteration failed
  expect(result.evaluations[1].success).toBe(true);  // Second iteration passed
});
```

---

## 🐛 Troubleshooting

### Issue: Stuck in Loop?
**Check:** iterationCount in response
- If = 3, max iterations reached
- Increase `maxIterations` in `executor.ts`

### Issue: Evaluation Always Fails?
**Check:** Prompt clarity and available tools
- Evaluator may be too strict
- Adjust feedback in evaluator prompt

### Issue: Slow Response?
**Solutions:**
- Use default agent instead (less iterations)
- Reduce `maxIterations` to 2
- Check AI provider latency

---

## 📝 API Reference

### `POST /api/v1/agent/think`

**Request:**
```typescript
{
  goal: string;           // Task to execute
  userId?: string;        // User context
  chatId?: string;        // Chat context (for memory)
}
```

**Response:**
```typescript
{
  success: boolean;
  result: string;
  steps: AgentStepResult[];
  errors: string[];
  iterationCount: number;
  evaluations: Array<{
    success: boolean;
    feedback: string;
    score?: number;
  }>;
  metadata: {
    thinking: boolean;
    iterations: number;
    finalSuccess: boolean;
    allStepsCount: number;
  };
}
```

---

## 🎉 Next Steps

1. **Test thinking agent** with complex planning tasks
2. **Monitor logs** to see iteration progress
3. **Adjust `maxIterations`** based on latency/quality tradeoff
4. **Add thinking mode toggle** to frontend if desired
5. **Gather metrics** on improvement rates and user satisfaction

---

**Enjoy your self-improving Jarvis agent!** 🚀
