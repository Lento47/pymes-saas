import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { grantAnalyticsConsent, revokeAnalyticsConsent } from "@/lib/analytics";

const STORAGE_KEY = "cookie_consent";

type Consent = "accepted" | "rejected";

function getStoredConsent(): Consent | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "accepted" || v === "rejected") return v;
  } catch { /* SSR / private browsing */ }
  return null;
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (!stored) {
      setVisible(true);
    } else if (stored === "accepted") {
      grantAnalyticsConsent();
    }
  }, []);

  const respond = (choice: Consent) => {
    try { localStorage.setItem(STORAGE_KEY, choice); } catch { /* ignore */ }
    if (choice === "accepted") grantAnalyticsConsent();
    else revokeAnalyticsConsent();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-2xl border border-white/10 bg-[#0c1230]/95 px-5 py-4 shadow-[0_8px_40px_rgba(0,0,0,0.5)] backdrop-blur-md md:bottom-6"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <p className="text-sm font-semibold text-white">
            We use cookies 🍪
          </p>
          <p className="text-xs leading-5 text-white/60">
            We use essential cookies to keep the platform running. We don't track you or sell your data.{" "}
            <a
              href="/#/legal/privacy-policy"
              className="underline underline-offset-2 transition hover:text-white/90"
            >
              Privacy policy
            </a>
            .
          </p>
        </div>
        <button
          onClick={() => respond("rejected")}
          aria-label="Dismiss"
          className="mt-0.5 shrink-0 text-white/40 transition hover:text-white/80"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => respond("accepted")}
          className="flex-1 rounded-full bg-[linear-gradient(90deg,#efff53,#78efd0)] py-2 text-xs font-semibold text-[#071126] transition hover:opacity-90"
        >
          Accept all
        </button>
        <button
          onClick={() => respond("rejected")}
          className="flex-1 rounded-full border border-white/15 py-2 text-xs font-semibold text-white/80 transition hover:border-white/30 hover:text-white"
        >
          Reject non-essential
        </button>
      </div>
    </div>
  );
}

/** Returns the stored consent value — use this to gate analytics/tracking */
export function getCookieConsent(): Consent | null {
  return getStoredConsent();
}
