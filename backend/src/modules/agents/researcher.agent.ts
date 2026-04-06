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
    const payload = (step.input ?? {}) as Record<string, unknown>;
    const stepLevel = step as AgentPlanStep & { query?: unknown };

    const maybePush = (value: unknown): void => {
      const normalized = String(value ?? "").trim();
      if (normalized) {
        queries.push(normalized);
      }
    };

    // Priority 1: step.input.query
    maybePush(payload.query);

    // Multi-query support from planner payload
    maybePush(payload.query2);
    maybePush(payload.query3);

    // Priority 2: step.input.keywords (joined) + variants
    const keywords = payload.keywords;
    if (Array.isArray(keywords)) {
      const normalizedKeywords = keywords.map((item) => String(item ?? "").trim()).filter(Boolean);
      if (normalizedKeywords.length) {
        maybePush(normalizedKeywords.join(" "));
      }
      for (const item of keywords) {
        maybePush(item);
      }
    }

    // Priority 3: step.query
    maybePush(stepLevel.query);

    // Priority 4: fallback to title
    if (!queries.length) {
      maybePush(step.title);
    }

    return [...new Set(queries)].slice(0, 5);
  }

  private buildQueryPlan(steps: AgentPlanStep[]): Array<{ stepId: string; query: string }> {
    const plan: Array<{ stepId: string; query: string }> = [];

    for (const step of steps.slice(0, 4)) {
      for (const query of this.collectQueries(step)) {
        plan.push({ stepId: step.id, query });
      }
    }

    return plan;
  }

  private dedupeAndRank(items: ResearchItem[], goal: string): ResearchItem[] {
    const seen = new Set<string>();
    const goalTerms = goal
      .toLowerCase()
      .split(/\W+/)
      .filter((term) => term.length > 2);

    const unique = items.filter((item) => {
      const key = `${item.query.toLowerCase()}::${item.content.toLowerCase().slice(0, 300)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    const ranked = unique
      .map((item) => {
        const contentLower = item.content.toLowerCase();
        const queryLower = item.query.toLowerCase();
        const score = goalTerms.reduce((acc, term) => {
          return acc + (contentLower.includes(term) ? 2 : 0) + (queryLower.includes(term) ? 1 : 0);
        }, 0);
        return { item, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((entry) => entry.item);

    return ranked;
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

    const queryPlan = this.buildQueryPlan(input.steps);

    if (!queryPlan.length) {
      queryPlan.push({ stepId: "research-fallback", query: input.goal });
    }

    console.log(`[Researcher] Final queries: ${queryPlan.map((entry) => entry.query).join(" | ")}`);

    for (const [index, entry] of queryPlan.entries()) {
      const stepId = entry.stepId || `research-${index + 1}`;
      const query = entry.query;

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

    const merged = this.dedupeAndRank(items, input.goal);
    console.log(`[Researcher] Results collected: ${items.length}, after dedupe/rank: ${merged.length}`);

    const combinedData = merged
      .map((entry, idx) => `${idx + 1}. Query: ${entry.query}\n${entry.content}`)
      .join("\n\n");

    return {
      items: merged,
      combinedData: combinedData || "No research results available."
    };
  }
}
