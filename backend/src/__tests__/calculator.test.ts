import { calculatorTool } from "../modules/ai/tools/calculator.tool.js";

describe("calculator tool", () => {
  it("evaluates safe arithmetic", async () => {
    const result = await calculatorTool.run({ expression: "2 + 3 * 4" }, {});
    expect(result).toBe("14");
  });
});
