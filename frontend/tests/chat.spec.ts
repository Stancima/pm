import { expect, test } from "@playwright/test";
import { E2E_PREFIX, getBoard, login, removeTestCards } from "./helpers";

test.beforeEach(async ({ page }) => {
  await login(page);
  await removeTestCards(page);
});

test.afterEach(async ({ page }) => {
  await removeTestCards(page);
});

test("chat round trip refreshes the board when the AI changes it", async ({ page }) => {
  const title = `${E2E_PREFIX} from chat`;
  const requests: unknown[] = [];
  await page.route("/api/ai/chat", async (route) => {
    requests.push(route.request().postDataJSON());
    const board = await getBoard(page);
    await page.request.post("/api/cards", {
      data: { column_id: board.columns[0].id, title, details: "" },
    });
    await route.fulfill({ json: { reply: "Added the card.", board_updated: true } });
  });

  await page.getByRole("button", { name: "Open AI chat" }).click();
  const chat = page.getByRole("complementary", { name: "AI chat" });
  await chat.getByLabel("Message").fill("Add a card");
  await chat.getByRole("button", { name: "Send" }).click();

  await expect(chat.getByText("Added the card.")).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]').first().getByText(title)).toBeVisible();
  expect(requests).toEqual([{ message: "Add a card", history: [] }]);
});
