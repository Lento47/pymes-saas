import { useState } from 'react';
import { AlertTriangle, CheckCircle2, LifeBuoy, Loader2, Search, ShieldCheck, Wrench, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface DiagnosticButtonProps {
  module: string;
  className?: string;
}

const CATEGORY_BADGE: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  USER_GUIDANCE: { bg: 'bg-blue-500/10', text: 'text-blue-300', icon: <LifeBuoy className="h-3 w-3" /> },
  PERMISSION_ISSUE: { bg: 'bg-amber-500/10', text: 'text-amber-300', icon: <ShieldCheck className="h-3 w-3" /> },
  WORKSPACE_CONFIGURATION: { bg: 'bg-violet-500/10', text: 'text-violet-300', icon: <Wrench className="h-3 w-3" /> },
  INTEGRATION_ISSUE: { bg: 'bg-orange-500/10', text: 'text-orange-300', icon: <AlertTriangle className="h-3 w-3" /> },
  PRODUCT_BUG: { bg: 'bg-red-500/10', text: 'text-red-300', icon: <XCircle className="h-3 w-3" /> },
  BILLING_OR_PLAN: { bg: 'bg-yellow-500/10', text: 'text-yellow-300', icon: <AlertTriangle className="h-3 w-3" /> },
  SECURITY_OR_PRIVACY: { bg: 'bg-red-600/10', text: 'text-red-400', icon: <ShieldCheck className="h-3 w-3" /> },
  PLATFORM_INCIDENT: { bg: 'bg-red-700/10', text: 'text-red-500', icon: <AlertTriangle className="h-3 w-3" /> },
};

const RISK_COLOR: Record<string, string> = {
  low: 'text-emerald-400',
  medium: 'text-amber-400',
  high: 'text-orange-400',
  critical: 'text-red-500',
};

export function DiagnosticButton({ module, className }: DiagnosticButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDiagnose = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.runDiagnostic(module);
      setResult(res);
    } catch (err: any) {
      setError(err?.message || 'No se pudo completar el diagnóstico');
    } finally {
      setLoading(false);
    }
  };

  const categoryInfo = result ? CATEGORY_BADGE[result.category] || CATEGORY_BADGE.USER_GUIDANCE : null;

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={handleDiagnose}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all duration-200 hover:scale-[1.02] disabled:opacity-50"
        style={{
          background: 'hsl(var(--foreground) / 0.04)',
          border: '1px solid hsl(var(--foreground) / 0.06)',
          color: 'hsl(var(--fg-2))',
        }}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Search className="h-3 w-3" />
        )}
        Diagnosticar
      </button>

      {result && (
        <div
          className="mt-3 rounded-xl border p-4 text-left"
          style={{
            background: 'hsl(var(--bg-card) / 0.8)',
            borderColor: 'hsl(var(--border))',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            {categoryInfo && (
              <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', categoryInfo.bg, categoryInfo.text)}>
                {categoryInfo.icon}
                {result.category.replace(/_/g, ' ')}
              </span>
            )}
            <span className={cn('text-[10px] font-semibold uppercase tracking-wide', RISK_COLOR[result.risk_level] || 'text-muted-foreground')}>
              {result.risk_level} risk
            </span>
          </div>

          {result.known_issue && (
            <div className="mb-3 rounded-lg px-3 py-2 text-[11px]" style={{ background: 'hsl(var(--warning) / 0.08)', border: '1px solid hsl(var(--warning) / 0.15)' }}>
              <p className="font-medium text-amber-300">Known issue: {result.known_issue.title}</p>
              {result.known_issue.workaround && (
                <p className="mt-1 text-muted-foreground">Workaround: {result.known_issue.workaround}</p>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground leading-relaxed">{result.recommendation}</p>

          <div className="mt-2 pt-2 border-t border-border/60 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            <span className="text-[10px] text-muted-foreground">Case {result.case_id?.slice(0, 8)} created</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 text-[11px] text-red-400">{error}</div>
      )}
    </div>
  );
}
