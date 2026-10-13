import { expect, type Page } from "@playwright/test";

type Board = {
  columns: { id: string; title: string; cardIds: string[] }[];
  cards: Record<string, { id: string; title: string }>;
};

export const E2E_PREFIX = "e2e";

export const login = async (page: Page) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
};

export const getBoard = async (page: Page): Promise<Board> =>
  (await page.request.get("/api/board")).json();

export const removeTestCards = async (page: Page) => {
  const board = await getBoard(page);
  for (const card of Object.values(board.cards)) {
    if (card.title.startsWith(E2E_PREFIX)) {
      await page.request.delete(`/api/cards/${card.id}`);
    }
  }
};
