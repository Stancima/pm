import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_PREFIX, getBoard, login, removeTestCards } from "./helpers";

const columns = (page: Page) => page.locator('[data-testid^="column-"]');
const cardByText = (scope: Page | Locator, text: string) =>
  scope.locator('[data-testid^="card-"]').filter({ hasText: text });

const addCard = async (column: Locator, title: string, details = "Added via e2e.") => {
  await column.getByRole("button", { name: /add a card/i }).click();
  await column.getByPlaceholder("Card title").fill(title);
  await column.getByPlaceholder("Details").fill(details);
  await column.getByRole("button", { name: /add card/i }).click();
  await expect(column.getByText(title)).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  await login(page);
  await removeTestCards(page);
});

test.afterEach(async ({ page }) => {
  await removeTestCards(page);
});

test("loads the kanban board", async ({ page }) => {
  await expect(columns(page)).toHaveCount(5);
});

test("adds a card that persists after reload", async ({ page }) => {
  const title = `${E2E_PREFIX} add`;
  await addCard(columns(page).first(), title);
  await page.reload();
  await expect(columns(page).first().getByText(title)).toBeVisible();
});

test("edits a card that persists after reload", async ({ page }) => {
  const title = `${E2E_PREFIX} edit`;
  await addCard(columns(page).first(), title);
  const testId = await cardByText(page, title).getAttribute("data-testid");
  const card = page.getByTestId(testId!);
  await card.getByRole("button", { name: `Edit ${title}`, exact: true }).click();
  await card.getByLabel("Card title").fill(`${title} done`);
  await card.getByLabel("Card details").fill("Edited details");
  await card.getByRole("button", { name: "Save" }).click();

  await page.reload();
  const edited = cardByText(page, `${title} done`);
  await expect(edited).toBeVisible();
  await expect(edited.getByText("Edited details")).toBeVisible();
});

test("deletes a card and it stays deleted after reload", async ({ page }) => {
  const title = `${E2E_PREFIX} delete`;
  await addCard(columns(page).first(), title);
  await page.getByRole("button", { name: `Delete ${title}`, exact: true }).click();
  await expect(page.getByText(title)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);
});

test("moves a card between columns and it persists after reload", async ({ page }) => {
  const title = `${E2E_PREFIX} move`;
  await addCard(columns(page).first(), title);
  const card = cardByText(page, title);
  const targetColumn = columns(page).nth(3);
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(columnBox.x + columnBox.width / 2, columnBox.y + 120, { steps: 12 });
  await page.mouse.up();
  await expect(cardByText(targetColumn, title)).toBeVisible();

  await expect
    .poll(async () => {
      const board = await getBoard(page);
      return board.columns[3].cardIds.some((id) => board.cards[id].title === title);
    })
    .toBe(true);
  await page.reload();
  await expect(cardByText(columns(page).nth(3), title)).toBeVisible();
});

test("renames a column and it persists after reload", async ({ page }) => {
  const original = (await getBoard(page)).columns[1];
  const input = columns(page).nth(1).getByLabel("Column title");
  try {
    await input.fill(`${E2E_PREFIX} renamed`);
    await input.press("Enter");
    await expect
      .poll(async () => (await getBoard(page)).columns[1].title)
      .toBe(`${E2E_PREFIX} renamed`);
    await page.reload();
    await expect(columns(page).nth(1).getByLabel("Column title")).toHaveValue(
      `${E2E_PREFIX} renamed`
    );
  } finally {
    await page.request.patch(`/api/columns/${original.id}`, {
      data: { title: original.title },
    });
  }
});
