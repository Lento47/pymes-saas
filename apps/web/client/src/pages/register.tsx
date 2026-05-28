import { useState } from "react";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LockKeyhole, Mail, User } from "lucide-react";
import { BrandLockup } from "@/components/marketing/brand-lockup";

const BG_DEEP = "#030712";

const DOT_GRID = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Ccircle cx='1' cy='1' r='1' fill='rgba(139%2C92%2C246%2C0.18)'/%3E%3C/svg%3E")`;

function parseError(err: unknown): string {
  if (!(err instanceof Error)) return "Error desconocido";
  const m = err.message;
  const after = m.indexOf(": ");
  if (after < 0) return m;
  const rest = m.slice(after + 2);
  try {
    const p = JSON.parse(rest) as { message?: string | string[] };
    if (Array.isArray(p.message)) return p.message.join(", ");
    if (typeof p.message === "string") return p.message;
  } catch { /* ignore */ }
  return rest || m;
}

function Field({
  id,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  required,
  icon,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.72)", display: "block" }}>
        {label}
      </label>
      <div
        className="flex items-center gap-3 px-3 py-3 transition-all duration-200 focus-within:ring-2 focus-within:ring-violet-500/25 focus-within:border-violet-400/50"
        style={{
          borderRadius: 10,
          border: "1px solid rgba(139,92,246,0.18)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <span style={{ color: "rgba(139,92,246,0.6)" }}>{icon}</span>
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            outline: "none",
            border: "none",
            fontSize: 14,
            color: "rgba(255,255,255,0.9)",
          }}
          className="placeholder:text-white/25 focus:outline-none"
        />
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const [name, setName]             = useState("");
  const [email, setEmail]           = useState("");
  const [pass, setPass]             = useState("");
  const [confirm, setConfirm]       = useState("");
  const [ageConfirmed, setAgeConfirmed]   = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading]       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pass !== confirm) {
      toast({ title: "Las contraseñas no coinciden", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await api.register({ email, name, password: pass, terms_accepted: termsAccepted });
      // store tokens using the same keys as lib/api.ts (setAuthState)
      localStorage.setItem("pymes_token", res.access_token);
      localStorage.setItem("pymes_refresh_token", res.refresh_token);
      localStorage.setItem("pymes_slug", res.workspace.slug);
      await refreshUser();
      window.location.hash = "#/onboarding";
    } catch (err) {
      toast({ title: "Error al crear cuenta", description: parseError(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center"
      style={{ background: BG_DEEP, backgroundImage: DOT_GRID, padding: "24px" }}
    >
      {/* Ambient violet glow */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: "-20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 700,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at center, rgba(124,58,237,0.18) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <div className="relative z-10 w-full max-w-[26rem]">
        {/* Card */}
        <div
          className="relative overflow-hidden"
          style={{
            borderRadius: 16,
            border: "1px solid rgba(139,92,246,0.22)",
            background: "rgba(15,10,30,0.85)",
            backdropFilter: "blur(24px)",
            boxShadow: "0 0 0 1px rgba(139,92,246,0.06), 0 32px 64px rgba(0,0,0,0.6), 0 0 80px rgba(124,58,237,0.08)",
            padding: "2rem 2rem 2rem",
          }}
        >
          {/* Subtle top glow line */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.5) 50%, transparent 100%)" }}
          />

          <BrandLockup className="justify-center" textClassName="text-lg" />

          <div className="mt-7 text-center">
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{
                background: "linear-gradient(135deg, #ffffff 40%, #c4b5fd 80%, #818cf8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Crear cuenta
            </h1>
            <p className="mt-2 text-sm leading-6" style={{ color: "rgba(255,255,255,0.65)" }}>
              Registra tu negocio gratis — sin tarjeta de crédito
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <Field id="name" label="Nombre completo" placeholder="María García" value={name} onChange={setName} required icon={<User className="h-4 w-4" />} />
            <Field id="email" label="Correo electrónico" type="email" placeholder="nombre@empresa.com" value={email} onChange={setEmail} required icon={<Mail className="h-4 w-4" />} />
            <Field id="password" label="Contraseña" type="password" placeholder="Mín. 12 caracteres" value={pass} onChange={setPass} required icon={<LockKeyhole className="h-4 w-4" />} />
            <Field id="confirm" label="Confirmar contraseña" type="password" placeholder="••••••••••••" value={confirm} onChange={setConfirm} required icon={<LockKeyhole className="h-4 w-4" />} />

            <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
              <input
                type="checkbox"
                required
                checked={ageConfirmed}
                onChange={e => setAgeConfirmed(e.target.checked)}
                style={{ marginTop: "2px", width: "14px", height: "14px", flexShrink: 0, accentColor: "#8b5cf6" }}
              />
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.65)", lineHeight: "1.5" }}>
                Confirmo que tengo <strong style={{ color: "rgba(255,255,255,0.85)" }}>18 años o más</strong>. PymesHub es un servicio profesional no apto para menores de edad.
              </span>
            </label>

            <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
              <input
                type="checkbox"
                required
                checked={termsAccepted}
                onChange={e => setTermsAccepted(e.target.checked)}
                style={{ marginTop: "2px", width: "14px", height: "14px", flexShrink: 0, accentColor: "#8b5cf6" }}
              />
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.65)", lineHeight: "1.5" }}>
                Acepto los{" "}
                <a href="/legal/terms-of-service" target="_blank" style={{ color: "#a78bfa", textDecoration: "underline" }}>
                  Términos de Servicio
                </a>{" "}
                y la{" "}
                <a href="/legal/privacy-policy" target="_blank" style={{ color: "#a78bfa", textDecoration: "underline" }}>
                  Política de Privacidad
                </a>
                .
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !ageConfirmed || !termsAccepted}
              className="relative mt-2 inline-flex w-full items-center justify-center gap-2 font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                borderRadius: 10,
                padding: "13px 20px",
                fontSize: 14,
                background: loading
                  ? "rgba(124,58,237,0.5)"
                  : "linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)",
                color: "#fff",
                boxShadow: "0 0 24px rgba(124,58,237,0.35), 0 1px 3px rgba(0,0,0,0.4)",
                border: "1px solid rgba(167,139,250,0.25)",
              }}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Crear cuenta"
              )}
            </button>
          </form>

          <div className="mt-7 flex flex-col items-center gap-3 text-center">
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.60)" }}>
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="font-medium transition" style={{ color: "#a78bfa" }}>
                Iniciar sesión
              </Link>
            </p>

            <p className="text-xs" style={{ color: "rgba(255,255,255,0.40)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              &copy; {new Date().getFullYear()} PymesHub S.A., Lim&oacute;n, Costa Rica
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
