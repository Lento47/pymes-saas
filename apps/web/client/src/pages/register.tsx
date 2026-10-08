import { useState } from "react";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LockKeyhole, Mail, User } from "lucide-react";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { ChamferedSubmit } from "@/components/marketing/cta-button";
import { Input } from "@/components/arc/input/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const BG_DEEP = "#05091d";
const DOT_GRID = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Ccircle cx='1' cy='1' r='1' fill='rgba(245%2C158%2C11%2C0.10)'/%3E%3C/svg%3E")`;

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
  } catch {
    /* ignore */
  }
  return rest || m;
}

function FieldIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-400/60">
      {children}
    </div>
  );
}

export default function RegisterPage() {
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pass !== confirm) {
      toast({ title: "Las contraseñas no coinciden", variant: "destructive" });
      return;
    }
    // Both assertions are checked here so the reader is told which one is missing
    // before a round trip. The server still refuses an omitted field — this is the
    // form being honest, not the guard, and `auth.service.ts:register()` is what
    // actually enforces it.
    if (!ageConfirmed) {
      toast({
        title: "Confirmá que tenés 18 años o más",
        variant: "destructive",
      });
      return;
    }
    if (!termsAccepted) {
      toast({
        title: "Aceptá los Términos de Servicio",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await api.register({
        email,
        name,
        password: pass,
        terms_accepted: termsAccepted,
        age_confirmed: ageConfirmed,
      });
      localStorage.setItem("pymes_token", res.access_token);
      localStorage.setItem("pymes_refresh_token", res.refresh_token);
      localStorage.setItem("pymes_slug", res.workspace.slug);
      await refreshUser();
      window.location.hash = "#/onboarding";
    } catch (err) {
      toast({
        title: "Error al crear cuenta",
        description: parseError(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-10"
      style={{ background: BG_DEEP, backgroundImage: DOT_GRID }}
    >
      {/* ── Ambient amber glow ── */}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2"
        style={{
          top: "-20%",
          width: 700,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(245,158,11,0.10) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* ── Card ── */}
      <div className="relative z-10 w-full max-w-[26.5rem]">
        <div
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#070c24]/90 px-7 py-8 backdrop-blur-2xl"
          style={{
            boxShadow:
              "0 0 0 1px rgba(245,158,11,0.05), 0 32px 64px rgba(0,0,0,0.6), 0 0 80px rgba(245,158,11,0.06)",
          }}
        >
          {/* Subtle top glow line */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(245,158,11,0.5) 50%, transparent 100%)",
            }}
          />

          {/* ── Brand lockup ── */}
          <BrandLockup className="justify-center" textClassName="text-lg" />

          {/* ── Heading ── */}
          <div className="mt-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Crear cuenta
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Registra tu negocio gratis — sin tarjeta de crédito
            </p>
          </div>

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div className="space-y-1.5">
              <div className="relative">
                <FieldIcon>
                  <User className="h-4 w-4" />
                </FieldIcon>
                <Input
                  label="Nombre completo"
                  type="text"
                  placeholder="María García"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-11 rounded-[10px] border-white/10 bg-white/[0.04] pl-10 text-sm text-white/90 placeholder:text-white/25 focus-visible:border-amber-400/50 focus-visible:ring-amber-500/25"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="relative">
                <FieldIcon>
                  <Mail className="h-4 w-4" />
                </FieldIcon>
                <Input
                  label="Correo electrónico"
                  type="email"
                  placeholder="nombre@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 rounded-[10px] border-white/10 bg-white/[0.04] pl-10 text-sm text-white/90 placeholder:text-white/25 focus-visible:border-amber-400/50 focus-visible:ring-amber-500/25"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="relative">
                <FieldIcon>
                  <LockKeyhole className="h-4 w-4" />
                </FieldIcon>
                <Input
                  label="Contraseña"
                  type="password"
                  placeholder="Mín. 12 caracteres"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  required
                  className="h-11 rounded-[10px] border-white/10 bg-white/[0.04] pl-10 text-sm text-white/90 placeholder:text-white/25 focus-visible:border-amber-400/50 focus-visible:ring-amber-500/25"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="relative">
                <FieldIcon>
                  <LockKeyhole className="h-4 w-4" />
                </FieldIcon>
                <Input
                  label="Confirmar contraseña"
                  type="password"
                  placeholder="••••••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="h-11 rounded-[10px] border-white/10 bg-white/[0.04] pl-10 text-sm text-white/90 placeholder:text-white/25 focus-visible:border-amber-400/50 focus-visible:ring-amber-500/25"
                />
              </div>
            </div>

            {/* ── Age confirmation ── */}
            <label className="flex cursor-pointer items-start gap-2.5">
              <Checkbox
                checked={ageConfirmed}
                onCheckedChange={(v) => setAgeConfirmed(v === true)}
                className="mt-0.5 border-white/25 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
              />
              <span className="text-xs leading-5 text-white/65">
                Confirmo que tengo{" "}
                <strong className="text-white/85">18 años o más</strong>.
                PymesHub es un servicio profesional no apto para menores de
                edad.
              </span>
            </label>

            {/* ── Terms ── */}
            <label className="flex cursor-pointer items-start gap-2.5">
              <Checkbox
                checked={termsAccepted}
                onCheckedChange={(v) => setTermsAccepted(v === true)}
                className="mt-0.5 border-white/25 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
              />
              <span className="text-xs leading-5 text-white/65">
                Acepto los{" "}
                <a
                  href="/legal/terms-of-service"
                  target="_blank"
                  className="text-amber-400 underline hover:text-amber-300"
                >
                  Términos de Servicio
                </a>{" "}
                y la{" "}
                <a
                  href="/legal/privacy-policy"
                  target="_blank"
                  className="text-amber-400 underline hover:text-amber-300"
                >
                  Política de Privacidad
                </a>
                .
              </span>
            </label>

            {/* ── Submit ── */}
            <ChamferedSubmit
              disabled={loading || !ageConfirmed || !termsAccepted}
              pending={
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Crear cuenta
                </span>
              }
            >
              Crear cuenta
            </ChamferedSubmit>
          </form>

          {/* ── Footer ── */}
          <div className="mt-7 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-white/60">
              ¿Ya tienes cuenta?{" "}
              <Link
                href="/login"
                className="font-medium text-amber-400 transition hover:text-amber-300"
              >
                Iniciar sesión
              </Link>
            </p>
            <p className="text-xs uppercase tracking-[0.1em] text-white/40">
              &copy; {new Date().getFullYear()} PymesHub S.A., Limón, Costa Rica
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
