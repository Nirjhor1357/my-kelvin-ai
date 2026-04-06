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

  private hasEnoughContext(goal: string, memoryContext: string, input: MultiAgentInput): boolean {
    const normalizedGoal = goal.toLowerCase().trim();
    const normalizedMemory = memoryContext.toLowerCase();
    const mergedContext = `${normalizedGoal}\n${normalizedMemory}`;

    const hasClearGoal = normalizedGoal.length >= 8;
    const hasTimeConstraint = /\b\d+\s*(hours?|hrs?)\b|per\s*(day|week)|daily|weekly|night|morning|evening|time\s*block/.test(
      mergedContext
    );
    const hasSubjectConstraint = /subject|math|physics|chemistry|biology|english|coding|exam|topic/.test(mergedContext);
    const memoryFacts = (normalizedMemory.match(/- \(/g) || []).length;

    if (!hasClearGoal) {
      return false;
    }

    if (/study schedule|study plan|study routine/.test(normalizedGoal)) {
      return hasTimeConstraint || memoryFacts >= 1;
    }

    return hasTimeConstraint || hasSubjectConstraint || memoryFacts >= 1 || input.availableTools.length === 0;
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

  private applyDefaultAssumptions(goal: string, memoryContext: string, output: string): string {
    const normalizedGoal = goal.toLowerCase();
    const normalizedMemory = memoryContext.toLowerCase();

    if (/study schedule|study plan|study routine/.test(normalizedGoal)) {
      const hasDuration = /\b\d+\s*hours?\b|duration|study hours|typical duration/.test(normalizedMemory);
      const hasAssumption = /assuming/i.test(output);

      if (!hasDuration && !hasAssumption) {
        return `${output}\n\nAssuming 4-5 hours/day for now.`;
      }
    }

    return output;
  }

  private enforceDecisiveOutput(output: string): string {
    if (!output.trim()) {
      return output;
    }

    let normalized = output
      .replace(/please\s+confirm[^.?!]*[.?!]?/gi, "")
      .replace(/let\s+me\s+know\s+if\s+that\s+changed[^.?!]*[.?!]?/gi, "")
      .replace(/let\s+me\s+know\s+if\s+you\s+want[^.?!]*[.?!]?/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const sentences = normalized.split(/(?<=[.?!])\s+/);
    let questionCount = 0;

    normalized = sentences
      .map((sentence) => {
        if (!sentence.includes("?")) {
          return sentence;
        }

        questionCount += 1;
        if (questionCount === 1) {
          return sentence;
        }

        return sentence.replace(/\?/g, ".");
      })
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return normalized;
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
    const enoughContext = this.hasEnoughContext(input.goal, input.memoryContext, input);
    const partialContext = this.hasPartialContext(input.goal, input.memoryContext);

    console.log(`[Orchestrator] Context check: enough=${enoughContext}, partial=${partialContext}`);

    const plannerRan = !enoughContext;

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

      finalOutput = this.applyDefaultAssumptions(input.goal, input.memoryContext, finalOutput);
      finalOutput = this.enforceDecisiveOutput(finalOutput);
    } catch (error) {
      errors.push(`executionPipeline: ${error instanceof Error ? error.message : "Unknown pipeline error"}`);
      analysis = analysis || "Pipeline fallback used.";
      finalOutput = finalOutput || analysis || "No final output generated.";
      finalOutput = this.enforceDecisiveOutput(finalOutput);
    }

    const steps: AgentStepResult[] = [
      {
        id: "planner-agent",
        title: plannerRan ? "Planner agent produced execution plan" : "Planner agent skipped (direct execution mode)",
        status: plannerRan && errors.some((e) => e.startsWith("plannerAgent:")) ? "failed" : "completed",
        output: plannerRan
          ? plan.map((step) => step.title).join(" | ") || "No plan generated."
          : "Skipped because enough context was available.",
        error: plannerRan ? errors.find((e) => e.startsWith("plannerAgent:")) : undefined
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
