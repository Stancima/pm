"use client";

import { useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LoginForm } from "@/components/LoginForm";
import { getMe, logout } from "@/lib/api";

export default function Home() {
  const [user, setUser] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getMe().then(setUser);
  }, []);

  if (user === undefined) {
    return null;
  }

  if (user === null) {
    return <LoginForm onLogin={setUser} />;
  }

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  return <KanbanBoard onLogout={handleLogout} />;
}
