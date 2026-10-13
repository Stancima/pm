import type { BoardData } from "@/lib/kanban";

const send = async (path: string, method: string, body?: unknown): Promise<BoardData> => {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${response.status}`);
  }
  return response.json();
};

export const getMe = async (): Promise<string | null> => {
  const response = await fetch("/api/me");
  if (!response.ok) {
    return null;
  }
  const data: { username: string } = await response.json();
  return data.username;
};

export const login = async (username: string, password: string) => {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return response.ok;
};

export const logout = async () => {
  await fetch("/api/logout", { method: "POST" });
};

export const getBoard = () => send("/api/board", "GET");

export const renameColumn = (columnId: string, title: string) =>
  send(`/api/columns/${columnId}`, "PATCH", { title });

export const createCard = (columnId: string, title: string, details: string) =>
  send("/api/cards", "POST", { column_id: columnId, title, details });

export const updateCard = (cardId: string, title: string, details: string) =>
  send(`/api/cards/${cardId}`, "PATCH", { title, details });

export const deleteCard = (cardId: string) => send(`/api/cards/${cardId}`, "DELETE");

export const moveCardTo = (cardId: string, columnId: string, position: number) =>
  send(`/api/cards/${cardId}/move`, "POST", { column_id: columnId, position });

export type ChatMessage = { role: "user" | "assistant"; content: string };

export const sendChat = async (
  message: string,
  history: ChatMessage[]
): Promise<{ reply: string; board_updated: boolean }> => {
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  if (!response.ok) {
    throw new Error(`POST /api/ai/chat failed: ${response.status}`);
  }
  return response.json();
};
