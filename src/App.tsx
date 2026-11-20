import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Download,
  Menu,
  MessageCircle,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  conversationTitle,
  loadConversations,
  newConversation,
  saveConversations,
  type Conversation,
  type Message,
} from "./storage";

const tones = ["ciepły i rzeczowy", "śmiały i kreatywny", "krótki i konkretny"];
const suggestions = [
  "Pomóż mi rozwinąć pomysł na projekt",
  "Wymyśl świeże hasło kampanii",
  "Ułóż plan twórczy na ten tydzień",
];

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [activeId, setActiveId] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [tone, setTone] = useState(tones[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const active = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) ?? null,
    [activeId, conversations],
  );

  useEffect(() => {
    if (conversations.length === 0) {
      const first = newConversation();
      setConversations([first]);
      setActiveId(first.id);
    } else if (!activeId || !conversations.some((conversation) => conversation.id === activeId)) {
      setActiveId(conversations[0].id);
    }
  }, [activeId, conversations]);

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages, isLoading]);

  function selectConversation(id: string) {
    setActiveId(id);
    setError("");
    setSidebarOpen(false);
  }

  function createConversation() {
    if (isLoading) return;
    const created = newConversation();
    setConversations((current) => [created, ...current]);
    setActiveId(created.id);
    setDraft("");
    setError("");
    setSidebarOpen(false);
  }

  function deleteConversation(id: string) {
    if (isLoading) return;
    setConversations((current) => current.filter((conversation) => conversation.id !== id));
  }

  async function sendMessage(content: string) {
    const clean = content.trim();
    if (!clean || !active || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: clean,
      createdAt: new Date().toISOString(),
    };
    const nextMessages = [...active.messages, userMessage];
    const now = new Date().toISOString();

    setDraft("");
    setError("");
    setIsLoading(true);
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === active.id
          ? {
              ...conversation,
              title:
                conversation.messages.length === 0
                  ? conversationTitle(clean)
                  : conversation.title,
              updatedAt: now,
              messages: nextMessages,
            }
          : conversation,
      ),
    );

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content: text }) => ({ role, content: text })),
          tone,
        }),
      });
      const data = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok || !data.reply) {
        throw new Error(data.error || "Nie udało się pobrać odpowiedzi.");
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply,
        createdAt: new Date().toISOString(),
      };
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === active.id
            ? {
                ...conversation,
                updatedAt: assistantMessage.createdAt,
                messages: [...nextMessages, assistantMessage],
              }
            : conversation,
        ),
      );
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Wystąpił nieoczekiwany błąd.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(conversations, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `maya-rozmowy-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar--open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={19} strokeWidth={1.8} />
          </div>
          <span>Maya</span>
          <button
            className="icon-button sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Zamknij menu"
          >
            <X size={19} />
          </button>
        </div>

        <button className="new-chat" onClick={createConversation} disabled={isLoading}>
          <Plus size={17} />
          Nowa rozmowa
        </button>

        <div className="history-label">Twoje rozmowy</div>
        <nav className="history" aria-label="Historia rozmów">
          {conversations.map((conversation) => (
            <div
              className={`history-row ${conversation.id === active?.id ? "history-row--active" : ""}`}
              key={conversation.id}
            >
              <button onClick={() => selectConversation(conversation.id)}>
                <MessageCircle size={16} />
                <span>{conversation.title}</span>
              </button>
              <button
                className="delete-chat"
                onClick={() => deleteConversation(conversation.id)}
                aria-label={`Usuń rozmowę: ${conversation.title}`}
                disabled={isLoading}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button onClick={exportData}>
            <Download size={16} />
            Pobierz moje rozmowy
          </button>
          <p>
            <Check size={13} />
            Dane zostają w tej przeglądarce
          </p>
        </div>
      </aside>

      {sidebarOpen && (
        <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Zamknij menu" />
      )}

      <main className="main">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Otwórz menu">
            <Menu size={20} />
          </button>
          <div>
            <h1>{active?.messages.length ? active.title : "Maya Creative"}</h1>
            <span>Twój partner do dobrych pomysłów</span>
          </div>
          <label className="tone-select">
            <span>Ton</span>
            <select value={tone} onChange={(event) => setTone(event.target.value)} disabled={isLoading}>
              {tones.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
        </header>

        <section className="conversation">
          {!active?.messages.length ? (
            <div className="welcome">
              <div className="welcome-orb">
                <Sparkles size={30} strokeWidth={1.35} />
              </div>
              <p className="eyebrow">PRZESTRZEŃ NA POMYSŁY</p>
              <h2>Od czego zaczniemy?</h2>
              <p className="welcome-copy">
                Zapisz luźną myśl, postaw problem albo zacznij od jednego z pomysłów poniżej.
                Razem nadamy mu dobry kierunek.
              </p>
              <div className="suggestions">
                {suggestions.map((suggestion, index) => (
                  <button key={suggestion} onClick={() => setDraft(suggestion)}>
                    <span>0{index + 1}</span>
                    {suggestion}
                    <ArrowUp size={15} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages">
              {active.messages.map((message) => (
                <article className={`message message--${message.role}`} key={message.id}>
                  <div className="avatar">{message.role === "assistant" ? <Sparkles size={15} /> : "Ty"}</div>
                  <div>
                    <div className="message-author">{message.role === "assistant" ? "Maya" : "Ty"}</div>
                    <div className="message-content">{message.content}</div>
                  </div>
                </article>
              ))}
              {isLoading && (
                <article className="message message--assistant">
                  <div className="avatar">
                    <Sparkles size={15} />
                  </div>
                  <div>
                    <div className="message-author">Maya</div>
                    <div className="typing" aria-label="Maya pisze">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </article>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </section>

        <div className="composer-area">
          {error && (
            <div className="error-message" role="alert">
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Zamknij komunikat">
                <X size={15} />
              </button>
            </div>
          )}
          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage(draft);
            }}
          >
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage(draft);
                }
              }}
              placeholder="Napisz, nad czym chcesz popracować..."
              rows={1}
              maxLength={10_000}
              disabled={isLoading}
              aria-label="Wiadomość do Mai"
            />
            <button className="send-button" disabled={!draft.trim() || isLoading} aria-label="Wyślij wiadomość">
              <ArrowUp size={19} />
            </button>
          </form>
          <p className="composer-note">Maya opiera się na Gemini i może popełniać błędy. Sprawdzaj ważne informacje.</p>
        </div>
      </main>
    </div>
  );
}
