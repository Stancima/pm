import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/components/LoginForm";

const fillAndSubmit = async (username: string, password: string) => {
  await userEvent.type(screen.getByLabelText("Username"), username);
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
};

describe("LoginForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts credentials and calls onLogin on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);

    await fillAndSubmit("user", "password");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ username: "user", password: "password" }),
      })
    );
    expect(onLogin).toHaveBeenCalledWith("user");
  });

  it("shows an error on bad credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);

    await fillAndSubmit("user", "wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid/i);
    expect(onLogin).not.toHaveBeenCalled();
  });
});
