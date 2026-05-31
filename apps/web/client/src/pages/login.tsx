import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
// SSO: SAML auto-detect on login — see handleSubmit
import {
  Building2,
  Check,
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

function TrustItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/70 bg-white/55 p-3.5 shadow-[0_1px_0_rgba(15,23,42,0.03)] backdrop-blur">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#E1E6F0] bg-white">
        <Check className="h-3.5 w-3.5 text-[#4F46E5]" strokeWidth={2.4} />
      </div>
      <div>
        <p className="text-sm font-semibold text-[#111827]">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[#6B7280]">{value}</p>
      </div>
    </div>
  );
}

function WorkspacePreview() {
  return (
    <div className="mt-8 overflow-hidden rounded-[1.5rem] border border-[#E1E6F0] bg-white shadow-[0_24px_80px_rgba(79,70,229,0.10),0_1px_2px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between border-b border-[#EEF1F6] px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">PymesHub</p>
          <p className="mt-0.5 text-sm font-semibold text-[#111827]">Operación de hoy</p>
        </div>
        <span className="rounded-full border border-[#E1E6F0] bg-[#F8F9FF] px-2.5 py-1 text-[11px] font-semibold text-[#4F46E5]">
          En vivo
        </span>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-3">
        {[
          ["Inbox", "18", "4 sin asignar"],
          ["Facturas", "₡2.4M", "por cobrar"],
          ["Tareas", "9", "vencen hoy"],
        ].map(([label, value, note]) => (
          <div key={label} className="rounded-2xl border border-[#EEF1F6] bg-[#FAFBFF] p-3">
            <p className="text-[11px] font-medium text-[#6B7280]">{label}</p>
            <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[#111827]">{value}</p>
            <p className="mt-1 text-[11px] text-[#9CA3AF]">{note}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2.5 px-4 pb-4">
        <div className="flex items-center gap-3 rounded-2xl border border-[#EEF1F6] bg-white p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF2FF] text-xs font-bold text-[#4F46E5]">M</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#111827]">María pidió seguimiento por WhatsApp</p>
            <p className="text-xs text-[#6B7280]">Asignado a Ventas · hace 2 min</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-[#EEF1F6] bg-white p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F0FDF4] text-xs font-bold text-[#15803D]">AI</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#111827]">Agente sugirió una respuesta segura</p>
            <p className="text-xs text-[#6B7280]">Pendiente de revisión humana</p>
          </div>
        </div>
      </div>
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
    <div className="marketing-light-theme relative flex min-h-dvh flex-col overflow-hidden bg-[#F8F9FF]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-72 h-[34rem] w-[34rem] rounded-full bg-[#4F46E5]/[0.08] blur-3xl" />
        <div className="absolute -bottom-80 right-[-12rem] h-[38rem] w-[38rem] rounded-full bg-[#7C3AED]/[0.07] blur-3xl" />
      </div>

      <div className="relative z-10 flex shrink-0 items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Link href="/">
          <a className="rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/40 focus-visible:ring-offset-2">
            <BrandLockup compact />
          </a>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher variant="marketing" />
          <Link href="/register">
            <a className="inline-flex h-10 items-center rounded-full border border-[#DDE1EA] bg-white px-4 text-sm font-semibold text-[#111827] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-[#C9CEDA] hover:bg-[#FAFBFF]">
              {copy.createAccount}
            </a>
          </Link>
        </div>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center overflow-y-auto px-5 pb-8 pt-4 sm:px-8 lg:px-10">
        <div className="grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.08fr_0.92fr] xl:gap-12">
          <section className="hidden lg:block">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E1E5EF] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#4F46E5] shadow-[0_1px_2px_rgba(15,23,42,0.03)] backdrop-blur">
                <ShieldCheck className="h-3.5 w-3.5" />
                Workspace seguro para equipos de operación
              </div>
              <h1 className="mt-6 font-marketing text-[3.35rem] font-semibold leading-[0.96] tracking-[-0.065em] text-[#0F172A] xl:text-[4rem]">
                Entrá al centro operativo de tu negocio.
              </h1>
              <p className="mt-5 max-w-lg text-[15px] leading-7 text-[#5F6675]">
                PymesHub reúne conversaciones, clientes, tareas y facturación en una experiencia limpia para equipos que necesitan moverse rápido sin perder control.
              </p>

              <div className="mt-7 grid gap-3">
                <TrustItem label="Bandeja omnicanal" value="WhatsApp, correo y canales conectados con contexto de cliente." />
                <TrustItem label="CRM operativo" value="Clientes, tareas y oportunidades unidos al historial real de conversación." />
                <TrustItem label="Facturación y seguimiento" value="Comprobantes, cobros pendientes y handoffs visibles para el equipo." />
              </div>

              <WorkspacePreview />
            </div>
          </section>

          <section className="mx-auto w-full max-w-[27rem]">
            <div className="rounded-[1.6rem] border border-[#DDE1EA] bg-white p-7 shadow-[0_28px_90px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.04)] sm:p-8">
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

              {workspaceOptions.length > 0 ? (
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
                  <div>
                    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E4E7F0] bg-[#F8F9FF] text-[#4F46E5]">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <h2 className="font-marketing text-2xl font-semibold tracking-[-0.04em] text-[#111827]">
                      {copy.welcome}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                      {copy.description}
                    </p>
                  </div>

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
                            {copy.forgot}
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

                  <div className="my-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-[#EEF1F6]" />
                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">{copy.orContinueWith}</span>
                    <div className="h-px flex-1 bg-[#EEF1F6]" />
                  </div>

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

                  <div className="mt-6 rounded-2xl border border-[#EEF1F6] bg-[#FAFBFF] p-3.5">
                    <div className="flex gap-2.5">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#4F46E5]" />
                      <p className="text-xs leading-5 text-[#6B7280]">
                        Acceso protegido para tu workspace. La IA asiste, pero las acciones sensibles deben mantenerse bajo control humano.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <p className="mt-5 text-center text-xs leading-5 text-[#8A91A1]">
              PymesHub está construido para operaciones con datos de clientes, conversaciones y facturación. Protegé tus credenciales.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
