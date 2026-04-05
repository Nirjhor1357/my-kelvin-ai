"use client";

import { useJarvisStore } from "../../lib/store/useJarvisStore";
import { SectionCard } from "../../components/SectionCard";

export function SettingsPanel() {
  const apiBaseUrl = useJarvisStore((state) => state.apiBaseUrl);
  const sessionId = useJarvisStore((state) => state.sessionId);
  const busy = useJarvisStore((state) => state.busy);
  const logs = useJarvisStore((state) => state.logs);
  const setApiBaseUrl = useJarvisStore((state) => state.setApiBaseUrl);
  const setSessionId = useJarvisStore((state) => state.setSessionId);

  return (
    <SectionCard title="Settings + Logs" description="Endpoint configuration and runtime activity stream.">
      <div className="mb-3 rounded-lg border border-[var(--line)] bg-white p-2 text-sm">
        <label className="mb-1 block font-mono text-xs uppercase tracking-wide">Backend URL</label>
        <input className="ring-focus w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm" value={apiBaseUrl} onChange={(event) => setApiBaseUrl(event.target.value)} />
        <label className="mb-1 mt-2 block font-mono text-xs uppercase tracking-wide">Session / User ID</label>
        <input className="ring-focus w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm" value={sessionId} onChange={(event) => setSessionId(event.target.value)} />
        <div className="mt-2 flex items-center justify-between">
          <span>Busy</span>
          <span className={`font-semibold ${busy ? "text-[var(--danger)]" : "text-[var(--accent)]"}`}>{String(busy)}</span>
        </div>
      </div>

      <div className="h-[280px] overflow-y-auto rounded-lg border border-[var(--line)] bg-white p-2 font-mono text-xs">
        {logs.length ? logs.map((line, index) => <p key={`${line}-${index}`}>{line}</p>) : <p>No logs yet.</p>}
      </div>
    </SectionCard>
  );
}
