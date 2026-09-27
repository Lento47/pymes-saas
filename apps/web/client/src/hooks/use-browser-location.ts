import { useCallback, useState } from "react";

export type BrowserLocationState = "idle" | "pending" | "granted" | "denied" | "unavailable";

/**
 * The customer's coordinates, and nothing else.
 *
 * The permission is requested **only** when `request()` is called, never on mount: a
 * marketplace that asks for location the moment the page loads is asking before the
 * customer knows why. A denied permission, an unsupported browser and a timed-out fix all
 * collapse to the same `coords: undefined`, which every feed already renders — "nearby"
 * becomes "newest" server-side, so there is no empty section to explain.
 */
export function useBrowserLocation() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [status, setStatus] = useState<BrowserLocationState>("idle");

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    setStatus("pending");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setStatus("granted");
      },
      () => setStatus("denied"),
      { timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  return { coords, status, request };
}
