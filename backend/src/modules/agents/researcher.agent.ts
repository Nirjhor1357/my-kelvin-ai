import { AgentPlanStep } from "./planner.js";
import { AgentToolRegistry } from "./tools.js";

export interface ResearchItem {
  stepId: string;
  query: string;
  source: string;
  content: string;
}

export interface ResearcherAgentInput {
  goal: string;
  steps: AgentPlanStep[];
  userId?: string;
  chatId?: string;
}

export interface ResearcherAgentOutput {
  items: ResearchItem[];
  combinedData: string;
}

export class ResearcherAgent {
  constructor(private readonly tools: AgentToolRegistry) {}

  private collectQueries(step: AgentPlanStep): string[] {
    const queries: string[] = [];
    const payload = step.input ?? {};

    const maybePush = (value: unknown): void => {
      const normalized = String(value ?? "").trim();
      if (normalized) {
        queries.push(normalized);
      }
    };

    maybePush(payload.query);
    maybePush(payload.input);
    maybePush(payload.text);
    maybePush(payload.keyword);
    maybePush(payload.query2);
    maybePush(payload.query3);

    const keywords = payload.keywords;
    if (Array.isArray(keywords)) {
      for (const item of keywords) {
        maybePush(item);
      }
    }

    if (!queries.length) {
      maybePush(step.title);
    }

    return [...new Set(queries)].slice(0, 3);
  }

  async run(input: ResearcherAgentInput): Promise<ResearcherAgentOutput> {
    console.log("🔍 Researcher Agent running...");
    const items: ResearchItem[] = [];

    if (!this.tools.has("search")) {
      return {
        items,
        combinedData: "Search tool unavailable. No research data collected."
      };
    }

    const candidateQueries = input.steps
      .slice(0, 4)
      .flatMap((step) => this.collectQueries(step));

    if (!candidateQueries.length) {
      candidateQueries.push(input.goal);
    }

    for (const [index, query] of candidateQueries.entries()) {
      const stepId = input.steps[index]?.id ?? `research-${index + 1}`;

      try {
        const content = await this.tools.execute(
          "search",
          { query },
          { userId: input.userId, chatId: input.chatId, goal: input.goal }
        );

        items.push({
          stepId,
          query,
          source: "memory-search",
          content
        });
      } catch (error) {
        items.push({
          stepId,
          query,
          source: "memory-search",
          content: `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`
        });
      }
    }

    const combinedData = items
      .map((entry, idx) => `${idx + 1}. Query: ${entry.query}\n${entry.content}`)
      .join("\n\n");

    return {
      items,
      combinedData: combinedData || "No research results available."
    };
  }
}
