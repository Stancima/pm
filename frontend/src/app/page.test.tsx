import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "@/app/page";
import { testBoard } from "@/test/board";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const signedIn = (url: string) =>
  Promise.resolve(url === "/api/board" ? json(testBoard) : json({ username: "user" }));

describe("Home", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the login form when not signed in", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 401)));
    render(<Home />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows the board when signed in", async () => {
    vi.stubGlobal("fetch", vi.fn(signedIn));
    render(<Home />);
    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
  });

  it("signs in and logs out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => (url === "/api/me" ? Promise.resolve(json({}, 401)) : signedIn(url)))
    );
    render(<Home />);

    await userEvent.type(await screen.findByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });
});
