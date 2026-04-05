"use client";

import { useState } from "react";
import { JarvisApiClient } from "../../services/api/client";
import { useJarvisStore } from "../../lib/store/useJarvisStore";
import { SectionCard } from "../../components/SectionCard";

export function MemoryViewer({ client }: { client: JarvisApiClient }) {
  const [query, setQuery] = useState("daily plan");
  const sessionId = useJarvisStore((state) => state.sessionId);
  const memoryResults = useJarvisStore((state) => state.memoryResults);
  const setMemoryResults = useJarvisStore((state) => state.setMemoryResults);
  const busy = useJarvisStore((state) => state.busy);
  const setBusy = useJarvisStore((state) => state.setBusy);
  const pushLog = useJarvisStore((state) => state.pushLog);

  async function searchMemory(): Promise<void> {
    setBusy(true);
    pushLog("Running semantic memory search");

    try {
      const response = await client.searchMemory({ userId: sessionId, query, topK: 6 });
      setMemoryResults(response.results);
      pushLog(`Retrieved ${response.results.length} memory entries`);
    } catch (error) {
      pushLog(`Memory search failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard title="Memory Viewer" description="Search semantic memory and inspect relevant context.">
      <div className="mb-3 flex gap-2">
        <input
          className="ring-focus w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="ring-focus rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white hover:brightness-95 disabled:opacity-50" disabled={busy} type="button" onClick={searchMemory}>
          Search
        </button>
      </div>

      <div className="max-h-[300px] space-y-2 overflow-y-auto rounded-lg border border-[var(--line)] bg-white p-3 text-sm">
        {memoryResults.length === 0 ? (
          <p>No memory results yet.</p>
        ) : (
          memoryResults.map((result) => (
            <div className="rounded-md border border-[var(--line)] p-2" key={result.id}>
              <p className="mb-1 font-mono text-xs">id: {result.id}</p>
              <p className="mb-1">{result.content}</p>
              <p className="text-xs">score: {(result.score ?? 0).toFixed(4)}</p>
            </div>
          ))
        )}
      </div>
    </SectionCard>
  );
}
