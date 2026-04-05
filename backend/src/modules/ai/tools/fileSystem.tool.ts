import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { ToolDefinition } from "./tool-registry.js";

const fileSystemInput = z.object({
  action: z.enum(["readFile", "listDir"]),
  targetPath: z.string().min(1)
});

const WORKSPACE_ROOT = process.env.JARVIS_WORKSPACE_ROOT ?? process.cwd();

function safeResolve(targetPath: string): string {
  const resolved = path.resolve(WORKSPACE_ROOT, targetPath);
  if (!resolved.startsWith(path.resolve(WORKSPACE_ROOT))) {
    throw new Error("Path escapes the allowed workspace root");
  }

  return resolved;
}

export const fileSystemTool: ToolDefinition = {
  name: "fileSystem",
  description: "Read files or list directories within the allowed workspace root only.",
  inputSchema: {
    action: "readFile | listDir",
    targetPath: "relative path"
  },
  async run(input) {
    const parsed = fileSystemInput.parse(input);
    const resolved = safeResolve(parsed.targetPath);

    if (parsed.action === "listDir") {
      const entries = await fs.readdir(resolved);
      return JSON.stringify(entries, null, 2);
    }

    const content = await fs.readFile(resolved, "utf8");
    return content.slice(0, 8000);
  }
};
