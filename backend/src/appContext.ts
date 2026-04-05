import { MemoryService } from "./memory/memoryService.js";
import { Orchestrator } from "./agents/orchestrator.js";
import { ToolDefinition } from "./tools/types.js";

export interface AppContext {
  memory: MemoryService;
  orchestrator: Orchestrator;
  tools: ToolDefinition[];
}
