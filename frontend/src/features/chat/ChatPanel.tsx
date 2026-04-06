"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { JarvisApiClient } from "../../services/api/client";
import { useJarvisStore } from "../../lib/store/useJarvisStore";
import { SectionCard } from "../../components/SectionCard";
import { ChatSummary } from "../../lib/types";

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
  const [errorText, setErrorText] = useState("");
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [streamDraft, setStreamDraft] = useState("");
  const messages = useJarvisStore((state) => state.messages);
  const sessionId = useJarvisStore((state) => state.sessionId);
  const chatId = useJarvisStore((state) => state.chatId);
  const busy = useJarvisStore((state) => state.busy);
  const listening = useJarvisStore((state) => state.listening);
  const setBusy = useJarvisStore((state) => state.setBusy);
  const setListening = useJarvisStore((state) => state.setListening);
  const addMessage = useJarvisStore((state) => state.addMessage);
  const setChatId = useJarvisStore((state) => state.setChatId);
  const setMessages = useJarvisStore((state) => state.setMessages);
  const pushLog = useJarvisStore((state) => state.pushLog);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  const canSend = useMemo(() => !busy && isOnline, [busy, isOnline]);

  async function refreshChats(): Promise<void> {
    try {
      const response = await client.listChats(sessionId);
      setChats(response.chats);
    } catch {
      // Keep chat UI operational if history retrieval fails.
    }
  }

  useEffect(() => {
    void refreshChats();
  }, [client, sessionId]);

  async function loadChatHistory(nextChatId: string): Promise<void> {
    if (!nextChatId) {
      return;
    }

    setHistoryLoading(true);
    try {
      const response = await client.getChatMessages(nextChatId);
      setChatId(nextChatId);
      setMessages(
        response.messages
          .filter((message) => message.role === "user" || message.role === "assistant")
          .map((message) => ({ role: message.role as "user" | "assistant", content: message.content }))
      );
      pushLog(`Loaded chat history: ${nextChatId}`);
    } catch (error) {
      setErrorText(`Failed to load chat history: ${(error as Error).message}`);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function sendMessage(message: string): Promise<void> {
    setBusy(true);
    setErrorText("");
    setStreamDraft("");
    pushLog("Sending chat message");

    try {
      let streamed = "";
      let streamedChatId = chatId;

      await client.chatStream(
        { userId: sessionId, chatId: chatId || undefined, message, memoryTopK: 4 },
        {
          onMeta: (meta) => {
            streamedChatId = meta.chatId;
            setChatId(meta.chatId);
          },
          onToken: (token) => {
            streamed += token;
            setStreamDraft(streamed);
          }
        }
      );

      const finalAnswer = streamed.trim();
      if (finalAnswer) {
        addMessage({ role: "assistant", content: finalAnswer });
      } else {
        const fallback = await client.chat({ userId: sessionId, chatId: streamedChatId || undefined, message, memoryTopK: 4 });
        setChatId(fallback.chat.id);
        addMessage({ role: "assistant", content: fallback.answer });
      }

      setStreamDraft("");
      await refreshChats();
      setLastFailedMessage(null);
      pushLog("Assistant reply received");
    } catch (error) {
      const text = `Chat error: ${(error as Error).message}`;
      setErrorText(text);
      setLastFailedMessage(message);
      addMessage({ role: "assistant", content: text });
      pushLog("Chat request failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const message = input.trim();
    if (!message) {
      return;
    }

    if (!isOnline) {
      const offlineText = "You are offline. Reconnect and retry.";
      setErrorText(offlineText);
      pushLog("Offline mode: request skipped");
      return;
    }

    setInput("");
    addMessage({ role: "user", content: message });
    await sendMessage(message);
  }

  async function retryLastMessage(): Promise<void> {
    if (!lastFailedMessage) {
      return;
    }

    addMessage({ role: "user", content: `(retry) ${lastFailedMessage}` });
    await sendMessage(lastFailedMessage);
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

      <div className="mb-3 rounded-lg border border-[var(--line)] bg-white p-2 text-sm">
        <label className="mb-1 block font-mono text-xs uppercase tracking-wide">Chat History</label>
        <select
          className="ring-focus w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
          disabled={historyLoading}
          onChange={(event) => {
            const value = event.target.value;
            if (value) {
              void loadChatHistory(value);
            }
          }}
          value={chatId}
        >
          <option value="">Current conversation</option>
          {chats.map((chat) => (
            <option key={chat.id} value={chat.id}>
              {(chat.title ?? "Untitled chat").slice(0, 48)}
            </option>
          ))}
        </select>
      </div>

      {!isOnline && <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Offline mode: connect to internet to send requests.</div>}
      {errorText && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          <span>{errorText}</span>
          <button className="rounded border border-rose-300 px-2 py-1 text-xs font-semibold hover:bg-rose-100 disabled:opacity-60" disabled={!lastFailedMessage || busy || !isOnline} onClick={retryLastMessage} type="button">
            Retry
          </button>
        </div>
      )}

      <div className="mb-3 h-[340px] overflow-y-auto rounded-xl border border-[var(--line)] bg-white p-3" ref={scrollRef}>
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
                {message.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none leading-6">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                )}
              </div>
            ))}
            {busy && streamDraft && (
              <div className="mr-8 rounded-lg bg-[var(--accent-2)]/12 px-3 py-2 text-sm text-slate-700">
                <div className="mb-1 font-mono text-[11px] uppercase tracking-wide">assistant</div>
                <div className="prose prose-sm max-w-none leading-6">
                  <ReactMarkdown>{streamDraft}</ReactMarkdown>
                </div>
              </div>
            )}
            {busy && !streamDraft && <div className="mr-8 rounded-lg bg-[var(--accent-2)]/12 px-3 py-2 text-sm italic text-slate-700">Jarvis is typing...</div>}
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
        <button className="ring-focus rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white hover:brightness-95 disabled:opacity-50" disabled={!canSend} type="submit">
          Send
        </button>
      </form>
    </SectionCard>
  );
}
