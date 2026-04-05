"use client";

import { useEffect, useMemo } from "react";
import { createJarvisClient } from "../../services/api/client";
import { createJarvisSocket } from "../../services/realtime/socket";
import { useJarvisStore } from "../../lib/store/useJarvisStore";
import { TaskRun } from "../../lib/types";
import { ChatPanel } from "../chat/ChatPanel";
import { TaskDashboard } from "../tasks/TaskDashboard";
import { MemoryViewer } from "../memory/MemoryViewer";
import { SettingsPanel } from "../settings/SettingsPanel";

export function JarvisDashboard() {
  const apiBaseUrl = useJarvisStore((state) => state.apiBaseUrl);
  const pushLog = useJarvisStore((state) => state.pushLog);
  const setBusy = useJarvisStore((state) => state.setBusy);
  const addMessage = useJarvisStore((state) => state.addMessage);
  const setTaskRun = useJarvisStore((state) => state.setTaskRun);

  const client = useMemo(() => createJarvisClient(apiBaseUrl), [apiBaseUrl]);

  useEffect(() => {
    const socket = createJarvisSocket(apiBaseUrl);

    socket.on("connect", () => pushLog("Realtime socket connected"));
    socket.on("disconnect", () => pushLog("Realtime socket disconnected"));
    socket.on("system:ready", () => pushLog("Realtime backend ready"));
    socket.on("chat:message", () => {
      // Chat replies are already appended from the HTTP /chat/message response.
      // Keep this listener for status visibility without duplicating UI messages.
      pushLog("Realtime chat update received");
      setBusy(false);
    });
    socket.on("task:update", (payload: { run: { status: string } }) => {
      const run = payload.run as TaskRun;
      setTaskRun(run);
      pushLog(`Realtime task update: ${run.status}`);
      setBusy(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [apiBaseUrl, pushLog, setBusy, setTaskRun]);

  return (
    <main className="mx-auto w-full max-w-7xl p-4 md:p-8">
      <section className="fade-up panel mb-4 rounded-2xl p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-(--accent)">Jarvis Stack</p>
            <h1 className="text-2xl font-semibold md:text-3xl">Personal AI Assistant Control Center</h1>
            <p className="text-sm text-slate-700">Planner, Executor, Critic, Memory, Voice, and Tooling in one runtime.</p>
          </div>
          <div className="rounded-xl border border-(--line) bg-white px-4 py-3 text-sm shadow-sm">
            <div>Versioned backend: <span className="font-mono">{apiBaseUrl}</span></div>
            <div>API prefix: <span className="font-mono">/api/v1</span></div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ChatPanel client={client} />
        <SettingsPanel />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <TaskDashboard client={client} />
        <MemoryViewer client={client} />
      </section>
    </main>
  );
}
