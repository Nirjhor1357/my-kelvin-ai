import { z } from "zod";
import { ToolDefinition } from "./tool-registry.js";

const calculatorInput = z.object({
  expression: z.string().min(1)
});

function safeMath(expression: string): number {
  if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
    throw new Error("Invalid math expression");
  }

  // Controlled arithmetic only; inputs are restricted to digits and operators.
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${expression});`)();
}

export const calculatorTool: ToolDefinition = {
  name: "calculator",
  description: "Evaluate safe arithmetic expressions.",
  inputSchema: { expression: "string arithmetic" },
  async run(input) {
    const parsed = calculatorInput.parse(input);
    return String(safeMath(parsed.expression));
  }
};
