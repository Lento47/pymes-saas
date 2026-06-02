import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "dark" | "light";

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem("PymesHub-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return "dark";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#070B14" : "#f2f3f5");
  try { localStorage.setItem("PymesHub-theme", theme); } catch {}
}

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: getStoredTheme(), toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setThemeState(prev => (prev === "dark" ? "light" : "dark"));
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
