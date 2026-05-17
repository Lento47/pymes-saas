import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Info,
  Sparkles,
} from "lucide-react";

type InsightSeverity = "danger" | "warning" | "positive" | "info";

interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  suggestion: string;
  value?: number;
  change_pct?: number;
  change_label?: string;
}

const SEVERITY_STYLES: Record<InsightSeverity, { border: string; icon: string; badge: string }> = {
  danger:   { border: "hsl(0 70% 50%)",    icon: "hsl(0 70% 55%)",    badge: "hsl(0 70% 15%)" },
  warning:  { border: "hsl(38 90% 50%)",   icon: "hsl(38 90% 55%)",   badge: "hsl(38 90% 15%)" },
  positive: { border: "hsl(142 60% 45%)",  icon: "hsl(142 60% 50%)",  badge: "hsl(142 60% 12%)" },
  info:     { border: "hsl(210 80% 55%)",  icon: "hsl(210 80% 60%)",  badge: "hsl(210 80% 15%)" },
};

function severityIcon(severity: InsightSeverity, changePct?: number) {
  const color = SEVERITY_STYLES[severity].icon;
  const size = { width: 14, height: 14 };

  if (severity === "danger")   return <AlertCircle style={{ ...size, color, flexShrink: 0 }} />;
  if (severity === "warning")  return <AlertTriangle style={{ ...size, color, flexShrink: 0 }} />;
  if (severity === "positive") return <CheckCircle2 style={{ ...size, color, flexShrink: 0 }} />;

  // info — use trend icon if we have a pct
  if (changePct !== undefined && changePct > 0) return <TrendingUp style={{ ...size, color, flexShrink: 0 }} />;
  if (changePct !== undefined && changePct < 0) return <TrendingDown style={{ ...size, color, flexShrink: 0 }} />;
  return <Info style={{ ...size, color, flexShrink: 0 }} />;
}

function InsightCard({ insight }: { insight: Insight }) {
  const styles = SEVERITY_STYLES[insight.severity];
  const hasBadge = insight.change_pct !== undefined && insight.change_label;
  const sign = (insight.change_pct ?? 0) >= 0 ? "+" : "";

  return (
    <div
      style={{
        borderLeft: `3px solid ${styles.border}`,
        padding: "12px 16px",
        background: "hsl(var(--bg-card))",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <div className="flex items-start gap-2">
        <div style={{ marginTop: "1px" }}>{severityIcon(insight.severity, insight.change_pct)}</div>
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: "13px", fontWeight: 500, color: "hsl(var(--fg))", lineHeight: 1.4 }}>
            {insight.title}
          </p>
          {hasBadge && (
            <span
              style={{
                display: "inline-block",
                marginTop: "4px",
                padding: "1px 6px",
                borderRadius: "3px",
                background: styles.badge,
                color: styles.icon,
                fontSize: "11px",
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {sign}{insight.change_pct}% {insight.change_label}
            </span>
          )}
        </div>
      </div>
      <p style={{ fontSize: "12px", color: "hsl(var(--fg-3))", lineHeight: 1.5, paddingLeft: "22px" }}>
        {insight.suggestion}
      </p>
    </div>
  );
}

export function InsightsWidget() {
  const { data: insights, isLoading } = useQuery<Insight[]>({
    queryKey: ["/api/insights"],
    queryFn: () => api.getInsights() as Promise<Insight[]>,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 3 * 60 * 1000,
  });

  const list = Array.isArray(insights) ? insights : [];

  return (
    <div
      style={{
        background: "hsl(var(--bg-card))",
        border: "1px solid hsl(var(--border))",
        borderRadius: "4px",
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center gap-2 px-5 py-3"
        style={{ borderBottom: "1px solid hsl(var(--border))" }}
      >
        <Sparkles style={{ width: 13, height: 13, color: "hsl(var(--fg-2))" }} />
        <span style={{ fontSize: "13px", fontWeight: 500, color: "hsl(var(--fg))" }}>
          Insights automáticos
        </span>
      </div>

      {isLoading ? (
        <div className="px-5 py-4 space-y-3">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="px-5 py-8 text-center" style={{ fontSize: "13px", color: "hsl(var(--fg-3))" }}>
          Todo en orden — sin alertas por ahora.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1px", background: "hsl(var(--border))" }}>
          {list.map(insight => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}
