import { AgentStepResult } from "./executor.js";
import { AgentPlanStep, AgentPlanner } from "./planner.js";
import { PlannerAgent } from "./planner.agent.js";
import { ResearcherAgent, ResearchItem } from "./researcher.agent.js";
import { ReasoningAgent } from "./reasoning.agent.js";
import { WriterAgent } from "./writer.agent.js";
import { AgentToolRegistry } from "./tools.js";

export interface MultiAgentInput {
  goal: string;
  memoryContext: string;
  availableTools: Array<{ name: string; description: string }>;
  userId?: string;
  chatId?: string;
}

export interface MultiAgentStageOutputs {
  plan: AgentPlanStep[];
  research: ResearchItem[];
  analysis: string;
  finalOutput: string;
}

export interface MultiAgentResult {
  success: boolean;
  errors: string[];
  stages: MultiAgentStageOutputs;
  steps: AgentStepResult[];
}

export class AgentOrchestrator {
  private readonly plannerAgent: PlannerAgent;
  private readonly researcherAgent: ResearcherAgent;
  private readonly reasoningAgent = new ReasoningAgent();
  private readonly writerAgent = new WriterAgent();

  private hasEnoughContext(goal: string, memoryContext: string): boolean {
    const normalizedGoal = goal.toLowerCase();
    const normalizedMemory = memoryContext.toLowerCase();

    const hasStudyPreference = /study best at|study preference|night|morning|evening/.test(normalizedMemory);
    const hasStudyDuration = /\b\d+\s*hours?\b|duration|study hours|typical duration/.test(normalizedMemory);

    if (/study schedule|study plan|study routine/.test(normalizedGoal)) {
      return hasStudyPreference || (hasStudyPreference && hasStudyDuration);
    }

    const memoryFacts = (normalizedMemory.match(/- \(/g) || []).length;
    return memoryFacts >= 2;
  }

  private hasPartialContext(goal: string, memoryContext: string): boolean {
    const normalizedGoal = goal.toLowerCase();
    const normalizedMemory = memoryContext.toLowerCase();

    if (/study schedule|study plan|study routine/.test(normalizedGoal)) {
      const hasStudyPreference = /study best at|study preference|night|morning|evening/.test(normalizedMemory);
      const hasStudyDuration = /\b\d+\s*hours?\b|duration|study hours|typical duration/.test(normalizedMemory);
      return hasStudyPreference !== hasStudyDuration;
    }

    return false;
  }

  private buildMemoryDrivenPlan(goal: string, memoryContext: string): AgentPlanStep[] {
    const memoryHints = memoryContext
      .split("\n")
      .filter((line) => line.trim().startsWith("- ("))
      .slice(0, 5)
      .join(" | ");

    return [
      {
        id: "step-1",
        title: "Derive execution constraints from user memory",
        input: { goal, memoryHints }
      },
      {
        id: "step-2",
        title: "Generate action-oriented plan using known preferences",
        input: { memoryDriven: true }
      },
      {
        id: "step-3",
        title: "Produce practical schedule with concrete time blocks",
        input: { format: "timetable" }
      },
      {
        id: "step-4",
        title: "Add adaptive note for changes without blocking execution",
        input: { softConfirmation: true }
      }
    ];
  }

  constructor(planner: AgentPlanner, tools: AgentToolRegistry) {
    this.plannerAgent = new PlannerAgent(planner);
    this.researcherAgent = new ResearcherAgent(tools);
  }

  async run(input: MultiAgentInput): Promise<MultiAgentResult> {
    console.log("[Orchestrator] Multi-agent flow started");
    const errors: string[] = [];
    let plan: AgentPlanStep[] = [];
    let research: ResearchItem[] = [];
    let analysis = "";
    let finalOutput = "";
    const enoughContext = this.hasEnoughContext(input.goal, input.memoryContext);
    const partialContext = this.hasPartialContext(input.goal, input.memoryContext);

    console.log(`[Orchestrator] Context check: enough=${enoughContext}, partial=${partialContext}`);

    if (enoughContext) {
      console.log("[Orchestrator] Using memory-driven direct plan (skip planner questioning)");
      plan = this.buildMemoryDrivenPlan(input.goal, input.memoryContext);
      console.log("PLAN:", plan);
    } else {
      try {
        const planned = await this.plannerAgent.run({
          goal: input.goal,
          memoryContext: input.memoryContext,
          availableTools: input.availableTools
        });
        plan = planned.steps;
        console.log("PLAN:", plan);
      } catch (error) {
        errors.push(`plannerAgent: ${error instanceof Error ? error.message : "Unknown planning error"}`);
        plan = [{ id: "step-1", title: `Handle goal directly: ${input.goal}` }];
        console.log("PLAN:", plan);
      }
    }

    try {
      const researched = await this.researcherAgent.run({
        goal: input.goal,
        steps: plan,
        userId: input.userId,
        chatId: input.chatId
      });
      research = researched.items;
      console.log("DATA:", research);

      const reasoned = await this.reasoningAgent.run({
        goal: input.goal,
        steps: plan,
        researchItems: researched.items,
        researchData: researched.combinedData,
        memoryContext: input.memoryContext
      });
      analysis = reasoned.analysis;
      console.log("ANALYSIS:", analysis);

      const written = await this.writerAgent.run({
        goal: input.goal,
        steps: plan,
        analysis: reasoned.analysis,
        keyInsights: reasoned.keyInsights,
        memoryContext: input.memoryContext
      });
      finalOutput = written.content;

      if (partialContext) {
        finalOutput = [
          finalOutput,
          "",
          "If your available study duration has changed recently, tell me once and I will fine-tune this plan."
        ].join("\n");
      }
    } catch (error) {
      errors.push(`executionPipeline: ${error instanceof Error ? error.message : "Unknown pipeline error"}`);
      analysis = analysis || "Pipeline fallback used.";
      finalOutput = finalOutput || analysis || "No final output generated.";
    }

    const steps: AgentStepResult[] = [
      {
        id: "planner-agent",
        title: "Planner agent produced execution plan",
        status: errors.some((e) => e.startsWith("plannerAgent:")) ? "failed" : "completed",
        output: plan.map((step) => step.title).join(" | ") || "No plan generated.",
        error: errors.find((e) => e.startsWith("plannerAgent:"))
      },
      {
        id: "researcher-agent",
        title: "Researcher agent gathered data",
        status: research.length > 0 ? "completed" : "failed",
        tool: "search",
        output: research.map((entry) => `${entry.query}: ${entry.content.slice(0, 80)}`).join(" | ") || "No research data.",
        error: research.length === 0 ? "No research results collected." : undefined
      },
      {
        id: "reasoning-agent",
        title: "Reasoning agent analyzed research",
        status: analysis ? "completed" : "failed",
        output: analysis || "No analysis generated.",
        error: analysis ? undefined : "Reasoning stage failed."
      },
      {
        id: "writer-agent",
        title: "Writer agent generated final output",
        status: finalOutput ? "completed" : "failed",
        output: finalOutput || "No final output generated.",
        error: finalOutput ? undefined : "Writer stage failed."
      }
    ];

    return {
      success: !!finalOutput,
      errors,
      stages: {
        plan,
        research,
        analysis,
        finalOutput: finalOutput || "No final output generated."
      },
      steps
    };
  }
}
