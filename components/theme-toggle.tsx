"use client";

import { useEffect, useState } from "react";

type ThemeMode = "system" | "light" | "dark";

const preferenceKey = "reportar-theme-mode";

function readPreference(): ThemeMode {
  try {
    const value = window.localStorage.getItem(preferenceKey);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function applyMode(mode: ThemeMode, systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches) {
  const resolvedTheme = mode === "system" ? (systemPrefersDark ? "dark" : "light") : mode;
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themeMode = mode;
  return resolvedTheme === "dark";
}

export function ThemeToggle({ inverse = false }: { inverse?: boolean }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncFromSystem = () => {
      const preference = readPreference();
      setIsDark(applyMode(preference, media.matches));
    };

    syncFromSystem();
    media.addEventListener("change", syncFromSystem);
    return () => media.removeEventListener("change", syncFromSystem);
  }, []);

  function choose(mode: Exclude<ThemeMode, "system">) {
    try {
      window.localStorage.setItem(preferenceKey, mode);
    } catch {
      // Keep the control usable when browser storage is unavailable.
    }
    setIsDark(applyMode(mode));
  }

  return (
    <div className={`theme-control${inverse ? " is-inverse" : ""}`}>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        title={isDark ? "Modo oscuro · cambiar a claro" : "Modo claro · cambiar a oscuro"}
        className="theme-toggle"
        onClick={() => choose(isDark ? "light" : "dark")}
      >
        {isDark ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.6 8.6 0 1 0 20.9 13Z"/><path d="M16 3v4m-2-2h4"/></svg>
        )}
      </button>
    </div>
  );
}
