const LOCAL_TAURI_HOSTS = new Set([
  "tauri.localhost",
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

export function isTauriDesktop() {
  return typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
}

export function isTauriLocalRuntime() {
  if (!isTauriDesktop() || typeof window === "undefined") {
    return false;
  }

  return LOCAL_TAURI_HOSTS.has(window.location.hostname.toLowerCase());
}
