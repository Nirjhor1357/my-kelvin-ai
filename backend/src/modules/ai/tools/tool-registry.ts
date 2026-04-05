export interface ToolContext {
  userId?: string;
  chatId?: string;
  workingDirectory?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, string>;
  run: (input: Record<string, unknown>, context: ToolContext) => Promise<string>;
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  constructor(tools: ToolDefinition[]) {
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  async execute(name: string, input: Record<string, unknown>, context: ToolContext): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    return tool.run(input, context);
  }
}
