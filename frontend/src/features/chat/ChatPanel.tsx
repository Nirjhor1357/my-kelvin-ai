"use client";

import { FormEvent, useState } from "react";
import { JarvisApiClient } from "../../services/api/client";
import { useJarvisStore } from "../../lib/store/useJarvisStore";
import { SectionCard } from "../../components/SectionCard";

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
};

export function ChatPanel({ client }: { client: JarvisApiClient }) {
  const [input, setInput] = useState("");
  const messages = useJarvisStore((state) => state.messages);
  const sessionId = useJarvisStore((state) => state.sessionId);
  const chatId = useJarvisStore((state) => state.chatId);
  const busy = useJarvisStore((state) => state.busy);
  const listening = useJarvisStore((state) => state.listening);
  const setBusy = useJarvisStore((state) => state.setBusy);
  const setListening = useJarvisStore((state) => state.setListening);
  const addMessage = useJarvisStore((state) => state.addMessage);
  const setChatId = useJarvisStore((state) => state.setChatId);
  const pushLog = useJarvisStore((state) => state.pushLog);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const message = input.trim();
    if (!message) {
      return;
    }

    setInput("");
    addMessage({ role: "user", content: message });
    setBusy(true);
    pushLog("Sending chat message");

    try {
      const response = await client.chat({ userId: sessionId, chatId: chatId || undefined, message, memoryTopK: 4 });
      setChatId(response.chat.id);
      addMessage({ role: "assistant", content: response.answer });
      pushLog("Assistant reply received");
    } catch (error) {
      addMessage({ role: "assistant", content: `Chat error: ${(error as Error).message}` });
      pushLog("Chat request failed");
    } finally {
      setBusy(false);
    }
  }

  function speakLastReply(): void {
    if (!("speechSynthesis" in window)) {
      return;
    }

    const lastReply = [...messages].reverse().find((message) => message.role === "assistant");
    if (!lastReply) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(lastReply.content);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
    pushLog("Speaking last assistant reply");
  }

  function startVoiceInput(): void {
    const speechWindow = window as Window & {
      webkitSpeechRecognition?: SpeechRecognitionCtor;
      SpeechRecognition?: SpeechRecognitionCtor;
    };
    const SpeechRecognition = speechWindow.webkitSpeechRecognition || speechWindow.SpeechRecognition;
    if (!SpeechRecognition) {
      pushLog("SpeechRecognition is unavailable in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event) => setInput(event.results[0][0].transcript);
    recognition.onerror = (event) => pushLog(`Voice error: ${event.error}`);
    recognition.start();
  }

  return (
    <SectionCard
      title="Chat Interface"
      description="Natural language chat with memory injection and voice support."
      className="lg:col-span-2"
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <button className="ring-focus rounded-md border border-[var(--line)] px-3 py-1.5 text-sm hover:bg-white" type="button" onClick={startVoiceInput}>
          {listening ? "Listening..." : "Voice Input"}
        </button>
        <button className="ring-focus rounded-md border border-[var(--line)] px-3 py-1.5 text-sm hover:bg-white" type="button" onClick={speakLastReply}>
          Speak Last Reply
        </button>
      </div>

      <div className="mb-3 h-[340px] overflow-y-auto rounded-xl border border-[var(--line)] bg-white p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">No messages yet.</p>
        ) : (
          <div className="space-y-2">
            {messages.map((message, index) => (
              <div
                className={`rounded-lg px-3 py-2 text-sm ${message.role === "user" ? "ml-8 bg-[var(--accent)]/15" : "mr-8 bg-[var(--accent-2)]/16"}`}
                key={`${message.role}-${index}`}
              >
                <div className="mb-1 font-mono text-[11px] uppercase tracking-wide">{message.role}</div>
                <p className="whitespace-pre-wrap leading-6">{message.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <form className="flex gap-2" onSubmit={handleSubmit}>
        <input
          className="ring-focus w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
          placeholder="Ask something actionable..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <button className="ring-focus rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white hover:brightness-95 disabled:opacity-50" disabled={busy} type="submit">
          Send
        </button>
      </form>
    </SectionCard>
  );
}
