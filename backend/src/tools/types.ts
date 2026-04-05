import { MemoryService } from "../memory/memoryService.js";

export interface ToolContext {
  sessionId: string;
  memory: MemoryService;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, string>;
  run: (input: Record<string, unknown>, context: ToolContext) => Promise<string>;
}

export interface ToolRegistry {
  list(): ToolDefinition[];
  get(name: string): ToolDefinition | undefined;
  execute(name: string, input: Record<string, unknown>, context: ToolContext): Promise<string>;
}
