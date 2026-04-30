import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type Theme = "dark" | "light" | "claude" | "chatgpt" | "apple" | "samsung";

const ALL_THEMES: Theme[] = ["dark", "light", "claude", "chatgpt", "apple", "samsung"];
const BRAND_CLASSES = ["theme-claude", "theme-chatgpt", "theme-apple", "theme-samsung"];

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem("pymeshub-theme");
    if (stored && ALL_THEMES.includes(stored as Theme)) return stored as Theme;
  } catch {}
  return "dark";
}

export function applyThemeGlobally(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light");
  BRAND_CLASSES.forEach(c => root.classList.remove(c));

  if (theme === "light") {
    root.classList.add("light");
  } else if (theme !== "dark") {
    root.classList.add(`theme-${theme}`);
  }

  const isDarkBase = theme === "dark" || BRAND_CLASSES.some(c => c === `theme-${theme}`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDarkBase ? "#070B14" : "#f2f3f5");
  try { localStorage.setItem("pymeshub-theme", theme); } catch {}
}

function isLightBase(theme: Theme): boolean {
  return theme === "light";
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: getStoredTheme(),
  setTheme: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    applyThemeGlobally(theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  const toggle = useCallback(() => {
    setThemeState(prev => {
      if (prev === "dark") return "light";
      return "dark";
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
