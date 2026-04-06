import { AgentPlanner, AgentPlanStep } from "./planner.js";

export interface PlannerAgentInput {
  goal: string;
  memoryContext: string;
  availableTools: Array<{ name: string; description: string }>;
}

export interface PlannerAgentOutput {
  steps: AgentPlanStep[];
}

export class PlannerAgent {
  constructor(private readonly planner: AgentPlanner) {}

  async run(input: PlannerAgentInput): Promise<PlannerAgentOutput> {
    const steps = await this.planner.createPlan({
      goal: input.goal,
      memoryContext: input.memoryContext,
      availableTools: input.availableTools
    });

    if (!steps.length) {
      return {
        steps: [{ id: "step-1", title: `Investigate and solve goal: ${input.goal}` }]
      };
    }

    return { steps };
  }
}
