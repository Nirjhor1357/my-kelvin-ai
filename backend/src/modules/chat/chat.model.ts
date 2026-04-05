export interface ChatSummary {
  id: string;
  userId: string;
  title: string | null;
  summary: string | null;
  status: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  role: string;
  content: string;
}
