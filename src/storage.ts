export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
};

const STORAGE_KEY = "maya-creative-conversations-v1";

export function loadConversations(): Conversation[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    return Array.isArray(parsed) ? (parsed as Conversation[]) : [];
  } catch (error) {
    console.error("Nie udało się odczytać zapisanych rozmów:", error);
    return [];
  }
}

export function saveConversations(conversations: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

export function newConversation(): Conversation {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "Nowa rozmowa",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function conversationTitle(message: string) {
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length > 38 ? `${clean.slice(0, 38)}…` : clean;
}
