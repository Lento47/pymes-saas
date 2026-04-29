import { useState, useEffect } from "react";
import { X, ShieldCheck, Cookie, BarChart3, Info } from "lucide-react";
import { grantAnalyticsConsent, revokeAnalyticsConsent } from "@/lib/analytics";

const STORAGE_KEY = "cookie_prefs";

type Prefs = {
  essential: boolean; // always true
  analytics: boolean;
};
type Consent = "accepted" | "rejected" | "custom";

function getStored(): { consent: Consent; prefs: Prefs } | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) return JSON.parse(v);
  } catch {}
  return null;
}

function store(consent: Consent, prefs: Prefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ consent, prefs })); } catch {}
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({ essential: true, analytics: false });

  useEffect(() => {
    const stored = getStored();
    if (!stored) {
      setVisible(true);
    } else if (stored.prefs?.analytics) {
      grantAnalyticsConsent();
    }
  }, []);

  const apply = (choice: "accept_all" | "reject_non_essential" | "custom") => {
    const finalPrefs: Prefs =
      choice === "accept_all" ? { essential: true, analytics: true }
      : choice === "reject_non_essential" ? { essential: true, analytics: false }
      : prefs;

    const consent: Consent = choice === "accept_all" ? "accepted" : choice === "reject_non_essential" ? "rejected" : "custom";
    store(consent, finalPrefs);

    if (finalPrefs.analytics) grantAnalyticsConsent();
    else revokeAnalyticsConsent();

    setVisible(false);
    setSettingsOpen(false);
  };

  if (!visible) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setVisible(false)} />
      <div
        role="dialog"
        aria-label="Configuración de cookies"
        className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-2xl border border-border/60 bg-card/95 px-5 py-5 shadow-[0_16px_64px_rgba(0,0,0,0.6)] backdrop-blur-xl md:bottom-6"
      >
        {!settingsOpen ? (
          <>
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#dfff4a] mt-0.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  Este sitio usa cookies
                </p>
                <p className="text-xs leading-5 text-muted-foreground">
                  Usamos cookies esenciales para el funcionamiento de la plataforma y cookies de analítica
                  para mejorar tu experiencia. No compartimos tus datos con terceros.
                  {" "}
                  <a href="/legal/cookies-policy" className="underline underline-offset-2 transition hover:text-foreground">
                    Más información
                  </a>.
                </p>
              </div>
              <button onClick={() => setVisible(false)} aria-label="Cerrar" className="mt-0.5 shrink-0 text-muted-foreground/50 hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={() => apply("accept_all")} className="flex-1 rounded-full bg-[linear-gradient(90deg,#efff53,#78efd0)] py-2.5 text-xs font-semibold text-[#071126] transition hover:opacity-90">
                Aceptar todas
              </button>
              <button onClick={() => apply("reject_non_essential")} className="flex-1 rounded-full border border-white/15 py-2.5 text-xs font-semibold text-foreground/85 transition hover:border-white/30">
                Solo esenciales
              </button>
            </div>
            <button onClick={() => setSettingsOpen(true)} className="mt-2 w-full text-center text-[11px] text-muted-foreground hover:text-foreground transition">
              Configurar preferencias
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Cookie className="w-4 h-4 text-[#dfff4a]" />
              <p className="text-sm font-semibold text-foreground">Preferencias de cookies</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 p-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <div>
                    <p className="text-xs font-medium text-foreground">Cookies esenciales</p>
                    <p className="text-[10px] text-muted-foreground">Sesión, seguridad y funcionamiento básico. Siempre activas.</p>
                  </div>
                </div>
                <div className="w-9 h-5 rounded-full bg-emerald-500/30 flex items-center justify-end px-0.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500" />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 p-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-400" />
                  <div>
                    <p className="text-xs font-medium text-foreground">Cookies de analítica</p>
                    <p className="text-[10px] text-muted-foreground">Google Analytics. Nos ayuda a entender cómo usás la plataforma.</p>
                  </div>
                </div>
                <button
                  onClick={() => setPrefs((p) => ({ ...p, analytics: !p.analytics }))}
                  className={`w-9 h-5 rounded-full transition-colors flex items-center ${prefs.analytics ? "bg-amber-500/30 justify-end" : "bg-border justify-start"} px-0.5`}
                >
                  <div className={`w-4 h-4 rounded-full transition-colors ${prefs.analytics ? "bg-amber-500" : "bg-muted-foreground/40"}`} />
                </button>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={() => setSettingsOpen(false)} className="flex-1 rounded-full border border-white/15 py-2.5 text-xs font-semibold text-foreground/85">
                Volver
              </button>
              <button onClick={() => apply("custom")} className="flex-1 rounded-full bg-[linear-gradient(90deg,#efff53,#78efd0)] py-2.5 text-xs font-semibold text-[#071126]">
                Guardar preferencias
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export function getCookieConsent(): Consent | null {
  return getStored()?.consent ?? null;
}

export function getCookiePrefs(): Prefs | null {
  return getStored()?.prefs ?? null;
}
