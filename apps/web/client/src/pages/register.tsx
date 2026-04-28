import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/components/providers/i18n-provider";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  User,
} from "lucide-react";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

type RegistrationSuccess = {
  workspaceName: string;
  workspaceSlug: string;
};

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
      <label htmlFor={id} className="font-marketing block text-sm font-medium text-white/88">
        {label}
      </label>
      <div className="group flex items-center gap-3 rounded-[20px] border border-white/12 bg-[#09102b]/82 px-4 py-4 transition focus-within:border-[#b9c7ff]/35 focus-within:bg-[#0b1333]/92">
        <span className="text-white/60">{icon}</span>
        <input
          id={id}
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

export default function RegisterPage() {
  const { register } = useAuth();
  const { toast } = useToast();
  const { messages } = useI18n();
  const reg = messages.register;

  const planParam = new URLSearchParams(
    window.location.hash.replace("#", "").split("?")[1] || "",
  ).get("plan");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<RegistrationSuccess | null>(null);

  const workspaceUrl = success ? `${window.location.origin}/#/${success.workspaceSlug}` : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await register({ name, email, password: pass });
      const workspace = res.workspace ?? res.user?.workspace;
      if (!workspace?.slug) {
        throw new Error("Registration completed, but the workspace slug was not returned.");
      }
      setSuccess({
        workspaceName: workspace.name ?? `${name}'s Workspace`,
        workspaceSlug: workspace.slug,
      });
    } catch (err) {
      toast({
        title: reg.failed,
        description: parseError(err, "Something went wrong. Please try again."),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyWorkspace = async () => {
    if (!success) return;
    const value = `Workspace slug: ${success.workspaceSlug}\nLogin URL: ${workspaceUrl}`;
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Workspace details copied" });
    } catch {
      toast({ title: "Copy failed", description: success.workspaceSlug });
    }
  };

  const continueToWorkspace = () => {
    const target = planParam ? `/billing?paddle=success&plan=${planParam}` : "/";
    history.replaceState(null, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const passwordRules = [
    { label: reg.lengthRule, met: pass.length >= 8 },
    { label: reg.uppercaseRule, met: /[A-Z]/.test(pass) },
    { label: reg.lowercaseRule, met: /[a-z]/.test(pass) },
    { label: reg.numberRule, met: /\d/.test(pass) },
    { label: "One special character", met: /[^\w\s]/.test(pass) },
  ];

  return (
    <div className="dark relative min-h-screen overflow-hidden bg-background px-4 py-10 md:px-6">
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
            <Link href="/login">
              <a className="font-marketing inline-flex items-center gap-2 text-sm font-medium text-white/68 transition hover:text-white">
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </a>
            </Link>
            <LanguageSwitcher variant="marketing" />
          </div>

          <div className="glass-panel rounded-[34px] px-6 py-8 md:px-10 md:py-10">
            <BrandLockup className="justify-center" textClassName="text-xl tracking-[0.32em]" />

            {success ? (
              <div className="mt-10 space-y-7">
                <div className="text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-[#dfff4a]" />
                  <h1 className="font-marketing mt-5 text-4xl font-semibold tracking-[-0.04em] text-white md:text-[3.1rem]">
                    Workspace created
                  </h1>
                  <p className="mx-auto mt-4 max-w-md text-base leading-8 text-[#c9d0f5]/72">
                    Save this workspace slug. You will need it when logging in.
                  </p>
                </div>

                <div className="space-y-4 rounded-[24px] border border-white/12 bg-[#09102b]/82 p-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/40">Workspace</p>
                    <p className="mt-1 text-sm font-medium text-white">{success.workspaceName}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/40">Slug</p>
                    <p className="mt-1 break-all font-mono text-lg font-semibold text-[#dfff4a]">
                      {success.workspaceSlug}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/40">Login URL</p>
                    <p className="mt-1 break-all text-sm text-white/78">{workspaceUrl}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={copyWorkspace}
                  className="font-marketing flex w-full items-center justify-center gap-2 rounded-full border border-white/14 px-6 py-4 text-sm font-semibold text-white/86 transition hover:border-white/24 hover:text-white"
                >
                  <Copy className="h-4 w-4" />
                  Copy workspace details
                </button>

                <button
                  type="button"
                  onClick={continueToWorkspace}
                  className="glow-button font-marketing inline-flex w-full items-center justify-center gap-3 rounded-full bg-[linear-gradient(90deg,#efff53_0%,#ddff47_55%,#78efd0_100%)] px-6 py-4 text-lg font-semibold text-[#071126] transition hover:translate-y-[-1px]"
                >
                  Continue to workspace
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <>
                <div className="mt-10 text-center">
                  <h1 className="font-marketing text-4xl font-semibold tracking-[-0.04em] text-white md:text-[3.1rem]">
                    Create account
                  </h1>
                  <p className="mx-auto mt-4 max-w-md text-base leading-8 text-[#c9d0f5]/72">
                    {planParam
                      ? `You're signing up for the ${planParam} plan. Fill in your details to get started.`
                      : "Start your free workspace in seconds. No credit card required."}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="mt-10 space-y-6">
                  <Field
                    id="name"
                    label={reg.fullName}
                    placeholder="Maria Gonzalez"
                    value={name}
                    onChange={setName}
                    required
                    icon={<User className="h-5 w-5" />}
                  />
                  <Field
                    id="email"
                    label={reg.emailAddress}
                    type="email"
                    placeholder="maria@empresa.com"
                    value={email}
                    onChange={setEmail}
                    required
                    icon={<Mail className="h-5 w-5" />}
                  />
                  <Field
                    id="password"
                    label={reg.password}
                    type={showPassword ? "text" : "password"}
                    placeholder="12+ characters"
                    value={pass}
                    onChange={setPass}
                    required
                    icon={<LockKeyhole className="h-5 w-5" />}
                    hint="Must contain uppercase, lowercase, a number, and a special character."
                    rightAdornment={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="text-white/55 transition hover:text-white/85"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    }
                  />

                  <div className="grid gap-2">
                    {passwordRules.map((rule) => (
                      <span key={rule.label} className={`text-xs ${rule.met ? "text-green-400" : "text-white/40"}`}>
                        {rule.met ? "✓" : "○"} {rule.label}
                      </span>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || pass.length < 12}
                    className="glow-button font-marketing inline-flex w-full items-center justify-center gap-3 rounded-full bg-[linear-gradient(90deg,#efff53_0%,#ddff47_55%,#78efd0_100%)] px-6 py-4 text-lg font-semibold text-[#071126] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                    {loading ? reg.creating : reg.createAccount}
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </form>
              </>
            )}

            <div className="mt-8 flex flex-col items-center gap-4 text-center">
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
                Already have an account?{" "}
                <Link href="/login">
                  <a className="font-medium text-[#dfff4a] transition hover:text-[#efff8a]">
                    Log in →
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
