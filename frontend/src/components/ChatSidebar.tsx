import { useEffect, useRef, useState, type FormEvent } from "react";
import * as api from "@/lib/api";

type ChatSidebarProps = {
  onBoardUpdated: () => void;
};

export const ChatSidebar = ({ onBoardUpdated }: ChatSidebarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<api.ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isLoading, isOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || isLoading) {
      return;
    }
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    setError("");
    setIsLoading(true);
    try {
      const { reply, board_updated } = await api.sendChat(message, messages);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      if (board_updated) {
        onBoardUpdated();
      }
    } catch {
      setMessages((prev) => prev.slice(0, -1));
      setInput(message);
      setError("The AI request failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-20 rounded-full bg-[var(--secondary-purple)] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-white shadow-[var(--shadow)] transition hover:brightness-110"
      >
        Open AI chat
      </button>
    );
  }

  return (
    <aside
      aria-label="AI chat"
      className="fixed right-0 top-0 z-20 flex h-screen w-full max-w-[380px] flex-col border-l border-[var(--stroke)] bg-white shadow-[var(--shadow)]"
    >
      <div className="flex items-center justify-between border-b border-[var(--stroke)] px-6 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
            Assistant
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-[var(--navy-dark)]">
            AI chat
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
        >
          Close
        </button>
      </div>

      <ul ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-5">
        {messages.length === 0 ? (
          <li className="text-sm leading-6 text-[var(--gray-text)]">
            Ask the AI to create, edit or move cards.
          </li>
        ) : null}
        {messages.map((message, index) => (
          <li
            key={index}
            className={
              message.role === "user"
                ? "ml-8 whitespace-pre-wrap rounded-2xl bg-[var(--primary-blue)] px-4 py-3 text-sm text-white"
                : "mr-8 whitespace-pre-wrap rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--navy-dark)]"
            }
          >
            {message.content}
          </li>
        ))}
        {isLoading ? (
          <li className="mr-8 text-sm text-[var(--gray-text)]">Thinking...</li>
        ) : null}
      </ul>

      <form onSubmit={handleSubmit} className="space-y-3 border-t border-[var(--stroke)] px-6 py-5">
        {error ? (
          <p role="alert" className="text-sm text-[var(--secondary-purple)]">
            {error}
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            aria-label="Message"
            placeholder="Ask the AI..."
            className="min-w-0 flex-1 rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </aside>
  );
};
