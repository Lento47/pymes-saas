import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "dark" | "light";

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem("pymeshub-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return "dark";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#070B14" : "#f2f3f5");
  try { localStorage.setItem("pymeshub-theme", theme); } catch {}
}

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: getStoredTheme(), toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
