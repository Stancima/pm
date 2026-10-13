import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import * as api from "@/lib/api";
import type { BoardData } from "@/lib/kanban";
import { testBoard } from "@/test/board";

vi.mock("@/lib/api");

const withBacklog = (change: (board: BoardData) => BoardData) => change(structuredClone(testBoard));

const renderBoard = async (onLogout = () => {}) => {
  render(<KanbanBoard onLogout={onLogout} />);
  await screen.findByRole("heading", { name: "Kanban Studio" });
  return screen.getAllByTestId(/^column-/)[0];
};

describe("KanbanBoard", () => {
  beforeEach(() => {
    vi.mocked(api.getBoard).mockResolvedValue(testBoard);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("loads the board from the API", async () => {
    const column = await renderBoard();
    expect(api.getBoard).toHaveBeenCalled();
    expect(screen.getAllByTestId(/^column-/)).toHaveLength(5);
    expect(within(column).getByText("First card")).toBeInTheDocument();
  });

  it("saves a column rename on blur", async () => {
    vi.mocked(api.renameColumn).mockResolvedValue(
      withBacklog((board) => {
        board.columns[0].title = "New Name";
        return board;
      })
    );
    const column = await renderBoard();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(api.renameColumn).not.toHaveBeenCalled();

    await userEvent.tab();
    expect(api.renameColumn).toHaveBeenCalledWith("col-backlog", "New Name");
    expect(await screen.findByDisplayValue("New Name")).toBeInTheDocument();
  });

  it("saves a column rename on Enter and skips unchanged titles", async () => {
    vi.mocked(api.renameColumn).mockResolvedValue(testBoard);
    const column = await renderBoard();
    const input = within(column).getByLabelText("Column title");
    await userEvent.click(input);
    await userEvent.keyboard("{Enter}");
    expect(api.renameColumn).not.toHaveBeenCalled();

    await userEvent.type(input, "!{Enter}");
    expect(api.renameColumn).toHaveBeenCalledWith("col-backlog", "Backlog!");
  });

  it("adds a card", async () => {
    vi.mocked(api.createCard).mockResolvedValue(
      withBacklog((board) => {
        board.cards["card-3"] = { id: "card-3", title: "New card", details: "Notes" };
        board.columns[0].cardIds.push("card-3");
        return board;
      })
    );
    const column = await renderBoard();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "New card");
    await userEvent.type(within(column).getByPlaceholderText(/details/i), "Notes");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(api.createCard).toHaveBeenCalledWith("col-backlog", "New card", "Notes");
    expect(await within(column).findByText("New card")).toBeInTheDocument();
  });

  it("edits a card", async () => {
    vi.mocked(api.updateCard).mockResolvedValue(
      withBacklog((board) => {
        board.cards["card-1"] = { id: "card-1", title: "Edited", details: "Changed" };
        return board;
      })
    );
    const column = await renderBoard();
    await userEvent.click(within(column).getByRole("button", { name: "Edit First card" }));
    const title = within(column).getByLabelText("Card title");
    await userEvent.clear(title);
    await userEvent.type(title, "Edited");
    const details = within(column).getByLabelText("Card details");
    await userEvent.clear(details);
    await userEvent.type(details, "Changed");
    await userEvent.click(within(column).getByRole("button", { name: "Save" }));

    expect(api.updateCard).toHaveBeenCalledWith("card-1", "Edited", "Changed");
    expect(await within(column).findByText("Edited")).toBeInTheDocument();
    expect(within(column).getByText("Changed")).toBeInTheDocument();
  });

  it("cancels editing without saving", async () => {
    const column = await renderBoard();
    await userEvent.click(within(column).getByRole("button", { name: "Edit First card" }));
    await userEvent.type(within(column).getByLabelText("Card title"), " changed");
    await userEvent.click(within(column).getByRole("button", { name: "Cancel" }));

    expect(api.updateCard).not.toHaveBeenCalled();
    expect(within(column).getByText("First card")).toBeInTheDocument();
  });

  it("deletes a card", async () => {
    vi.mocked(api.deleteCard).mockResolvedValue(
      withBacklog((board) => {
        delete board.cards["card-1"];
        board.columns[0].cardIds = ["card-2"];
        return board;
      })
    );
    const column = await renderBoard();
    await userEvent.click(within(column).getByRole("button", { name: "Delete First card" }));

    expect(api.deleteCard).toHaveBeenCalledWith("card-1");
    expect(await within(column).findByText("Second card")).toBeInTheDocument();
    expect(within(column).queryByText("First card")).not.toBeInTheDocument();
  });

  it("calls onLogout when log out is clicked", async () => {
    const onLogout = vi.fn();
    await renderBoard(onLogout);
    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(onLogout).toHaveBeenCalled();
  });
});
