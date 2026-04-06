import { completeJson, completeText } from "../../llm/llmClient.js";

export interface AgentPlanStep {
  id: string;
  title: string;
  tool?: string;
  input?: Record<string, unknown>;
}

function normalizePlan(raw: unknown): AgentPlanStep[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const mapped: Array<AgentPlanStep | null> = raw.map((step, index) => {
      if (!step || typeof step !== "object") {
        return null;
      }

      const payload = step as { title?: unknown; tool?: unknown; input?: unknown; description?: unknown };
      const title = String(payload.title ?? payload.description ?? "").trim();
      if (!title) {
        return null;
      }

      return {
        id: `step-${index + 1}`,
        title,
        tool: typeof payload.tool === "string" ? payload.tool : undefined,
        input: payload.input && typeof payload.input === "object" ? (payload.input as Record<string, unknown>) : undefined
      };
    });

  return mapped.filter((step): step is AgentPlanStep => step !== null);
}

export class AgentPlanner {
  async createPlan(input: { goal: string; memoryContext: string; availableTools: Array<{ name: string; description: string }> }): Promise<AgentPlanStep[]> {
    const system = [
      "You are Jarvis planner.",
      "Break goal into actionable steps.",
      "Return valid JSON array only.",
      "Each step: { title: string, tool?: string, input?: object }.",
      "Use tools only when helpful."
    ].join(" ");

    const prompt = [
      `Goal: ${input.goal}`,
      "",
      "Relevant context:",
      input.memoryContext || "None",
      "",
      "Available tools:",
      input.availableTools.map((tool) => `- ${tool.name}: ${tool.description}`).join("\n") || "None"
    ].join("\n");

    try {
      const structured = await completeJson<Array<{ title: string; tool?: string; input?: Record<string, unknown> }>>(prompt, system, 600);
      const normalized = normalizePlan(structured.content);
      if (normalized.length > 0) {
        return normalized;
      }
    } catch {
      // Fallback to text parsing below.
    }

    const fallback = await completeText(prompt, `${system} If JSON fails, return numbered plain-text steps.`, 500);
    const lines = fallback.content
      .split("\n")
      .map((line) => line.replace(/^\s*(\d+[\.)]|[-*])\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 8);

    if (!lines.length) {
      return [{ id: "step-1", title: `Analyze and execute goal: ${input.goal}` }];
    }

    return lines.map((title, index) => ({ id: `step-${index + 1}`, title }));
  }

  async improvePlan(input: {
    goal: string;
    currentSteps: AgentPlanStep[];
    feedback: string;
    availableTools: Array<{ name: string; description: string }>;
  }): Promise<AgentPlanStep[]> {
    const system = [
      "You are Jarvis plan improviser.",
      "Refine plan based on feedback from previous execution.",
      "Return valid JSON array only.",
      "Each step: { title: string, tool?: string, input?: object }.",
      "Keep successful steps, fix or replace failed ones."
    ].join(" ");

    const prompt = [
      `Original goal: ${input.goal}`,
      "",
      "Previous plan that needs improvement:",
      input.currentSteps.map((step) => `- ${step.title}`).join("\n"),
      "",
      "Evaluation feedback:",
      input.feedback,
      "",
      "Available tools:",
      input.availableTools.map((tool) => `- ${tool.name}: ${tool.description}`).join("\n") || "None",
      "",
      "Provide an improved plan addressing the feedback."
    ].join("\n");

    try {
      const structured = await completeJson<Array<{ title: string; tool?: string; input?: Record<string, unknown> }>>(
        prompt,
        system,
        600
      );
      const normalized = normalizePlan(structured.content);
      if (normalized.length > 0) {
        return normalized;
      }
    } catch {
      // Fallback to text parsing below
    }

    const fallback = await completeText(prompt, `${system} If JSON fails, return numbered plain-text steps.`, 500);
    const lines = fallback.content
      .split("\n")
      .map((line) => line.replace(/^\s*(\d+[\.)]|[-*])\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 8);

    if (!lines.length) {
      // If improvement fails, return original steps
      return input.currentSteps;
    }

    return lines.map((title, index) => ({ id: `step-${index + 1}`, title }));
  }
}
