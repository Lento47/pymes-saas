import { useEffect, useState } from "react";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
// SSO: SAML auto-detect on login — see handleSubmit
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
import { useI18n } from "@/components/providers/i18n-provider";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

function parseError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
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
  const { messages } = useI18n();
  const copy = messages.login;
  const [email, setEmail]   = useState("");
  const [pass, setPass]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [workspaceOptions, setWorkspaceOptions] = useState<{ slug: string; name: string }[]>([]);

  const planParam = new URLSearchParams(window.location.search).get('plan');

  useEffect(() => {
    if (isAuthenticated) {
      const target = planParam ? `/settings/billing?plan=${planParam}` : "/";
      history.replaceState(null, "", target);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent, preselectedSlug?: string) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Check SAML first if we have a workspace slug
      if (preselectedSlug) {
        try {
          const saml = await api.checkSamlStatus(preselectedSlug);
          if (saml?.configured) {
            window.location.href = `/api/auth/saml/${preselectedSlug}/login`;
            return;
          }
        } catch { /* SAML check failed, proceed with normal login */ }
      }

      const res = await login(email, pass, preselectedSlug);
      const target = planParam ? `/settings/billing?plan=${planParam}` : "/";
      history.replaceState(null, "", target);
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.startsWith('MULTIPLE_WORKSPACES:')) {
        try {
          const workspaces = JSON.parse(msg.slice('MULTIPLE_WORKSPACES:'.length));
          setWorkspaceOptions(workspaces);
        } catch {}
      } else {
        setWorkspaceOptions([]);
        toast({ title: 'Error', description: msg, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-4 py-10 text-white md:px-6">
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
          <div className="mb-8 flex items-center justify-between gap-4">
            <Link href="/">
              <a className="font-marketing inline-flex items-center gap-2 text-sm font-medium text-white/68 transition hover:text-white">
                <ArrowLeft className="h-4 w-4" />
                {copy.back}
              </a>
            </Link>

            <LanguageSwitcher variant="marketing" />
          </div>

          <div className="glass-panel rounded-[34px] px-6 py-8 md:px-10 md:py-10">
            <BrandLockup className="justify-center" textClassName="text-xl tracking-[0.32em]" />

            {workspaceOptions.length > 0 ? (
              <div className="mt-10">
                <h2 className="text-center font-marketing text-xl font-semibold text-white">Seleccioná tu workspace</h2>
                <p className="mt-2 text-center text-sm text-white/60">Tenés acceso a múltiples workspaces</p>
                <div className="mt-6 space-y-3">
                  {workspaceOptions.map((ws) => (
                    <button
                      key={ws.slug}
                      onClick={(e) => { setWorkspaceOptions([]); handleSubmit(e, ws.slug); }}
                      disabled={loading}
                      className="w-full rounded-2xl border border-border bg-foreground/[0.04] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.08]"
                    >
                      <p className="text-sm font-semibold text-white">{ws.name}</p>
                      <p className="text-xs text-white/40">{ws.slug}</p>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setWorkspaceOptions([])}
                  className="mt-4 w-full text-center text-xs text-white/40 hover:text-white/60"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <>
            <div className="mt-10 text-center">
              <h1 className="font-marketing text-4xl font-semibold tracking-[-0.04em] text-white md:text-[3.45rem]">
                {copy.welcome}
              </h1>
              <p className="mx-auto mt-4 max-w-md text-base leading-8 text-[#c9d0f5]/72">
                {copy.description}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-10 space-y-6">
              <Field
                id="email"
                label={copy.email}
                type="email"
                placeholder={copy.placeholders.email}
                value={email}
                onChange={setEmail}
                required
                icon={<Mail className="h-5 w-5" />}
              />
              <Field
                id="password"
                label={copy.password}
                type={showPassword ? "text" : "password"}
                placeholder={copy.placeholders.password}
                value={pass}
                onChange={setPass}
                required
                icon={<LockKeyhole className="h-5 w-5" />}
                rightAdornment={
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="text-white/55 transition hover:text-white/85"
                    aria-label={showPassword ? copy.hidePassword : copy.showPassword}
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
                {copy.logIn}
                <ArrowRight className="h-5 w-5" />
              </button>
            </form>

            <div className="mt-8">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-sm text-white/46">{copy.forgot}</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Link href="/accept-invite">
                  <a className="glass-panel-soft font-marketing flex items-center justify-center rounded-[20px] px-5 py-4 text-sm font-semibold text-white/86 transition hover:border-white/18 hover:text-white">
                    {copy.acceptInvite}
                  </a>
                </Link>
                <Link href="/legal">
                  <a className="glass-panel-soft font-marketing flex items-center justify-center rounded-[20px] px-5 py-4 text-sm font-semibold text-white/86 transition hover:border-white/18 hover:text-white">
                    {copy.legalCenter}
                  </a>
                </Link>
              </div>
            </div>
            </>
            )}

            <div className="mt-10 flex flex-col items-center gap-4 text-center">
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-white/58">
                <Link href="/legal/terms-and-conditions">
                  <a className="transition hover:text-white/82">{copy.terms}</a>
                </Link>
                <span className="h-1 w-1 rounded-full bg-white/24" />
                <Link href="/legal/privacy-policy">
                  <a className="transition hover:text-white/82">{copy.privacy}</a>
                </Link>
              </div>

              <p className="text-sm text-[#b3bcdf]/58">
                {copy.noWorkspace}{" "}
                <Link href="/">
                  <a className="font-medium text-[#dfff4a] transition hover:text-[#efff8a]">
                    {copy.explore}
                  </a>
                </Link>
              </p>

              <p className="text-sm text-[#b3bcdf]/58">
                <Link href="/register">
                  <a className="font-medium text-[#dfff4a] transition hover:text-[#efff8a]">
                    Create account →
                  </a>
                </Link>
              </p>

              <p className="text-xs uppercase tracking-[0.22em] text-white/34">
                © {new Date().getFullYear()} PymesHub
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
