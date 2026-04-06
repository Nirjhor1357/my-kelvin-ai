import { completeJson, completeText } from "../../llm/llmClient.js";

export interface EvaluationResult {
  success: boolean;
  feedback: string;
  score?: number;
}

export class AgentEvaluator {
  async evaluate(input: {
    goal: string;
    result: string;
    previousAttempts?: number;
  }): Promise<EvaluationResult> {
    const prompt = [
      `Goal: ${input.goal}`,
      "",
      `Result to evaluate:`,
      `${input.result}`,
      "",
      "Evaluate if the result adequately addresses the goal.",
      "Consider:",
      "1. Does it directly answer the goal?",
      "2. Is it complete and actionable?",
      "3. Are there obvious gaps or issues?",
      "",
      "Respond with JSON:",
      "{",
      '  "success": boolean (true if result satisfies goal),',
      '  "score": number (0-100, confidence in success),',
      '  "feedback": string (specific, actionable feedback for improvement if not successful)',
      "}"
    ].join("\n");

    const system = "You are Jarvis evaluator. Assess if the result meets the goal. Be strict but fair. Return valid JSON only.";

    try {
      const evaluation = await completeJson<{ success: boolean; score?: number; feedback?: string }>(
        prompt,
        system,
        400
      );

      const data = evaluation.content;
      return {
        success: data.success === true,
        feedback: data.feedback || "No specific feedback provided",
        score: data.score ?? (data.success ? 90 : 40)
      };
    } catch (error) {
      // Fallback to text-based evaluation
      console.warn("[Evaluator] JSON parsing failed, falling back to text parsing:", error);

      const fallback = await completeText(
        prompt,
        `${system} If JSON fails, respond plain-text with YES/NO and feedback.`,
        400
      );

      const content = fallback.content.toLowerCase();
      const success = content.includes("yes") || content.includes("success") || content.includes("adequate");

      return {
        success,
        feedback: fallback.content,
        score: success ? 85 : 35
      };
    }
  }

  logEvaluation(
    iteration: number,
    goal: string,
    result: string,
    evaluation: EvaluationResult,
    maxIterations: number
  ): void {
    const status = evaluation.success ? "✅ PASS" : "❌ FAIL";
    const score = evaluation.score ? ` (${evaluation.score}/100)` : "";
    const progress = `[${iteration}/${maxIterations}]`;

    console.log(`\n[Agent Thinking] ${progress} Evaluation ${status}${score}`);
    console.log(`  Goal: ${goal.substring(0, 60)}...`);
    console.log(`  Result: ${result.substring(0, 80)}...`);
    console.log(`  Feedback: ${evaluation.feedback.substring(0, 100)}...`);
  }
}
