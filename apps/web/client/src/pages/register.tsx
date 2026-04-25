import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  User,
} from "lucide-react";
import { BrandLockup } from "@/components/marketing/brand-lockup";
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

export default function RegisterPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.register({ name, email, password });
      // Auto-login after registration
      await login(email, password, res.workspace?.slug ?? res.user?.workspace?.slug);
    } catch (err) {
      toast({ title: "Registration failed", description: parseError(err, "Please check your details.") });
    } finally {
      setLoading(false);
    }
  };

  const passwordRules = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One lowercase letter", met: /[a-z]/.test(password) },
    { label: "One number", met: /\d/.test(password) },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05091d] px-4 py-12">
      <div className="w-full max-w-[432px] space-y-8">
        {/* Header */}
        <div className="flex justify-center">
          <BrandLockup />
        </div>

        {/* Card */}
        <div className="glass-panel luminous-border rounded-3xl p-8 md:p-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center">
              <h1 className="font-marketing text-3xl font-extrabold tracking-[-0.03em] text-white">
                Create account
              </h1>
              <p className="mt-2 text-sm text-white/60">
                Set up your workspace and start managing your business.
              </p>
            </div>

            {/* Name */}
            <div className="space-y-3">
              <label htmlFor="name" className="font-marketing block text-sm font-medium text-white/88">
                Full name
              </label>
              <div className="group flex items-center gap-3 rounded-[20px] border border-white/12 bg-[#09102b]/82 px-4 py-4 transition focus-within:border-[#b9c7ff]/35 focus-within:bg-[#0b1333]/92">
                <span className="text-white/60"><User size={18} /></span>
                <input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-[#8f97bc] md:text-[15px]"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-3">
              <label htmlFor="email" className="font-marketing block text-sm font-medium text-white/88">
                Email address
              </label>
              <div className="group flex items-center gap-3 rounded-[20px] border border-white/12 bg-[#09102b]/82 px-4 py-4 transition focus-within:border-[#b9c7ff]/35 focus-within:bg-[#0b1333]/92">
                <span className="text-white/60"><Mail size={18} /></span>
                <input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-[#8f97bc] md:text-[15px]"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-3">
              <label htmlFor="password" className="font-marketing block text-sm font-medium text-white/88">
                Password
              </label>
              <div className="group flex items-center gap-3 rounded-[20px] border border-white/12 bg-[#09102b]/82 px-4 py-4 transition focus-within:border-[#b9c7ff]/35 focus-within:bg-[#0b1333]/92">
                <span className="text-white/60"><LockKeyhole size={18} /></span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 chars, upper, lower, number"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-[#8f97bc] md:text-[15px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-white/50 hover:text-white/80 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="space-y-1 mt-2">
                {passwordRules.map((rule) => (
                  <div key={rule.label} className="flex items-center gap-2">
                    <span className={`text-xs ${rule.met ? 'text-green-400' : 'text-white/40'}`}>
                      {rule.met ? '✓' : '○'} {rule.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !name || !email || password.length < 8}
              className="glow-button font-marketing flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(90deg,#efff53_0%,#dfff4a_55%,#7ff4d2_100%)] px-6 py-4 text-sm font-semibold text-[#071126] transition hover:translate-y-[-1px] active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Create account <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-white/50">
          Already have an account?{" "}
          <Link href="/login">
            <span className="font-marketing text-[#dfff4a] hover:underline cursor-pointer">
              Log in
            </span>
          </Link>
        </p>
      </div>

      <div className="fixed top-4 right-4">
        <LanguageSwitcher variant="marketing" />
      </div>
    </div>
  );
}
