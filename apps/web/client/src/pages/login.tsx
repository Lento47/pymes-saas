import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
// SSO: SAML auto-detect on login — see handleSubmit
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  ChevronUp,
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
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-[#111827]">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 transition-all focus-within:border-[#4F46E5]/40 focus-within:ring-2 focus-within:ring-[#4F46E5]/10">
        <span className="text-[#9CA3AF]">{icon}</span>
        <input
          id={id}
          data-testid={`input-${id}`}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="min-w-0 flex-1 bg-transparent text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF]"
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
    <div className="flex h-dvh flex-col overflow-hidden bg-[#F7F8FC]">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between px-6 py-3">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] transition hover:text-[#111827]">
          <ArrowLeft className="h-4 w-4" />
          {copy.back}
        </Link>
        <LanguageSwitcher variant="marketing" />
      </div>

      {/* Center content — scrollable if content taller than screen */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-4 min-h-0">
        <div className="w-full max-w-[22rem]">

          {/* Card */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-8 shadow-sm">

            <BrandLockup className="justify-center" />

            {/* Expired session banner */}
            {expired && (
              <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-[#FEF9F0] px-4 py-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-amber-700">Tu sesión ha expirado</p>
                  <p className="mt-0.5 text-xs leading-5 text-amber-600">
                    Por seguridad, la sesión se cierra después de 30 minutos de inactividad.
                  </p>
                </div>
              </div>
            )}

            {/* Workspace picker */}
            {workspaceOptions.length > 0 ? (
              <div className="mt-6">
                <h2 className="text-center text-lg font-semibold text-[#111827]">
                  {copy.workspacePickerTitle}
                </h2>
                <p className="mt-1.5 text-center text-sm text-[#6B7280]">
                  {copy.workspacePickerDescription}
                </p>
                <div className="mt-5 space-y-2">
                  {workspaceOptions.map((ws) => (
                    <button
                      key={ws.slug}
                      onClick={(e) => { setWorkspaceOptions([]); handleSubmit(e, ws.slug); }}
                      disabled={loading}
                      className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-3 text-left transition hover:border-[#D1D5DB] hover:bg-[#F7F8FC] disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className="h-4 w-4 shrink-0 text-[#6B7280]" />
                        <div>
                          <p className="text-sm font-medium text-[#111827]">{ws.name}</p>
                          <p className="text-xs text-[#6B7280]">{ws.slug}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setWorkspaceOptions([])}
                  className="mt-4 w-full text-center text-xs text-[#6B7280] transition hover:text-[#111827]"
                >
                  {copy.cancel}
                </button>
              </div>
            ) : (
              <>
                {/* Heading */}
                <div className="mt-6">
                  <h1 className="text-xl font-semibold text-[#111827]">{copy.welcome}</h1>
                  <p className="mt-1 text-sm text-[#6B7280]">{copy.description}</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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
                        className="text-[#9CA3AF] transition hover:text-[#6B7280]"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                  />

                  <button
                    type="submit"
                    disabled={loading}
                    data-testid="button-login"
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-[#4F46E5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      copy.logIn
                    )}
                  </button>
                </form>

                {/* SSO section */}
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setSsoExpanded((v) => !v)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#E5E7EB] px-4 py-2.5 text-sm font-medium text-[#6B7280] transition hover:border-[#D1D5DB] hover:text-[#111827]"
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
                      {/* Facebook */}
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof FB === 'undefined') return;
                          FB.login((resp: Record<string, any>) => {
                            if (resp?.authResponse?.accessToken) (window as any).handleFbLogin(resp.authResponse.accessToken);
                          }, { config_id: '1375303354406780', scope: 'public_profile' });
                        }}
                        className="inline-flex w-full items-center justify-center gap-3 rounded-lg border border-[#E5E7EB] px-4 py-2.5 text-sm font-medium text-[#374151] transition hover:bg-[#F7F8FC]"
                      >
                        <svg className="h-4 w-4" style={{ color: "#1877F2" }} viewBox="0 0 24 24" fill="currentColor">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                        {copy.facebookLogin}
                      </button>

                      {/* Telegram */}
                      <div className="flex justify-center">
                        <div id="telegram-login-btn" className="w-full" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <p className="mt-6 text-center text-sm text-[#6B7280]">
                  {copy.noWorkspace}{" "}
                  <Link href="/register" className="font-medium text-[#4F46E5] transition hover:text-[#4338CA]">
                    {copy.createAccount}
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
