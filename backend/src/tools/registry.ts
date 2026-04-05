import { ToolDefinition, ToolRegistry, ToolContext } from "./types.js";

export class InMemoryToolRegistry implements ToolRegistry {
  private readonly tools: Map<string, ToolDefinition>;

  constructor(toolList: ToolDefinition[]) {
    this.tools = new Map(toolList.map((tool) => [tool.name, tool]));
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  async execute(name: string, input: Record<string, unknown>, context: ToolContext): Promise<string> {
    const tool = this.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    return tool.run(input, context);
  }
}
