import { z } from "zod";
import { ToolDefinition } from "./tool-registry.js";

const webSearchInput = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(5).default(3)
});

export const webSearchTool: ToolDefinition = {
  name: "webSearch",
  description: "Search public web content using DuckDuckGo instant answers.",
  inputSchema: {
    query: "string",
    limit: "1-5"
  },
  async run(input) {
    const parsed = webSearchInput.parse(input);
    const url = new URL("https://api.duckduckgo.com/");
    url.searchParams.set("q", parsed.query);
    url.searchParams.set("format", "json");
    url.searchParams.set("no_html", "1");
    url.searchParams.set("skip_disambig", "1");

    const response = await fetch(url);
    const data = await response.json() as { AbstractText?: string; RelatedTopics?: Array<{ Text?: string }> };
    const related = (data.RelatedTopics ?? []).slice(0, parsed.limit).map((entry) => entry.Text).filter(Boolean);

    return JSON.stringify({ abstract: data.AbstractText ?? "", results: related }, null, 2);
  }
};
