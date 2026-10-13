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
