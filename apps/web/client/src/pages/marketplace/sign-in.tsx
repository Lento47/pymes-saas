import { useState } from "react";
import { Link, useLocation } from "wouter";

import { AmberButton, MarketplaceShell } from "@/components/marketplace/public-shell";
import { Input } from "@/components/ui/input";
import { marketplaceAuth } from "@/lib/marketplace";
import { cn } from "@/lib/utils";

type Mode = "sign-in" | "sign-up";

function authErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "auth.error.invalidCredentials") return "Email o contraseña incorrectos.";
  if (message === "auth.error.rateLimited") return "Demasiados intentos. Probá en unos minutos.";
  return "No pudimos completar la operación. Intentá de nuevo.";
}

export default function MarketplaceSignInPage() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, navigate] = useLocation();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "sign-up") {
        if (password.length < 8) throw new Error("auth.error.weakPassword");
        await marketplaceAuth.signUp(email.trim(), password, name.trim());
      }
      await marketplaceAuth.signIn(email.trim(), password);
      // The session is an HttpOnly cookie the Worker just set. Reloading is the honest
      // way to re-read it across every query on the page rather than patching a cache.
      window.location.assign("/orders");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      setError(message === "auth.error.weakPassword" ? "La contraseña debe tener al menos 8 caracteres." : authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <MarketplaceShell>
      <div className="mx-auto max-w-md">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-white">
          {mode === "sign-in" ? "Ingresá a tu cuenta" : "Creá tu cuenta"}
        </h1>
        <p className="mb-6 text-sm text-slate-400">
          {mode === "sign-in"
            ? "Para ver tus pedidos, favoritos y direcciones."
            : "Es rápido: solo tu nombre, email y contraseña."}
        </p>

        <div className="mb-5 grid grid-cols-2 rounded-lg border border-white/10 p-1">
          {(["sign-in", "sign-up"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                setError(null);
              }}
              className={cn(
                "min-h-10 rounded-md text-sm font-medium transition",
                mode === value ? "bg-amber-500 text-[#05091d]" : "text-slate-300 hover:text-white",
              )}
            >
              {value === "sign-in" ? "Ingresar" : "Crear cuenta"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === "sign-up" ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-slate-300">Nombre</span>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                autoComplete="name"
                className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-400 focus-visible:ring-amber-500"
              />
            </label>
          ) : null}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-slate-300">Email</span>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-400 focus-visible:ring-amber-500"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-slate-300">Contraseña</span>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-400 focus-visible:ring-amber-500"
            />
          </label>

          {error ? (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          ) : null}

          <AmberButton type="submit" disabled={busy} className="mt-1 w-full">
            {busy ? "Un momento…" : mode === "sign-in" ? "Ingresar" : "Crear cuenta y continuar"}
          </AmberButton>
        </form>

        <p className="mt-6 text-xs text-slate-400">
          ¿Tenés un negocio?{" "}
          <Link href="/login" className="text-amber-400 hover:text-amber-300">
            Entrá al panel de negocios
          </Link>
        </p>
      </div>
    </MarketplaceShell>
  );
}
