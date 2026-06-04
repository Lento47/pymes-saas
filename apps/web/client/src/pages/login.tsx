import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
// SSO: SAML auto-detect on login — see handleSubmit
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
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
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-[#111827]">
        {label}
      </label>
      <div className="flex min-h-11 items-center gap-2.5 rounded-xl border border-[#DDE1EA] bg-white px-3.5 py-2.5 shadow-[0_1px_0_rgba(15,23,42,0.02)] transition-all focus-within:border-[#4F46E5]/45 focus-within:ring-4 focus-within:ring-[#4F46E5]/10">
        <span className="text-[#9CA3AF]">{icon}</span>
        <input
          id={id}
          data-testid={`input-${id}`}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="min-w-0 flex-1 bg-transparent text-[14px] text-[#111827] outline-none placeholder:text-[#A0A7B5]"
        />
        {rightAdornment}
      </div>
      {hint && <p className="text-xs leading-relaxed text-[#6B7280]">{hint}</p>}
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
  const [ssoExpanded, setSsoExpanded] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
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

  // Telegram widget — inject script once the SSO section is visible in the DOM
  useEffect(() => {
    if (!ssoExpanded) return;
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
  }, [ssoExpanded]);

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
    document.documentElement.classList.add('marketing-page');
    return () => document.documentElement.classList.remove('marketing-page');
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
      const msg = (err as Error)?.message || '';
      if (msg.startsWith('MULTIPLE_WORKSPACES:')) {
        try { setWorkspaceOptions(JSON.parse(msg.slice('MULTIPLE_WORKSPACES:'.length))); } catch {}
      } else if (msg.startsWith('EMAIL_NOT_VERIFIED:')) {
        setWorkspaceOptions([]);
        setEmailNotVerified(true);
      } else {
        setWorkspaceOptions([]);
        toast({ title: copy.loginErrorTitle, description: msg, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    try {
      const { api } = await import('@/lib/api');
      await api.resendVerificationByEmail(email);
      setResendSent(true);
    } catch {
      setResendSent(true); // always show success to avoid enumeration
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="auth-bg marketing-light-theme flex h-dvh flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between px-6 pb-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}>

        <Link href="/">
          <a className="rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/40">
            <BrandLockup compact />
          </a>
        </Link>
        <div className="flex items-center gap-4">
          <LanguageSwitcher variant="marketing" />
          <Link href="/register">
            <a className="text-sm font-medium text-[#6B7280] transition hover:text-[#111827]">
              {copy.createAccount}
            </a>
          </Link>
        </div>
      </div>

      {/* Centered content */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-10 min-h-0">
        <div className="w-full max-w-[27rem]">

          {/* Auth card */}
          <div className="rounded-[1.6rem] border border-[#DDE1EA] bg-white p-7 shadow-[0_28px_90px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.04)] sm:p-8">

            {/* Expired session banner */}
            {expired && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-[#FEF9F0] px-4 py-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Tu sesión ha expirado</p>
                  <p className="mt-0.5 text-xs leading-5 text-amber-700">
                    Por seguridad, la sesión se cierra después de 30 minutos de inactividad.
                  </p>
                </div>
              </div>
            )}

            {/* Email-not-verified gate */}
            {emailNotVerified && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm space-y-3">
                <p className="font-semibold text-amber-800">Verificá tu email para continuar</p>
                <p className="text-amber-700 text-xs leading-5">
                  Enviamos un enlace de verificación a <strong>{email}</strong> cuando creaste tu cuenta.
                  Revisá tu bandeja de entrada (y la carpeta de spam).
                </p>
                {resendSent ? (
                  <p className="text-xs font-medium text-amber-800">Enlace reenviado. Revisá tu email.</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendLoading}
                    className="text-xs font-semibold text-amber-800 underline underline-offset-2 hover:no-underline disabled:opacity-50"
                  >
                    {resendLoading ? 'Enviando…' : 'Reenviar enlace de verificación'}
                  </button>
                )}
              </div>
            )}

            {/* Workspace picker */}
            {!emailNotVerified && workspaceOptions.length > 0 ? (
              <div>
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E4E7F0] bg-[#F8F9FF] text-[#4F46E5]">
                  <Building2 className="h-5 w-5" />
                </div>
                <h2 className="mt-4 font-marketing text-center text-2xl font-semibold tracking-[-0.035em] text-[#111827]">
                  {copy.workspacePickerTitle}
                </h2>
                <p className="mt-2 text-center text-sm leading-6 text-[#6B7280]">
                  {copy.workspacePickerDescription}
                </p>
                <div className="mt-6 space-y-2">
                  {workspaceOptions.map((ws) => (
                    <button
                      key={ws.slug}
                      onClick={(e) => { setWorkspaceOptions([]); handleSubmit(e, ws.slug); }}
                      disabled={loading}
                      className="w-full rounded-2xl border border-[#DDE1EA] bg-white px-3.5 py-3 text-left transition hover:border-[#C9CEDA] hover:bg-[#FAFBFF] disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E4E7F0] bg-[#F8F9FF] text-[#6B7280]">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#111827]">{ws.name}</p>
                          <p className="text-xs text-[#6B7280]">{ws.slug}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setWorkspaceOptions([])}
                  className="mt-5 w-full text-center text-xs font-medium text-[#6B7280] transition hover:text-[#111827]"
                >
                  {copy.cancel}
                </button>
              </div>
            ) : (
              <>
                {/* Heading */}
                <div>
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E4E7F0] bg-[#F8F9FF] text-[#4F46E5]">
                    <ShieldCheck className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <h1 className="font-marketing text-[1.875rem] font-semibold leading-tight tracking-[-0.03em] text-[#111827]">
                    {copy.welcome}
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                    {copy.description}
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
                  <div className="space-y-1.5">
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
                          className="rounded-md p-1 text-[#9CA3AF] transition hover:bg-[#F3F4F6] hover:text-[#6B7280]"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      }
                    />
                    <div className="flex justify-end">
                      <Link href="/forgot-password">
                        <a className="text-xs font-medium text-[#4F46E5] transition hover:text-[#4338CA]">
                          {copy.forgot ?? "¿Olvidaste tu contraseña?"}
                        </a>
                      </Link>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    data-testid="button-login"
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#4F46E5] px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(79,70,229,0.24)] transition hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : copy.logIn}
                  </button>
                </form>

                {/* Divider */}
                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#EEF1F6]" />
                  <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
                    {copy.orContinueWith ?? "o continuá con"}
                  </span>
                  <div className="h-px flex-1 bg-[#EEF1F6]" />
                </div>

                {/* SSO — secondary, collapsed by default */}
                <button
                  type="button"
                  onClick={() => setSsoExpanded((v) => !v)}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#DDE1EA] bg-white px-4 text-sm font-semibold text-[#374151] transition hover:border-[#C9CEDA] hover:bg-[#FAFBFF]"
                >
                  {ssoExpanded ? (
                    <>
                      {copy.hideSso ?? "Ocultar opciones"}
                      <ChevronUp className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      {copy.ssoButton ?? "Continuar con SSO"}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>

                {ssoExpanded && (
                  <div className="mt-2 space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof FB === 'undefined') return;
                        FB.login((resp: Record<string, any>) => {
                          if (resp?.authResponse?.accessToken) (window as any).handleFbLogin(resp.authResponse.accessToken);
                        }, { config_id: '1375303354406780', scope: 'public_profile' });
                      }}
                      className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-[#DDE1EA] bg-white px-4 text-sm font-medium text-[#374151] transition hover:bg-[#FAFBFF]"
                    >
                      <svg className="h-4 w-4" style={{ color: "#1877F2" }} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      {copy.facebookLogin}
                    </button>

                    <div className="flex justify-center rounded-xl border border-[#DDE1EA] bg-white p-2">
                      <div id="telegram-login-btn" className="w-full" />
                    </div>
                  </div>
                )}

                {/* Security note — inside card */}
                <div className="mt-6 rounded-2xl border border-[#EEF1F6] bg-[#FAFBFF] p-3.5">
                  <div className="flex gap-2.5">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#4F46E5]" strokeWidth={1.75} />
                    <p className="text-xs leading-5 text-[#6B7280]">
                      Acceso protegido para tu workspace. La IA asiste, pero las acciones sensibles requieren control humano.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer note */}
          <p className="mt-5 text-center text-xs leading-5 text-[#8A91A1]">
            PymesHub está construido para operaciones con datos de clientes, conversaciones y facturación.
          </p>

        </div>
      </div>
    </div>
  );
}
