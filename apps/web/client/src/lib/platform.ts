declare global {
  interface Window {
    __TAURI__?: {
      shell?: {
        open?: (url: string) => Promise<void> | void;
      };
    };
  }
}

export function isTauriAvailable(): boolean {
  return typeof window !== "undefined" && !!window.__TAURI__;
}

export function isDesktop(): boolean {
  return isTauriAvailable();
}

export async function openExternal(url: string): Promise<void> {
  const open = window.__TAURI__?.shell?.open;
  if (typeof open === "function") {
    await open(url);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
