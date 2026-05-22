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

const BG_DEEP = "#030712";

const DOT_GRID = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Ccircle cx='1' cy='1' r='1' fill='rgba(139%2C92%2C246%2C0.18)'/%3E%3C/svg%3E")`;

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
    <div className="space-y-2">
      <label htmlFor={id} style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.45)", display: "block" }}>
        {label}
      </label>
      <div
        className="group flex items-center gap-3 px-3 py-2.5 transition-all duration-200"
        style={{
          borderRadius: 10,
          border: "1px solid rgba(139,92,246,0.18)",
          background: "rgba(255,255,255,0.03)",
        }}
        onFocus={() => {}}
      >
        <span style={{ color: "rgba(139,92,246,0.6)" }}>{icon}</span>
        <input
          id={id}
          data-testid={`input-${id}`}
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
        {rightAdornment}
      </div>
      {hint && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>{hint}</p>}
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

  // Handle SAML / Google OAuth callback
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

  // Telegram widget
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

  useEffect(() => {
    (window as any).handleFbLogin = (accessToken?: string) => {
      if (typeof FB === 'undefined' && !accessToken) return;
      if (accessToken) { loginWithFbToken(accessToken); return; }
      FB.getLoginStatus((response: Record<string, any>) => {
        if (response.status === 'connected') loginWithFbToken(response.authResponse.accessToken);
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
      if (preselectedSlug) {
        try {
          const saml = await api.checkSamlStatus(preselectedSlug);
          if (saml?.configured) {
            window.location.href = `/api/auth/saml/${preselectedSlug}/login`;
            return;
          }
        } catch { /* proceed with normal login */ }
      }
      await login(email, pass, preselectedSlug);
      const target = buildTarget();
      history.replaceState(null, "", target);
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (err: unknown) {
      const msg = (err as any)?.message || '';
      if (msg.startsWith('MULTIPLE_WORKSPACES:')) {
        try { setWorkspaceOptions(JSON.parse(msg.slice('MULTIPLE_WORKSPACES:'.length))); } catch {}
      } else {
        setWorkspaceOptions([]);
        toast({ title: copy.loginErrorTitle, description: msg, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden flex flex-col"
      style={{ background: BG_DEEP, backgroundImage: DOT_GRID }}
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

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-5">
        <Link href="/" className="inline-flex items-center gap-2 text-sm transition" style={{ color: "rgba(255,255,255,0.45)" }}>
          <ArrowLeft className="h-4 w-4" />
          {copy.back}
        </Link>
        <LanguageSwitcher variant="marketing" />
      </div>

      {/* Center content */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[26rem]">

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

            {/* Expired session banner */}
            {expired && (
              <div
                className="mt-6 flex items-start gap-3 rounded-xl px-4 py-3"
                style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}
              >
                <Clock className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#a78bfa" }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#c4b5fd" }}>Tu sesión ha expirado</p>
                  <p className="mt-0.5 text-xs leading-5" style={{ color: "rgba(196,181,253,0.65)" }}>
                    Por seguridad, la sesión se cierra después de 30 minutos de inactividad.
                  </p>
                </div>
              </div>
            )}

            {/* Workspace picker */}
            {workspaceOptions.length > 0 ? (
              <div className="mt-8">
                <h2 className="text-center text-lg font-semibold" style={{ color: "rgba(255,255,255,0.92)" }}>
                  {copy.workspacePickerTitle}
                </h2>
                <p className="mt-1.5 text-center text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {copy.workspacePickerDescription}
                </p>
                <div className="mt-5 space-y-2">
                  {workspaceOptions.map((ws) => (
                    <button
                      key={ws.slug}
                      onClick={(e) => { setWorkspaceOptions([]); handleSubmit(e, ws.slug); }}
                      disabled={loading}
                      className="group w-full text-left transition-all duration-200"
                      style={{
                        borderRadius: 10,
                        border: "1px solid rgba(139,92,246,0.18)",
                        background: "rgba(255,255,255,0.03)",
                        padding: "12px 14px",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className="h-4 w-4 shrink-0" style={{ color: "#8b5cf6" }} />
                        <div>
                          <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.88)" }}>{ws.name}</p>
                          <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{ws.slug}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setWorkspaceOptions([])}
                  className="mt-4 w-full text-center text-xs transition hover:opacity-80"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  {copy.cancel}
                </button>
              </div>
            ) : (
              <>
                {/* Heading */}
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
                    {copy.welcome}
                  </h1>
                  <p className="mt-2 text-sm leading-6" style={{ color: "rgba(255,255,255,0.38)" }}>
                    {copy.description}
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                  <Field
                    id="email"
                    label={copy.email}
                    type="email"
                    placeholder={copy.placeholders.email}
                    value={email}
                    onChange={setEmail}
                    required
                    icon={<Mail className="h-4 w-4" />}
                  />
                  <Field
                    id="password"
                    label={copy.password}
                    type={showPassword ? "text" : "password"}
                    placeholder={copy.placeholders.password}
                    value={pass}
                    onChange={setPass}
                    required
                    icon={<LockKeyhole className="h-4 w-4" />}
                    rightAdornment={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                        style={{ color: "rgba(255,255,255,0.3)" }}
                        className="transition hover:text-white/60"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                  />

                  <button
                    type="submit"
                    disabled={loading}
                    data-testid="button-login"
                    className="relative mt-2 inline-flex w-full items-center justify-center gap-2 font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      borderRadius: 10,
                      padding: "11px 20px",
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
                      <>
                        {copy.logIn}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Divider + SSO */}
                <div className="mt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1" style={{ background: "rgba(139,92,246,0.15)" }} />
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.28)" }}>{copy.orContinueWith}</span>
                    <div className="h-px flex-1" style={{ background: "rgba(139,92,246,0.15)" }} />
                  </div>

                  {/* Facebook */}
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof FB === 'undefined') return;
                      FB.login((resp: Record<string, any>) => {
                        if (resp?.authResponse?.accessToken) (window as any).handleFbLogin(resp.authResponse.accessToken);
                      }, { config_id: '1375303354406780', scope: 'public_profile' });
                    }}
                    className="mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-3 text-sm font-semibold transition-all duration-200"
                    style={{
                      borderRadius: 10,
                      padding: "10px 20px",
                      border: "1px solid rgba(139,92,246,0.18)",
                      background: "rgba(255,255,255,0.03)",
                      color: "rgba(255,255,255,0.75)",
                    }}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    {copy.facebookLogin}
                  </button>

                  {/* Telegram */}
                  <div className="mt-3 flex justify-center">
                    <div id="telegram-login-btn" className="w-full" />
                  </div>
                </div>

                {/* Footer links */}
                <div className="mt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1" style={{ background: "rgba(139,92,246,0.12)" }} />
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.22)" }}>{copy.forgot}</span>
                    <div className="h-px flex-1" style={{ background: "rgba(139,92,246,0.12)" }} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {[
                      { href: "/accept-invite", label: copy.acceptInvite },
                      { href: "/legal", label: copy.legalCenter },
                    ].map(({ href, label }) => (
                      <Link
                        key={href}
                        href={href}
                        className="flex items-center justify-center text-xs font-medium transition-all duration-200"
                        style={{
                          borderRadius: 8,
                          padding: "9px 12px",
                          border: "1px solid rgba(139,92,246,0.14)",
                          background: "rgba(255,255,255,0.02)",
                          color: "rgba(255,255,255,0.45)",
                        }}
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Bottom: terms + register */}
            <div className="mt-7 flex flex-col items-center gap-3 text-center">
              <div className="flex items-center gap-3 text-xs" style={{ color: "rgba(255,255,255,0.28)" }}>
                <Link href="/legal/terms-of-service" className="transition hover:text-white/50">{copy.terms}</Link>
                <span className="h-1 w-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
                <Link href="/legal/privacy-policy" className="transition hover:text-white/50">{copy.privacy}</Link>
              </div>

              <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                {copy.noWorkspace}{" "}
                <Link href="/" className="font-medium transition" style={{ color: "#a78bfa" }}>
                  {copy.explore}
                </Link>
              </p>

              <p className="text-sm">
                <Link href="/register" className="font-medium transition" style={{ color: "#a78bfa" }}>
                  Crear cuenta →
                </Link>
              </p>

              <p className="text-xs" style={{ color: "rgba(255,255,255,0.18)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                &copy; {new Date().getFullYear()} PymesHub S.A., Lim&oacute;n, Costa Rica
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
