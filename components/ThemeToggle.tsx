"use client";

// The light/dark switch in the header. Light ("notebook paper") is the default; dark ("evening
// study": warm espresso browns around the same oak-framed green board) is remembered per browser.
// The choice lives on <html data-theme="dark">, and globals.css swaps the color tokens for it.
// app/layout.tsx applies a saved choice before the page paints, so there's no flash of the wrong mode.
import { useEffect, useState } from "react";

export const THEME_KEY = "chalkline.theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark"); // eslint-disable-line react-hooks/set-state-in-effect -- read the mode the page started in (the server can't know it)
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    if (next) document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white/20 text-muted transition hover:border-white/40 hover:text-text ${className}`}
    >
      {dark ? (
        // sun: "go back to light"
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
        </svg>
      ) : (
        // moon: "go dark"
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        </svg>
      )}
    </button>
  );
}
