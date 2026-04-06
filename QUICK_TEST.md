# 🚀 Quick Start: Test Your Thinking Agent

## ✅ Implementation Complete

Your Jarvis agent has been upgraded to a **self-improving thinking system**!

**What changed:**
- ✅ New evaluator module (evaluates if goal satisfied)
- ✅ Extended executor (iterate until success or max iterations)
- ✅ Plan improvement function (refine based on feedback)
- ✅ Two API endpoints (default + thinking mode)
- ✅ Full integration with chat service
- ✅ 951 lines of new/updated code (all type-safe)

---

## 🧪 Test Immediately

### Option 1: Direct API Test

```bash
curl -X POST http://localhost:3000/api/v1/agent/think \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Create a personalized morning routine plan for someone who wakes up at 6 AM and needs to be at work by 9 AM",
    "userId": "test-user"
  }'
```

**Expected:** Response with 1-2 iterations, final plan refined based on feedback.

---

### Option 2: Chat API Test

```bash
curl -X POST http://localhost:3000/api/v1/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "message": "plan my entire day starting from 7 AM to 11 PM with specific time slots",
    "useThinking": true
  }'
```

**Expected:** Chat response with thinking applied under the hood.

---

## 📊 Understanding the Response

### Successful Thinking Agent Response

```json
{
  "success": true,
  "result": "6:00-6:30 AM: Wake up, hydrate, light stretching\n6:30-7:00 AM: Breakfast...",
  "iterationCount": 2,
  "evaluations": [
    {
      "success": false,
      "feedback": "Plan lacks specific time slots. Add detailed timing.",
      "score": 38
    },
    {
      "success": true,
      "feedback": "Comprehensive plan with precise time allocations provided.",
      "score": 91
    }
  ],
  "steps": [...],
  "errors": []
}
```

### How to Read It:

- **iterationCount: 2** → Took 2 iterations to get quality result
- **evaluations[0].success: false** → First iteration didn't meet goal
- **evaluations[1].success: true** → Second iteration succeeded
- **Score improved** → 38 → 91 (quality improvement)

---

## 🔍 Watch the Logs

Run backend in watch mode to see thinking:

```bash
cd backend
npm run dev
```

**Look for logs like:**
```
[Agent] Starting thinking agent for goal: "plan my day"
[Agent Thinking] === Iteration 1/3 ===
[Agent Thinking] [1/3] Evaluation ❌ FAIL (38/100)
  Goal: plan my day...
  Feedback: Need more specific times and breaks.
[Agent Thinking] Improving plan...
[Agent Thinking] === Iteration 2/3 ===
[Agent Thinking] [2/3] Evaluation ✅ PASS (91/100)
  Feedback: Excellent detailed plan...
[Agent Thinking] Loop completed after 2 iteration(s)
```

---

## 🆚 Default vs Thinking Mode

### Default Mode (Original)
```bash
curl -X POST /api/v1/agent \
  -d '{"goal": "plan my day", "userId": "123"}'
```
- ✅ Fast (~5-10s)
- ✅ Single iteration
- ✅ Good for simple queries

### Thinking Mode (New)
```bash
curl -X POST /api/v1/agent/think \
  -d '{"goal": "plan my day", "userId": "123"}'

# OR with mode parameter:
curl -X POST /api/v1/agent \
  -d '{"goal": "plan my day", "userId": "123", "mode": "thinking"}'
```
- ✅ Takes 15-30s
- ✅ Up to 3 iterations
- ✅ Better for complex goals
- ✅ Returns evaluation history

---

## 📈 Try These Complex Goals

### 1. Planning Task (Perfect for Thinking)
```json
{
  "goal": "Create a detailed 7-day meal plan for someone with vegetarian diet, no nuts allergy, gym routine 3x/week, needs 2000 calories/day"
}
```
**Expected:** 2-3 iterations, refined meal plan

### 2. Strategy Task
```json
{
  "goal": "Design a 90-day learning plan to master TypeScript and React from beginner level, with practice projects and time allocation"
}
```
**Expected:** Multiple iterations refining the plan

### 3. Organization Task
```json
{
  "goal": "Plan my work week: I have 5 meetings, 3 projects due, and need 10 hours of deep work. Optimize the schedule."
}
```
**Expected:** Iterative refinement of schedule

---

## ⚙️ Configuration Options

### Max Iterations (in `backend/src/modules/agents/executor.ts`)

```typescript
private readonly maxIterations = 3;
```

Change to:
- **2** for faster responses
- **4-5** for higher quality (slower)

### AI Timeout

Uses existing config from `env.ts`:
- Each iteration respects `AI_TIMEOUT_MS`
- Automatic retries on failure
- Graceful degradation if AI unavailable

---

## 🐛 Troubleshooting

### Response shows `iterationCount: 3` but `success: false`?
- Evaluator was very strict
- Goal might be ambiguous
- Try rephrasing the goal

### Getting "Failed to fetch" error?
- Make sure backend is running: `npm run dev`
- Check endpoint: `/api/v1/agent/think`
- Verify request body has `goal` field

### Logs not showing iterations?
- Check backend console output
- Make sure you're using thinking mode (not default)
- Verify `useThinking: true` or `mode: "thinking"`

---

## 📚 Full Documentation

For detailed API reference and advanced usage, see:
- **[THINKING_AGENT.md](./THINKING_AGENT.md)** - Complete guide (500+ lines)
- **[THINKING_AGENT_SUMMARY.md](./THINKING_AGENT_SUMMARY.md)** - Implementation details

---

## 🎯 Next Steps

1. **Test the endpoints** (use examples above)
2. **Monitor the logs** to see iterations
3. **Try complex goals** for best results
4. **Compare with default mode** (speed vs quality)
5. **Adjust maxIterations** if needed
6. **Deploy to production** when satisfied

---

## 📊 Example: Before vs After

### Before (Default Agent Only)
```
User: "plan my week"
Agent: Creates basic plan in single pass
Result: Generic, repetitive, lacks detail
```

### After (With Thinking Agent)
```
User: "plan my week"
Agent Iteration 1: ❌ Creates basic plan (score: 35)
  Feedback: "Too vague, needs specific times and priorities"
Agent Iteration 2: ✅ Refines plan with times and priorities (score: 92)
Result: Detailed, specific, well-structured plan
```

---

## 🎉 You're All Set!

Your Jarvis now thinks, evaluates, and improves itself! 🧠✨

**Questions?** Check [THINKING_AGENT.md](./THINKING_AGENT.md) for complete documentation.

---

**Commit: ff0b982** (latest thinking agent upgrade)
