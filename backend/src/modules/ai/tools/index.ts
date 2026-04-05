import { calculatorTool } from "./calculator.tool.js";
import { fileSystemTool } from "./fileSystem.tool.js";
import { webSearchTool } from "./webSearch.tool.js";
import { ToolDefinition } from "./tool-registry.js";

export const aiTools: ToolDefinition[] = [webSearchTool, calculatorTool, fileSystemTool];
