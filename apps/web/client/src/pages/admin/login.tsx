import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { api, setAuthState } from "@/lib/api";

/**
 * Admin sign-in.
 *
 * The Auth0 round trip ends in a redirect back here carrying a short-lived
 * `?code=…`, which is exchanged for a session over a POST. It used to carry the tokens
 * themselves — `?admin_token=…&admin_refresh=…` — which put a live refresh token into
 * browser history and into the `Location` header of every proxy on the way.
 *
 * ## The URL is scrubbed during the first render, not in an effect
 *
 * `useEffect` runs after the browser has already painted and after anything the page
 * loads has had a chance to read `document.referrer`. This reads the code and rewrites
 * the address bar *synchronously*, during the first render, so the code is gone from
 * the address bar before the document finishes loading. It is still in the `Location`
 * header the server sent — that is what the exchange exists to bound — but it is not in
 * the history entry the operator can go back to, and not in any `Referer` this page
 * sends.
 *
 * The code is held in a ref, not state, so that clearing the URL cannot itself trigger a
 * re-render that races the exchange.
 */
export default function AdminLogin() {
  const [phase, setPhase] = useState<"idle" | "exchanging" | "failed">("idle");
  const [detail, setDetail] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (error) {
      setDetail(
        error === "not_admin"
          ? "Este correo no tiene acceso de administrador."
          : "Error de autenticación. Intentá de nuevo.",
      );
      // The error is not a secret, but the URL is the operator's to keep clean anyway.
      window.history.replaceState(null, "", "/admin/login");
      return;
    }

    if (!code) return;
    if (started.current) return;
    started.current = true;

    // Synchronously, before the effect's await: drop the code from the address bar and
    // from the history entry this page created.
    window.history.replaceState(null, "", "/admin/login");

    setPhase("exchanging");
    api
      .adminExchange(code)
      .then((session) => {
        setAuthState(session.access_token, session.user.workspace.slug, session.refresh_token);
        window.location.replace("/admin");
      })
      .catch((e: unknown) => {
        setPhase("failed");
        setDetail(
          e instanceof Error && e.message
            ? e.message
            : "No se pudo completar el acceso. Intentá de nuevo.",
        );
      });
  }, []);

  if (phase === "exchanging") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sidebar">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar">
      <div className="w-full max-w-sm mx-auto p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 mb-4">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Admin PymesHub</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Acceso exclusivo para administradores de plataforma
          </p>
        </div>

        {detail && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
            {detail}
          </div>
        )}

        <a
          href="/api/auth/admin/login"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors"
        >
          <ShieldCheck className="w-4 h-4" />
          Iniciar sesión como Admin
        </a>

        <p className="text-center mt-6 text-xs text-muted-foreground">
          Usamos Auth0 para autenticación segura.
        </p>
      </div>
    </div>
  );
}
