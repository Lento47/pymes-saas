import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth, useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Search, Bug, ShieldAlert, AlertTriangle, Info, Clock, ChevronRight } from "lucide-react";
import { useState } from "react";

const RISK_ICONS: Record<string, any> = {
  critical: AlertTriangle,
  high: Bug,
  medium: ShieldAlert,
  low: Info,
};

const RISK_COLORS: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-blue-400",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  INVESTIGATING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  RESOLVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  ESCALATED: "bg-red-500/10 text-red-400 border-red-500/30",
};

export default function SupportPage() {
  useRequireAuth();
  const { user } = useAuth();
  const [filter, setFilter] = useState("all");

  const { data: cases, isLoading } = useQuery({
    queryKey: ["diagnostic-cases"],
    queryFn: api.getDiagnosticCases,
    refetchInterval: 30000,
  });

  const caseList: any[] = Array.isArray(cases) ? cases : [];
  const filtered = filter === "all" ? caseList : caseList.filter((c: any) => c.status === filter);

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Casos de Soporte</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Diagnósticos generados por el agente de soporte
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {["all", "OPEN", "INVESTIGATING", "RESOLVED", "ESCALATED"].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                filter === status
                  ? "border-[#5771ff]/50 bg-[#5771ff]/10 text-[#5771ff]"
                  : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {status === "all" ? "Todos" : status}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-md border border-border/60 bg-card/40 p-5 animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Search className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {caseList.length === 0
                ? "No hay casos de soporte todavía"
                : "No hay casos con ese estado"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c: any) => {
              const RiskIcon = RISK_ICONS[c.risk_level] || Info;
              const riskColor = RISK_COLORS[c.risk_level] || "text-muted-foreground";
              const statusColor = STATUS_COLORS[c.status] || "bg-muted text-muted-foreground";

              return (
                <div
                  key={c.id}
                  className="rounded-md border border-border/60 bg-card/40 p-5 hover:border-border transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <RiskIcon className={`w-4 h-4 ${riskColor}`} />
                        <h3 className="text-sm font-medium text-foreground truncate">{c.title}</h3>
                      </div>
                      {c.user_description && (
                        <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">
                          {c.user_description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusColor}`}>
                          {c.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50 uppercase">{c.module}</span>
                        {c.error_code && (
                          <span className="text-[10px] text-muted-foreground/40 font-mono">{c.error_code}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(c.created_at).toLocaleDateString("es-CR", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {c.safe_summary && (
                        <div className="text-[11px] text-muted-foreground/60 max-w-[200px] text-right line-clamp-2">
                          {c.safe_summary}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
