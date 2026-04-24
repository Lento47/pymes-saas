import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { BrandLockup } from "@/components/marketing/brand-lockup";

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
  hint,
  rightAdornment,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  icon: React.ReactNode;
  hint?: string;
  rightAdornment?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <label
        htmlFor={id}
        className="font-marketing block text-sm font-medium text-white/88"
      >
        {label}
      </label>
      <div className="group flex items-center gap-3 rounded-[20px] border border-white/12 bg-[#09102b]/82 px-4 py-4 transition focus-within:border-[#b9c7ff]/35 focus-within:bg-[#0b1333]/92">
        <span className="text-white/60">{icon}</span>
        <input
          id={id}
          data-testid={`input-${id}`}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-[#8f97bc] md:text-[15px]"
        />
        {rightAdornment}
      </div>
      {hint && <p className="text-xs leading-6 text-[#a9b3df]/60">{hint}</p>}
    </div>
  );
}

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [slug, setSlug]     = useState("");
  const [email, setEmail]   = useState("");
  const [pass, setPass]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) window.location.hash = "#/";
  }, [isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, pass, slug);
      window.location.hash = "#/";
    } catch (err) {
      toast({ title: "Error al iniciar sesión", description: parseError(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05091d] px-4 py-10 text-white md:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative w-[max(1536px,100vw,calc(100vh*1.5))]">
              <img
                src="/images/login-bg.png"
                alt=""
                aria-hidden="true"
                loading="eager"
                className="block h-auto w-full max-w-none opacity-[0.88]"
              />
            </div>
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(42,60,180,0.12),transparent_36%),linear-gradient(180deg,rgba(3,8,24,0.06),rgba(5,9,29,0.48)_36%,#05091d_100%)]" />
        </div>
        <div className="animate-pulse-halo absolute -left-[23rem] top-[-3rem] h-[48rem] w-[48rem] rounded-full border border-[#dfff4a]/22 shadow-[0_0_120px_rgba(223,255,74,0.18)]" />
        <div className="absolute -left-[17rem] top-[3rem] h-[38rem] w-[38rem] rounded-full border border-[#6c7eff]/18" />
        <div className="absolute bottom-[10%] right-[6%] h-48 w-48 rounded-full bg-[#dfff4a]/12 blur-[110px]" />
      </div>

      <div className="relative z-10 flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <div className="w-full max-w-[34rem]">
          <Link href="/">
            <a className="font-marketing mb-8 inline-flex items-center gap-2 text-sm font-medium text-white/68 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to landing
            </a>
          </Link>

          <div className="glass-panel rounded-[34px] px-6 py-8 md:px-10 md:py-10">
            <BrandLockup className="justify-center" textClassName="text-xl tracking-[0.32em]" />

            <div className="mt-10 text-center">
              <h1 className="font-marketing text-4xl font-semibold tracking-[-0.04em] text-white md:text-[3.45rem]">
                Welcome back
              </h1>
              <p className="mx-auto mt-4 max-w-md text-base leading-8 text-[#c9d0f5]/72">
                Log in to continue managing conversations, invoices, and team workflows from one workspace.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-10 space-y-6">
              <Field
                id="workspace-slug"
                label="Workspace slug"
                placeholder="mi-empresa"
                value={slug}
                onChange={setSlug}
                required
                icon={<Building2 className="h-5 w-5" />}
                hint="Use the workspace identifier you were invited to."
              />
              <Field
                id="email"
                label="Email address"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={setEmail}
                required
                icon={<Mail className="h-5 w-5" />}
              />
              <Field
                id="password"
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={pass}
                onChange={setPass}
                required
                icon={<LockKeyhole className="h-5 w-5" />}
                rightAdornment={
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="text-white/55 transition hover:text-white/85"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                }
              />

              <button
                type="submit"
                disabled={loading}
                data-testid="button-login"
                className="glow-button font-marketing inline-flex w-full items-center justify-center gap-3 rounded-full bg-[linear-gradient(90deg,#efff53_0%,#ddff47_55%,#78efd0_100%)] px-6 py-4 text-lg font-semibold text-[#071126] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                Log in
                <ArrowRight className="h-5 w-5" />
              </button>
            </form>

            <div className="mt-8">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-sm text-white/46">Need another route?</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Link href="/accept-invite">
                  <a className="glass-panel-soft font-marketing flex items-center justify-center rounded-[20px] px-5 py-4 text-sm font-semibold text-white/86 transition hover:border-white/18 hover:text-white">
                    Accept an invite
                  </a>
                </Link>
                <Link href="/legal">
                  <a className="glass-panel-soft font-marketing flex items-center justify-center rounded-[20px] px-5 py-4 text-sm font-semibold text-white/86 transition hover:border-white/18 hover:text-white">
                    Legal center
                  </a>
                </Link>
              </div>
            </div>

            <div className="mt-10 flex flex-col items-center gap-4 text-center">
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-white/58">
                <Link href="/legal/terms-and-conditions">
                  <a className="transition hover:text-white/82">Terms</a>
                </Link>
                <span className="h-1 w-1 rounded-full bg-white/24" />
                <Link href="/legal/privacy-policy">
                  <a className="transition hover:text-white/82">Privacy</a>
                </Link>
              </div>

              <p className="text-sm text-[#b3bcdf]/58">
                Don&apos;t have a workspace yet?{" "}
                <Link href="/">
                  <a className="font-medium text-[#dfff4a] transition hover:text-[#efff8a]">
                    Explore the platform
                  </a>
                </Link>
              </p>

              <p className="text-xs uppercase tracking-[0.22em] text-white/34">
                © {new Date().getFullYear()} PymeHub
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
