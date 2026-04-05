import { create } from "zustand";
import { AssistantMessage, MemoryResult, TaskRun } from "../types";

interface JarvisState {
  apiBaseUrl: string;
  sessionId: string;
  chatId: string;
  messages: AssistantMessage[];
  taskRun: TaskRun | null;
  memoryResults: MemoryResult[];
  logs: string[];
  busy: boolean;
  listening: boolean;
  setApiBaseUrl: (value: string) => void;
  setSessionId: (value: string) => void;
  setChatId: (value: string) => void;
  setBusy: (value: boolean) => void;
  setListening: (value: boolean) => void;
  pushLog: (line: string) => void;
  addMessage: (message: AssistantMessage) => void;
  setMessages: (messages: AssistantMessage[]) => void;
  setTaskRun: (run: TaskRun | null) => void;
  setMemoryResults: (results: MemoryResult[]) => void;
}

const initialApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://my-kelvin-ai-production.up.railway.app";

export const useJarvisStore = create<JarvisState>((set) => ({
  apiBaseUrl: initialApiBaseUrl,
  sessionId: "dev-session-1",
  chatId: "",
  messages: [],
  taskRun: null,
  memoryResults: [],
  logs: [],
  busy: false,
  listening: false,
  setApiBaseUrl: (value) => set({ apiBaseUrl: value }),
  setSessionId: (value) => set({ sessionId: value }),
  setChatId: (value) => set({ chatId: value }),
  setBusy: (value) => set({ busy: value }),
  setListening: (value) => set({ listening: value }),
  pushLog: (line) => set((state) => ({ logs: [`${new Date().toLocaleTimeString()} - ${line}`, ...state.logs].slice(0, 40) })),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setMessages: (messages) => set({ messages }),
  setTaskRun: (run) => set({ taskRun: run }),
  setMemoryResults: (results) => set({ memoryResults: results })
}));
