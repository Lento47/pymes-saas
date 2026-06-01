import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LockKeyhole, Mail, User } from "lucide-react";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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

function FieldIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-400/60">
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
    setLoading(true);
    try {
      const res = await api.register({ email, name, password: pass, terms_accepted: termsAccepted });
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
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-10"
      style={{ background: BG_DEEP, backgroundImage: DOT_GRID }}
    >
      {/* ── Ambient violet glow ── */}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2"
        style={{
          top: "-20%",
          width: 700,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at center, rgba(124,58,237,0.18) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* ── Card ── */}
      <div className="relative z-10 w-full max-w-[26.5rem]">
        <div
          className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-[rgba(15,10,30,0.85)] px-7 py-8 backdrop-blur-2xl"
          style={{
            boxShadow: "0 0 0 1px rgba(139,92,246,0.06), 0 32px 64px rgba(0,0,0,0.6), 0 0 80px rgba(124,58,237,0.08)",
          }}
        >
          {/* Subtle top glow line */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.5) 50%, transparent 100%)" }}
          />

          {/* ── Brand lockup ── */}
          <BrandLockup className="justify-center" textClassName="text-lg" />

          {/* ── Heading ── */}
          <div className="mt-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-purple-200 to-indigo-400">
              Crear cuenta
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Registra tu negocio gratis — sin tarjeta de crédito
            </p>
          </div>

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs text-white/70">Nombre completo</Label>
              <div className="relative">
                <FieldIcon><User className="h-4 w-4" /></FieldIcon>
                <Input
                  id="name"
                  type="text"
                  placeholder="María García"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-11 rounded-[10px] border-violet-500/20 bg-white/[0.03] pl-10 text-sm text-white/90 placeholder:text-white/25 focus-visible:border-violet-400/50 focus-visible:ring-violet-500/25"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-white/70">Correo electrónico</Label>
              <div className="relative">
                <FieldIcon><Mail className="h-4 w-4" /></FieldIcon>
                <Input
                  id="email"
                  type="email"
                  placeholder="nombre@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 rounded-[10px] border-violet-500/20 bg-white/[0.03] pl-10 text-sm text-white/90 placeholder:text-white/25 focus-visible:border-violet-400/50 focus-visible:ring-violet-500/25"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs text-white/70">Contraseña</Label>
              <div className="relative">
                <FieldIcon><LockKeyhole className="h-4 w-4" /></FieldIcon>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mín. 12 caracteres"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  required
                  className="h-11 rounded-[10px] border-violet-500/20 bg-white/[0.03] pl-10 text-sm text-white/90 placeholder:text-white/25 focus-visible:border-violet-400/50 focus-visible:ring-violet-500/25"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-xs text-white/70">Confirmar contraseña</Label>
              <div className="relative">
                <FieldIcon><LockKeyhole className="h-4 w-4" /></FieldIcon>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="••••••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="h-11 rounded-[10px] border-violet-500/20 bg-white/[0.03] pl-10 text-sm text-white/90 placeholder:text-white/25 focus-visible:border-violet-400/50 focus-visible:ring-violet-500/25"
                />
              </div>
            </div>

            {/* ── Age confirmation ── */}
            <label className="flex cursor-pointer items-start gap-2.5">
              <Checkbox
                checked={ageConfirmed}
                onCheckedChange={(v) => setAgeConfirmed(v === true)}
                className="mt-0.5 border-violet-500/30 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
              />
              <span className="text-xs leading-5 text-white/65">
                Confirmo que tengo <strong className="text-white/85">18 años o más</strong>. PymesHub es un servicio profesional no apto para menores de edad.
              </span>
            </label>

            {/* ── Terms ── */}
            <label className="flex cursor-pointer items-start gap-2.5">
              <Checkbox
                checked={termsAccepted}
                onCheckedChange={(v) => setTermsAccepted(v === true)}
                className="mt-0.5 border-violet-500/30 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
              />
              <span className="text-xs leading-5 text-white/65">
                Acepto los{" "}
                <a href="/legal/terms-of-service" target="_blank" className="text-violet-400 underline hover:text-violet-300">
                  Términos de Servicio
                </a>{" "}
                y la{" "}
                <a href="/legal/privacy-policy" target="_blank" className="text-violet-400 underline hover:text-violet-300">
                  Política de Privacidad
                </a>
                .
              </span>
            </label>

            {/* ── Submit ── */}
            <Button
              type="submit"
              disabled={loading || !ageConfirmed || !termsAccepted}
              className="h-[46px] w-full rounded-[10px] border border-violet-400/25 bg-gradient-to-br from-violet-600 to-indigo-500 text-sm font-semibold text-white shadow-[0_0_24px_rgba(124,58,237,0.35),0_1px_3px_rgba(0,0,0,0.4)] hover:from-violet-500 hover:to-indigo-400 disabled:from-violet-600/50 disabled:to-indigo-500/50 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear cuenta"}
            </Button>
          </form>

          {/* ── Footer ── */}
          <div className="mt-7 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-white/60">
              ¿Ya tienes cuenta?{" "}
              <a href="#/login" className="font-medium text-violet-400 transition hover:text-violet-300">
                Iniciar sesión
              </a>
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
