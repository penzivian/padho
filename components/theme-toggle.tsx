"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

// Manual light/dark toggle. The initial theme is applied pre-paint by the inline
// script in layout.tsx (reads localStorage, falls back to prefers-color-scheme);
// this just flips and persists the choice.
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // localStorage unavailable (private mode) — theme still applies for the session.
    }
  }

  return (
    <button
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
      onClick={toggle}
      type="button"
    >
      {dark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
}
