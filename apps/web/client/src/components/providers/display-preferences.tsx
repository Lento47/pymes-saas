import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { MotionConfig } from "framer-motion";

type Preferences = { largeText: boolean; reducedMotion: boolean };
const defaults: Preferences = { largeText: false, reducedMotion: false };
const eventName = "pymes-display-preferences";
const memory = new Map<string, string>();
const Context = createContext({ ...defaults, setPreference: (_key: keyof Preferences, _value: boolean) => {} });

function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(eventName, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(eventName, notify);
  };
}

export function DisplayPreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const key = user ? `pymes-display:${user.id}:${user.workspace.id}` : null;
  const raw = useSyncExternalStore(subscribe, () => {
    if (!key) return "";
    if (memory.has(key)) return memory.get(key)!;
    try { return localStorage.getItem(key) ?? ""; }
    catch { return memory.get(key) ?? ""; }
  }, () => "");
  let preferences = defaults;
  try {
    const value = JSON.parse(raw);
    preferences = { largeText: value?.largeText === true, reducedMotion: value?.reducedMotion === true };
  } catch { /* Invalid preferences use readable, motion-aware defaults. */ }

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.largeText = String(preferences.largeText);
    root.dataset.reducedMotion = String(preferences.reducedMotion);
    return () => { delete root.dataset.largeText; delete root.dataset.reducedMotion; };
  }, [preferences.largeText, preferences.reducedMotion]);

  function setPreference(name: keyof Preferences, value: boolean) {
    if (!key) return;
    const next = JSON.stringify({ ...preferences, [name]: value });
    try { localStorage.setItem(key, next); memory.delete(key); }
    catch { memory.set(key, next); }
    window.dispatchEvent(new Event(eventName));
  }
  return <Context.Provider value={{ ...preferences, setPreference }}><MotionConfig reducedMotion={preferences.reducedMotion ? "always" : "user"}>{children}</MotionConfig></Context.Provider>;
}

export const useDisplayPreferences = () => useContext(Context);
