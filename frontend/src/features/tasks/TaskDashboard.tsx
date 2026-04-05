"use client";

import { useState } from "react";
import { JarvisApiClient } from "../../services/api/client";
import { useJarvisStore } from "../../lib/store/useJarvisStore";
import { SectionCard } from "../../components/SectionCard";

export function TaskDashboard({ client }: { client: JarvisApiClient }) {
  const [goal, setGoal] = useState("Build a daily coding plan and persist it to memory");
  const sessionId = useJarvisStore((state) => state.sessionId);
  const chatId = useJarvisStore((state) => state.chatId);
  const busy = useJarvisStore((state) => state.busy);
  const setBusy = useJarvisStore((state) => state.setBusy);
  const taskRun = useJarvisStore((state) => state.taskRun);
  const setTaskRun = useJarvisStore((state) => state.setTaskRun);
  const pushLog = useJarvisStore((state) => state.pushLog);

  async function runGoal(): Promise<void> {
    setBusy(true);
    pushLog("Starting autonomous run");

    try {
      const response = await client.runGoal({ userId: sessionId, chatId: chatId || sessionId, goal });
      setTaskRun(response.run);
      pushLog(`Goal completed with status ${response.run.status}`);
    } catch (error) {
      pushLog(`Goal run failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      title="Autonomous Task Dashboard"
      description="Run the Planner -> Executor -> Critic loop against a high-level goal."
    >
      <div className="mb-3 flex gap-2">
        <input
          className="ring-focus w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
        />
        <button className="ring-focus rounded-lg bg-[var(--accent-2)] px-4 py-2 font-semibold text-white hover:brightness-95 disabled:opacity-50" disabled={busy} type="button" onClick={runGoal}>
          Run
        </button>
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-white p-3 text-sm">
        {!taskRun ? (
          <p>No task run yet.</p>
        ) : (
          <div className="space-y-2">
            <p><strong>Task:</strong> {taskRun.id}</p>
            <p><strong>Status:</strong> {taskRun.status}</p>
            <p><strong>Summary:</strong> {taskRun.summary ?? "n/a"}</p>
            <div className="max-h-52 space-y-2 overflow-y-auto">
              {taskRun.steps.map((step, index) => (
                <div className="rounded-md border border-[var(--line)] p-2" key={`${step.id}-${index}`}>
                  <p className="font-medium">{index + 1}. {step.description}</p>
                  <p>Status: {step.status} | Retries: {step.retries}</p>
                  {step.result ? <p className="text-xs text-slate-700">Result: {step.result}</p> : null}
                  {step.error ? <p className="text-xs text-[var(--danger)]">Error: {step.error}</p> : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
