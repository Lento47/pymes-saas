import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
// SSO: SAML auto-detect on login — see handleSubmit
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Clock,
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
        className="block text-xs font-medium text-muted-foreground"
      >
        {label}
      </label>
      <div className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10">
        <span className="text-muted-foreground">{icon}</span>
        <input
          id={id}
          data-testid={`input-${id}`}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/55"
        />
        {rightAdornment}
      </div>
      {hint && <p className="text-xs leading-6 text-muted-foreground">{hint}</p>}
    </div>
  );
}

declare const FB: Record<string, any>; // Facebook SDK injected by index.html

export default function LoginPage() {
  const { login, loginWithSsoCode, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { messages } = useI18n();
  const copy = messages.login;
  const [email, setEmail]   = useState("");
  const [pass, setPass]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [workspaceOptions, setWorkspaceOptions] = useState<{ slug: string; name: string }[]>([]);

  const planParam = new URLSearchParams(window.location.search).get('plan');
  const addonParam = new URLSearchParams(window.location.search).get('addon');
  const expired = new URLSearchParams(window.location.search).get('expired') === 'true';

  const buildTarget = () => {
    const params = new URLSearchParams();
    if (planParam) params.set('plan', planParam);
    if (addonParam) params.set('addon', addonParam);
    const qs = params.toString();
    return qs ? `/settings/billing?${qs}` : '/';
  };

  useEffect(() => {
    if (isAuthenticated) {
      const target = buildTarget();
      history.replaceState(null, "", target);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [isAuthenticated]);

  // Handle SAML / Google OAuth callback. The API redirects here with
  // ?code=<60s-jwt>&slug=<workspaceSlug> instead of putting access /
  // refresh tokens directly in the URL (C4 fix). We redeem the code
  // via POST /auth/sso-exchange, then strip it from the URL so a
  // refresh doesn't try to redeem an already-consumed code.
  useEffect(() => {
    const getParam = (name: string) => {
      const search = new URLSearchParams(window.location.search).get(name);
      if (search) return search;
      const hash = window.location.hash;
      const qi = hash.indexOf("?");
      return qi >= 0 ? (new URLSearchParams(hash.slice(qi + 1)).get(name) ?? null) : null;
    };
    const ssoError = getParam("error");
    if (ssoError === "sso_failed" || ssoError === "google_auth_failed" || ssoError === "facebook_auth_failed") {
      toast({ title: "Error", description: "No pudimos completar el inicio de sesión SSO.", variant: "destructive" });
      history.replaceState(null, "", "/login");
      return;
    }
    const code = getParam("code");
    if (!code) return;
    setLoading(true);
    loginWithSsoCode(code)
      .then(() => {
        history.replaceState(null, "", "/");
        window.location.reload();
      })
      .catch((err: unknown) => {
        toast({ title: "Error", description: (err as any)?.message || "Código SSO inválido o expirado.", variant: "destructive" });
        history.replaceState(null, "", "/login");
      })
      .finally(() => setLoading(false));
  }, []);

  // Initialize Telegram widget — inject script as child of login div so button renders inline
  useEffect(() => {
    const container = document.getElementById('telegram-login-btn');
    if (!container || container.children.length > 0) return;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?23';
    script.setAttribute('data-telegram-login', 'pymeshubbyBot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    container.appendChild(script);
  }, []);

  // Telegram Login Widget callback — fires when user completes auth
  useEffect(() => {
    (window as any).onTelegramAuth = (user: Record<string, any>) => {
      if (!user?.id) return;
      setLoading(true);
      api.telegramTokenLogin(user)
        .then(res => loginWithSsoCode(res.code))
        .then(() => {
          history.replaceState(null, "", "/");
          window.location.reload();
        })
        .catch(() => {
          toast({ title: "Error", description: "No pudimos completar el inicio de sesión con Telegram.", variant: "destructive" });
        })
        .finally(() => setLoading(false));
    };
  }, []);

  // Facebook SDK callback — fires when user completes the FB.login() dialog.
  useEffect(() => {
    (window as any).handleFbLogin = (accessToken?: string) => {
      if (typeof FB === 'undefined' && !accessToken) return;
      if (accessToken) {
        loginWithFbToken(accessToken);
        return;
      }
      FB.getLoginStatus((response: Record<string, any>) => {
        if (response.status === 'connected') {
          loginWithFbToken(response.authResponse.accessToken);
        }
      });
    };
    const loginWithFbToken = (token: string) => {
      setLoading(true);
      api.facebookTokenLogin(token)
        .then(res => loginWithSsoCode(res.code))
        .then(() => {
          history.replaceState(null, "", "/");
          window.location.reload();
        })
        .catch(() => {
          toast({ title: "Error", description: "No pudimos completar el inicio de sesión con Facebook.", variant: "destructive" });
        })
        .finally(() => setLoading(false));
    };
  }, []);

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
      const target = buildTarget();
      history.replaceState(null, "", target);
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (err: unknown) {
      const msg = (err as any)?.message || '';
      if (msg.startsWith('MULTIPLE_WORKSPACES:')) {
        try {
          const workspaces = JSON.parse(msg.slice('MULTIPLE_WORKSPACES:'.length));
          setWorkspaceOptions(workspaces);
        } catch {}
      } else {
        setWorkspaceOptions([]);
        toast({ title: copy.loginErrorTitle, description: msg, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-4 py-10 md:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-border" />

      <div className="relative z-10 flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <div className="w-full max-w-[34rem]">
          <div className="mb-8 flex items-center justify-between gap-4">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              {copy.back}
            </Link>

            <LanguageSwitcher variant="marketing" />
          </div>

          <div className="rounded-lg border border-border bg-card px-6 py-8 md:px-10 md:py-10">
            <BrandLockup className="justify-center" textClassName="text-xl" />

            {expired && (
              <div className="mt-8 rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-4 text-center">
                <Clock className="mx-auto mb-2 h-5 w-5 text-amber-400" />
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                  Tu sesión ha expirado
                </p>
                <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/80">
                  Por seguridad, la sesión se cierra después de 30 minutos de inactividad. Ingresa de nuevo para continuar.
                </p>
              </div>
            )}

            {workspaceOptions.length > 0 ? (
              <div className="mt-10">
                <h2 className="text-center text-xl font-semibold text-foreground">{copy.workspacePickerTitle}</h2>
                <p className="mt-2 text-center text-sm text-muted-foreground">{copy.workspacePickerDescription}</p>
                <div className="mt-6 space-y-3">
                  {workspaceOptions.map((ws) => (
                    <button
                      key={ws.slug}
                      onClick={(e) => { setWorkspaceOptions([]); handleSubmit(e, ws.slug); }}
                      disabled={loading}
                      className="w-full rounded-lg border border-border bg-background p-4 text-left transition hover:bg-muted/35"
                    >
                      <p className="text-sm font-semibold text-foreground">{ws.name}</p>
                      <p className="text-xs text-muted-foreground">{ws.slug}</p>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setWorkspaceOptions([])}
                  className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
                >
                  {copy.cancel}
                </button>
              </div>
            ) : (
              <>
            <div className="mt-10 text-center">
              <h1 className="text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">
                {copy.welcome}
              </h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
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
                    className="text-muted-foreground transition hover:text-foreground"
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                {copy.logIn}
                <ArrowRight className="h-5 w-5" />
              </button>
            </form>

            <div className="mt-6">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">{copy.orContinueWith}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              {/* Facebook circular — uses FB.login() with config_id */}
              <button type="button"
                onClick={() => {
                  if (typeof FB === 'undefined') return;
                  FB.login((resp: Record<string, any>) => {
                    if (resp?.authResponse?.accessToken) (window as any).handleFbLogin(resp.authResponse.accessToken);
                  }, { config_id: '1375303354406780', scope: 'public_profile' });
                }}
                className="mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-3 rounded-md border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted/35"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                {copy.facebookLogin}
              </button>

              {/* Telegram Login Widget — visible */}
              <div className="mt-4 flex justify-center">
                <div id="telegram-login-btn" className="w-full" />
              </div>

              {/* Google — hidden */}
              {false && (<a
                href="/api/auth/google"
                className="mt-4 bg-white font-marketing inline-flex w-full items-center justify-center gap-3 rounded-full px-6 py-4 text-lg font-semibold text-gray-800 transition hover:translate-y-[-1px] hover:bg-gray-100"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/><path fill="none" d="M1 1h22v22H1z"/></svg>
                {copy.googleLogin}
              </a>)}

              {/* Facebook fallback circular — hidden (roto, SDK ya funciona) */}
              {false && (<a
                href="/api/auth/facebook"
                id="fb-login-fallback"
                className="mt-3 bg-[#1877F2] font-marketing inline-flex w-full items-center justify-center gap-3 rounded-full px-6 py-4 text-lg font-semibold text-white transition hover:translate-y-[-1px] hover:bg-[#166fe5]"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                {copy.facebookLogin}
              </a>)}
            </div>

            <div className="mt-8">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">{copy.forgot}</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Link href="/accept-invite" className="flex items-center justify-center rounded-md border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted/35">
                  {copy.acceptInvite}
                </Link>
                <Link href="/legal" className="flex items-center justify-center rounded-md border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted/35">
                  {copy.legalCenter}
                </Link>
              </div>
            </div>
            </>
            )}

            <div className="mt-10 flex flex-col items-center gap-4 text-center">
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
                <Link href="/legal/terms-of-service" className="transition hover:text-foreground">{copy.terms}</Link>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                <Link href="/legal/privacy-policy" className="transition hover:text-foreground">{copy.privacy}</Link>
              </div>

              <p className="text-sm text-muted-foreground">
                {copy.noWorkspace}{" "}
                <Link href="/" className="font-medium text-primary transition hover:text-primary/80">
                  {copy.explore}
                </Link>
              </p>

              <p className="text-sm text-muted-foreground">
                <Link href="/register" className="font-medium text-primary transition hover:text-primary/80">
                  Create account →
                </Link>
              </p>

              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                &copy; {new Date().getFullYear()} PymesHub S.A., Lim&oacute;n, Costa Rica
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
