import { useState } from "react";
import { Link, useLocation } from "wouter";

import { AmberButton, MarketplaceShell } from "@/components/marketplace/public-shell";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { marketplaceAuth } from "@/lib/marketplace";
import { cn } from "@/lib/utils";

type Mode = "sign-in" | "sign-up";

function authErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "auth.error.invalidCredentials") return "Email o contraseña incorrectos.";
  if (message === "auth.error.rateLimited") return "Demasiados intentos. Probá en unos minutos.";
  if (message === "auth.error.timeout") return "El servidor tardó demasiado en responder. Intentá de nuevo.";
  if (message === "auth.error.network") return "No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.";
  return "No pudimos completar la operación. Intentá de nuevo.";
}

export default function MarketplaceSignInPage({ initialMode = "sign-in" }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, navigate] = useLocation();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "sign-up") {
        if (password.length < 12) throw new Error("auth.error.weakPassword");
        // Both assertions are required parameters of `signUp` rather than optional ones, and
        // the Worker refuses a sign-up that arrives without them — they are the record of what
        // the customer agreed to. So this form has to collect them and send them, rather than
        // assume them on somebody's behalf.
        await marketplaceAuth.signUp(email.trim(), password, name.trim(), {
          termsAccepted,
          ageConfirmed,
        });
      }
      await marketplaceAuth.signIn(email.trim(), password);
      // The session is an HttpOnly cookie the Worker just set. Reloading is the honest
      // way to re-read it across every query on the page rather than patching a cache.
      window.location.assign("/orders");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      setError(message === "auth.error.weakPassword" ? "La contraseña debe tener al menos 12 caracteres." : authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <MarketplaceShell>
      <div className="mx-auto max-w-md">
        <h1 className="mb-1 text-2xl font-semibold tracking-[-0.02em] text-foreground">
          {mode === "sign-in" ? "Ingresá a tu cuenta" : "Creá tu cuenta"}
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {mode === "sign-in"
            ? "Para ver tus pedidos, favoritos y direcciones."
            : "Es rápido: solo tu nombre, email y contraseña."}
        </p>

        <div className="mb-5 grid grid-cols-2 rounded-md border border-border bg-card p-1">
          {(["sign-in", "sign-up"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                setError(null);
              }}
              className={cn(
                "min-h-10 rounded text-sm font-medium transition",
                mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "sign-in" ? "Ingresar" : "Crear cuenta"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === "sign-up" ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Nombre</span>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                autoComplete="name"
                className="h-11 border-border bg-card placeholder:text-muted-foreground focus-visible:ring-primary"
              />
            </label>
          ) : null}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">Email</span>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              className="h-11 border-border bg-card placeholder:text-muted-foreground focus-visible:ring-primary"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">Contraseña</span>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={mode === "sign-up" ? 12 : undefined}
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              className="h-11 border-border bg-card placeholder:text-muted-foreground focus-visible:ring-primary"
            />
          </label>

          {mode === "sign-up" ? (
            <div className="flex flex-col gap-3">
              <label className="flex cursor-pointer items-start gap-2.5">
                <Checkbox
                  checked={ageConfirmed}
                  onCheckedChange={(value) => setAgeConfirmed(value === true)}
                  className="mt-0.5"
                />
                <span className="text-xs leading-5 text-muted-foreground">
                  Confirmo que tengo 18 años o más.
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-2.5">
                <Checkbox
                  checked={termsAccepted}
                  onCheckedChange={(value) => setTermsAccepted(value === true)}
                  className="mt-0.5"
                />
                <span className="text-xs leading-5 text-muted-foreground">
                  Acepto los{" "}
                  <a
                    href="/legal/terms-of-service"
                    target="_blank"
                    rel="noreferrer"
                    className="text-link hover:text-link/80"
                  >
                    Términos de Servicio
                  </a>{" "}
                  y la{" "}
                  <a
                    href="/legal/privacy-policy"
                    target="_blank"
                    rel="noreferrer"
                    className="text-link hover:text-link/80"
                  >
                    Política de Privacidad
                  </a>
                  .
                </span>
              </label>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <AmberButton
            type="submit"
            disabled={busy || (mode === "sign-up" && !(ageConfirmed && termsAccepted))}
            className="mt-1 w-full"
          >
            {busy ? "Un momento…" : mode === "sign-in" ? "Ingresar" : "Crear cuenta y continuar"}
          </AmberButton>
        </form>
        <p className="mt-6 text-xs text-muted-foreground">
          Una cuenta sirve para comprar, administrar un negocio o repartir. El acceso se
          habilita según los permisos de tu perfil después de iniciar sesión.
        </p>
      </div>
    </MarketplaceShell>
  );
}
