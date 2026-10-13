import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "@/app/page";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ username: "user" })));
    render(<Home />);
    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
  });

  it("signs in and logs out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(url === "/api/me" ? json({}, 401) : json({ username: "user" }))
      )
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
