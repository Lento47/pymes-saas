import { createContext, useContext, useEffect, useState, useCallback } from "react";

import { isStorefrontRoute } from "@/lib/storefront-routes";

type Theme = "dark" | "light";

/**
 * The visitor's stated preference, or `null` when they have never chosen.
 *
 * `null` is a real third state and the distinction matters. Treating "never chose" as
 * "dark" is what made the storefront ship navy to everyone; treating it as "light" and
 * then *writing* that back is worse, because a stranger who only ever browsed products
 * would silently change the theme of the app they later sign in to. So a resolved theme
 * is never persisted — only a chosen one is.
 */
function getStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem("PymesHub-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return null;
}

/**
 * What to show someone who has expressed no preference.
 *
 * The storefront defaults to light because it is the surface a signed-out stranger
 * lands on, and the direction there is a near-white ground. The signed-in app keeps
 * dark, which is what `DESIGN.md` specifies for it.
 */
function resolveTheme(stored: Theme | null, pathname: string): Theme {
  if (stored) return stored;
  return isStorefrontRoute(pathname) ? "light" : "dark";
}

function applyTheme(theme: Theme, persist: boolean) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#070B14" : "#f2f3f5");
  if (persist) {
    try { localStorage.setItem("PymesHub-theme", theme); } catch {}
  }
}

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: resolveTheme(getStoredTheme(), typeof window === "undefined" ? "/" : window.location.pathname),
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    resolveTheme(getStoredTheme(), typeof window === "undefined" ? "/" : window.location.pathname),
  );

  useEffect(() => {
    // Persist only when there is something to persist. A visitor who never touched the
    // toggle must not acquire a stored preference just because they loaded a page.
    applyTheme(theme, getStoredTheme() !== null);
  }, [theme]);

  const toggle = useCallback(() => {
    setThemeState((previous) => {
      const next = previous === "dark" ? "light" : "dark";
      applyTheme(next, true);
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
