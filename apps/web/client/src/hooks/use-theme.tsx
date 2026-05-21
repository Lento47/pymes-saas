import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "pymes_theme";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch { /* ignore */ }
  return null;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
}

const systemDarkMql =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return getStoredTheme() ?? getSystemTheme();
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for OS-level theme changes when no explicit preference is stored
  useEffect(() => {
    if (!systemDarkMql) return;
    const handler = (e: MediaQueryListEvent) => {
      const stored = getStoredTheme();
      if (stored) return; // user explicitly chose — don't override
      setThemeState(e.matches ? "dark" : "light");
    };
    systemDarkMql.addEventListener("change", handler);
    return () => systemDarkMql.removeEventListener("change", handler);
  }, []);

  const toggle = useCallback(() => {
    setThemeState(prev => (prev === "dark" ? "light" : "dark"));
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  // Apply on mount (before React hydration paints, for FART-free experience)
  useEffect(() => {
    const stored = getStoredTheme();
    if (stored) {
      document.documentElement.classList.toggle("dark", stored === "dark");
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
