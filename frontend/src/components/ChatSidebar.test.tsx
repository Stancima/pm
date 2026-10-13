import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatSidebar } from "@/components/ChatSidebar";
import * as api from "@/lib/api";

vi.mock("@/lib/api");

const renderOpen = async (onBoardUpdated = () => {}) => {
  render(<ChatSidebar onBoardUpdated={onBoardUpdated} />);
  await userEvent.click(screen.getByRole("button", { name: "Open AI chat" }));
};

const send = async (text: string) => {
  await userEvent.type(screen.getByLabelText("Message"), text);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
};

describe("ChatSidebar", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("opens and closes", async () => {
    await renderOpen();
    expect(screen.getByRole("complementary", { name: "AI chat" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("sends a message and renders the reply", async () => {
    vi.mocked(api.sendChat).mockResolvedValue({ reply: "Hello there", board_updated: false });
    const onBoardUpdated = vi.fn();
    await renderOpen(onBoardUpdated);
    await send("Hi");

    expect(api.sendChat).toHaveBeenCalledWith("Hi", []);
    expect(screen.getByText("Hi")).toBeInTheDocument();
    expect(await screen.findByText("Hello there")).toBeInTheDocument();
    expect(onBoardUpdated).not.toHaveBeenCalled();
  });

  it("shows a loading state while waiting", async () => {
    let resolve!: (value: { reply: string; board_updated: boolean }) => void;
    vi.mocked(api.sendChat).mockReturnValue(new Promise((r) => (resolve = r)));
    await renderOpen();
    await send("Hi");

    expect(screen.getByText("Thinking...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    resolve({ reply: "Done", board_updated: false });
    expect(await screen.findByText("Done")).toBeInTheDocument();
    expect(screen.queryByText("Thinking...")).not.toBeInTheDocument();
  });

  it("sends the conversation history", async () => {
    vi.mocked(api.sendChat)
      .mockResolvedValueOnce({ reply: "First reply", board_updated: false })
      .mockResolvedValueOnce({ reply: "Second reply", board_updated: false });
    await renderOpen();
    await send("First");
    await screen.findByText("First reply");
    await send("Second");

    expect(api.sendChat).toHaveBeenLastCalledWith("Second", [
      { role: "user", content: "First" },
      { role: "assistant", content: "First reply" },
    ]);
  });

  it("calls onBoardUpdated when the AI changed the board", async () => {
    vi.mocked(api.sendChat).mockResolvedValue({ reply: "Added it", board_updated: true });
    const onBoardUpdated = vi.fn();
    await renderOpen(onBoardUpdated);
    await send("Add a card");

    await screen.findByText("Added it");
    expect(onBoardUpdated).toHaveBeenCalledTimes(1);
  });

  it("shows an error and keeps the message when the request fails", async () => {
    vi.mocked(api.sendChat).mockRejectedValue(new Error("boom"));
    await renderOpen();
    await send("Hi");

    expect(await screen.findByRole("alert")).toHaveTextContent(/failed/i);
    expect(screen.getByLabelText("Message")).toHaveValue("Hi");
  });
});
