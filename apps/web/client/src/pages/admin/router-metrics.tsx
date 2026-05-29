import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/loading-spinner";
import { Bot, Zap, ShieldX, MessageSquare, Coins, TrendingUp } from "lucide-react";

const INTENT_LABELS: Record<string, string> = {
  greeting: "Saludo",
  product_question: "Pregunta de producto",
  price_question: "Pregunta de precio",
  invoice_request: "Solicitud de factura",
  payment_status: "Estado de pago",
  complaint: "Queja",
  technical_support: "Soporte técnico",
  sales_lead: "Lead de ventas",
  human_request: "Solicitar humano",
  opt_out: "Darse de baja",
  spam: "Spam",
  unknown: "Desconocido",
};

const AGENT_LABELS: Record<string, string> = {
  sales: "Ventas",
  support: "Soporte",
  billing: "Facturación",
  human: "Humano",
  general: "General",
  none: "Ninguno",
};

const TIER_LABELS: Record<string, string> = {
  fast: "Rápido",
  balanced: "Balanceado",
  powerful: "Potente",
};

export default function AdminRouterMetrics() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/platform/router-metrics", days],
    queryFn: () => api.platformGetRouterMetrics(days),
    enabled: !!user?.is_platform_admin,
    staleTime: 60_000,
  });

  if (isLoading) return <PageLoader />;

  const m = (data as any) ?? {};
  const autoRate = m.totalCalls > 0 ? Math.round(m.replyRate * 100) : 0;
  const blockRate = m.totalCalls > 0 ? Math.round((m.blockedCalls / m.totalCalls) * 100) : 0;

  return (
    <div className="min-h-full" style={{ background: "hsl(var(--bg))" }}>
      <PageHeader
        title="Router IA — Métricas"
        description="Decisiones del motor de enrutamiento en toda la plataforma."
      />

      <div className="px-6 py-6 space-y-6">
        {/* Period selector */}
        <div className="flex gap-2">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className="px-3 py-1 text-xs rounded border transition-colors"
              style={{
                background: days === d ? "hsl(var(--accent))" : "hsl(var(--bg))",
                color: days === d ? "#fff" : "hsl(var(--fg-2))",
                borderColor: days === d ? "hsl(var(--accent))" : "hsl(var(--border))",
              }}
            >
              {d}d
            </button>
          ))}
        </div>

        {/* Summary stats */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StatCard
            icon={MessageSquare}
            label="Total de llamadas"
            value={m.totalCalls?.toLocaleString() ?? "—"}
            sub={`Últimos ${days} días`}
          />
          <StatCard
            icon={TrendingUp}
            label="Tasa de respuesta automática"
            value={`${autoRate}%`}
            sub={`${m.repliedCalls?.toLocaleString() ?? 0} respondidas`}
          />
          <StatCard
            icon={ShieldX}
            label="Bloqueadas por política"
            value={`${blockRate}%`}
            sub={`${m.blockedCalls?.toLocaleString() ?? 0} bloqueadas`}
          />
          <StatCard
            icon={Zap}
            label="Tokens consumidos"
            value={m.tokensConsumed?.toLocaleString() ?? "—"}
            sub="Por clasificación LLM"
          />
          <StatCard
            icon={Coins}
            label="Tokens ahorrados"
            value={m.tokensSaved?.toLocaleString() ?? "—"}
            sub="Sin invocar cadena IA"
          />
          {m.tokensSaved > 0 && m.tokensConsumed > 0 && (
            <StatCard
              icon={Bot}
              label="Ratio de ahorro"
              value={`${Math.round((m.tokensSaved / (m.tokensConsumed + m.tokensSaved)) * 100)}%`}
              sub="Del total de tokens potenciales"
            />
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* By intent */}
          {m.byIntent?.length > 0 && (
            <BarSection
              title="Por intención"
              rows={m.byIntent.map((r: any) => ({
                label: INTENT_LABELS[r.intent] ?? r.intent,
                value: r.count,
              }))}
            />
          )}

          {/* By agent type */}
          {m.byAgentType?.length > 0 && (
            <BarSection
              title="Por tipo de agente"
              rows={m.byAgentType.map((r: any) => ({
                label: AGENT_LABELS[r.agent] ?? r.agent,
                value: r.count,
              }))}
            />
          )}

          {/* By model tier */}
          {m.byModelTier?.length > 0 && (
            <BarSection
              title="Por tier de modelo"
              rows={m.byModelTier.map((r: any) => ({
                label: TIER_LABELS[r.tier] ?? r.tier,
                value: r.count,
              }))}
            />
          )}
        </div>

        {/* Top workspaces */}
        {m.topWorkspaces?.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-card/40 p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Top workspaces por volumen</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border/60">
                    <th className="pb-2 pr-4 font-medium">Workspace</th>
                    <th className="pb-2 pr-4 font-medium text-right">Llamadas</th>
                    <th className="pb-2 pr-4 font-medium text-right">Respondidas</th>
                    <th className="pb-2 pr-4 font-medium text-right">Bloqueadas</th>
                    <th className="pb-2 font-medium text-right">Tokens ahorrados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {m.topWorkspaces.map((ws: any) => (
                    <tr key={ws.slug} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2 pr-4 font-medium text-foreground">
                        {ws.name}
                        <span className="text-muted-foreground ml-1 font-normal">/{ws.slug}</span>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{ws.calls.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-green-700">
                        {ws.replied.toLocaleString()}
                        <span className="text-muted-foreground ml-1">
                          ({ws.calls > 0 ? Math.round((ws.replied / ws.calls) * 100) : 0}%)
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-amber-700">
                        {ws.blocked.toLocaleString()}
                      </td>
                      <td className="py-2 text-right tabular-nums text-blue-700">
                        {ws.tokensSaved.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {m.totalCalls === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No hay datos de router para este período.
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
        <Icon size={14} strokeWidth={1.75} />
        {label}
      </div>
      <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function BarSection({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-5">
      <h2 className="text-sm font-semibold text-foreground mb-4">{title}</h2>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <div className="w-36 text-xs text-muted-foreground text-right truncate shrink-0">{r.label}</div>
            <div className="flex-1 h-4 rounded overflow-hidden" style={{ background: "hsl(var(--border))" }}>
              <div
                className="h-full rounded transition-all duration-500"
                style={{
                  width: `${(r.value / max) * 100}%`,
                  background: "hsl(var(--accent))",
                  minWidth: r.value > 0 ? "4px" : "0",
                }}
              />
            </div>
            <div className="w-10 text-xs font-semibold text-foreground shrink-0 text-right tabular-nums">
              {r.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
