import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect, useMemo } from "react";
import { Wrench, Check, ExternalLink, Loader2 } from "lucide-react";

type Department = "billing" | "technical" | "config" | "care" | "product" | "resolved";

const DEPTS: { key: Department; label: string; color: string; border: string }[] = [
  { key: "billing", label: "Facturación", color: "#f59e0b", border: "border-amber-500/20" },
  { key: "technical", label: "Técnico", color: "#ef4444", border: "border-red-500/20" },
  { key: "config", label: "Configuración", color: "#8b5cf6", border: "border-purple-500/20" },
  { key: "care", label: "Atención", color: "#3b82f6", border: "border-blue-500/20" },
  { key: "product", label: "Producto", color: "#22c55e", border: "border-emerald-500/20" },
  { key: "resolved", label: "Resueltos", color: "#6b7280", border: "border-zinc-500/20" },
];

const MODULE_TO_DEPT: Record<string, Department> = {
  billing: "billing", invoices: "billing", paddle: "billing",
  settings: "config", channels: "config", routing: "config", workspaces: "config",
  conversations: "care", contacts: "care", notifications: "care",
  documents: "technical", automations: "technical", hacienda: "technical", agent: "technical",
  pipeline: "product", tasks: "product", inventory: "product",
};

function mapModule(module: string): Department {
  return MODULE_TO_DEPT[module?.toLowerCase()] || "technical";
}

interface AgentState {
  id: string; name: string; dept: Department; busy: boolean; currentCase?: string;
}

const AGENTS: AgentState[] = [
  { id: "a1", name: "Luna", dept: "billing", busy: true, currentCase: "b-1" },
  { id: "a2", name: "Nico", dept: "technical", busy: true, currentCase: "t-1" },
  { id: "a3", name: "Sara", dept: "care", busy: false },
  { id: "a4", name: "Tano", dept: "config", busy: false },
  { id: "a5", name: "Rita", dept: "product", busy: false },
];

const AGENT_COLORS: Record<string, string> = {
  a1: "#f59e0b", a2: "#ef4444", a3: "#3b82f6", a4: "#8b5cf6", a5: "#22c55e",
};

function getAgentCallout(agent: AgentState, cases: any[]): string {
  if (agent.busy) {
    const c = cases[0];
    if (c?.matched_known_issue) return "Tengo la solución";
    if (c?.risk_level === "critical") return "Resolviendo urgente";
    return "Trabajando...";
  }
  if (cases.length > 0) return "Siguiente caso pendiente";
  return "Disponible";
}

function AgentMascot({ agent, deptCases }: { agent: AgentState; deptCases: any[] }) {
  const c = AGENT_COLORS[agent.id] || "#6b7280";
  const callout = getAgentCallout(agent, deptCases);
  return (
    <div className="relative inline-flex flex-col items-center" style={{ transition: "all 0.5s ease" }}>
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-semibold"
        style={{ backgroundColor: c, opacity: agent.busy ? 1 : 0.5 }}
      >
        {agent.name.slice(0, 2).toUpperCase()}
      </div>
      <span className="text-[9px] text-muted-foreground mt-0.5">{agent.name}</span>
      <span
        className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background"
        style={{ backgroundColor: agent.busy ? "#ef4444" : "#22c55e" }}
        title={agent.busy ? "Ocupado" : "Disponible"}
      />
      <span className="text-[8px] text-muted-foreground/50 mt-0.5 italic">{callout}</span>
    </div>
  );
}

function CaseCard({ c, onFix, onResolve, onEscalate, isFixing, compact }: {
  c: any; onFix?: (id: string) => void; onResolve?: (id: string) => void;
  onEscalate?: (id: string) => void; isFixing?: boolean; compact?: boolean;
}) {
  const statusColor =
    c.status === "OPEN" ? "border-blue-500/30 bg-blue-500/5" :
    c.status === "INVESTIGATING" ? "border-amber-500/30 bg-amber-500/5" :
    c.status === "RESOLVED" ? "border-emerald-500/30 bg-emerald-500/5" :
    "border-red-500/30 bg-red-500/5";

  const riskDot =
    c.risk_level === "critical" ? "bg-red-500" :
    c.risk_level === "high" ? "bg-orange-500" :
    c.risk_level === "medium" ? "bg-yellow-500" : "bg-blue-500";

  const statusLabel =
    c.status === "OPEN" ? "Nuevo" :
    c.status === "INVESTIGATING" ? "En curso" :
    c.status === "ESCALATED" ? "Escalado" : "Resuelto";

  const isOpen = c.status === "OPEN" || c.status === "INVESTIGATING";

  return (
    <div className={`rounded-lg border p-3 ${statusColor} text-left ${compact ? "min-w-[160px]" : "min-w-[180px]"}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`w-2 h-2 rounded-full ${riskDot}`} />
        <span className="text-[10px] font-semibold text-foreground truncate">{`Caso ${c.id?.slice(0, 7)}`}</span>
      </div>
      <p className="text-[11px] text-foreground/80 leading-tight mb-1.5">{c.title}</p>

      {/* Known issue + proactive suggestion */}
      {c.matched_known_issue && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/[0.04] px-2 py-1.5 mb-2">
          <p className="text-[9px] font-medium text-amber-300">Solución: {c.matched_known_issue.title}</p>
          {c.matched_known_issue.workaround && (
            <p className="text-[9px] text-muted-foreground mt-0.5">{c.matched_known_issue.workaround}</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-border/60 text-muted-foreground">
          {statusLabel}
        </span>
        <span className="text-[9px] text-muted-foreground/60">{c.risk_level}</span>
      </div>

      {/* Action buttons */}
      {isOpen && onFix && onResolve && onEscalate && (
        <div className="flex gap-1 mt-2 pt-2 border-t border-border/40">
          {c.matched_known_issue && c.status !== "INVESTIGATING" && (
            <button
              onClick={(e) => { e.stopPropagation(); onFix(c.id); }}
              disabled={isFixing}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-[9px] font-medium rounded-md border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
            >
              {isFixing ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Wrench className="w-2.5 h-2.5" />}
              Fix
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onResolve(c.id); }}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-[9px] font-medium rounded-md border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
          >
            <Check className="w-2.5 h-2.5" /> Resolver
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEscalate(c.id); }}
            className="inline-flex items-center justify-center gap-1 px-2 py-1 text-[9px] font-medium rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <ExternalLink className="w-2.5 h-2.5" /> Escalar
          </button>
        </div>
      )}
    </div>
  );
}

export function PlaygroundBoard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [agents, setAgents] = useState(AGENTS);
  const [moves, setMoves] = useState<{ agentId: string; from: Department; to: Department }[]>([]);
  const [fixingId, setFixingId] = useState<string | null>(null);

  const { data: cases } = useQuery({
    queryKey: ["diagnostic-cases"],
    queryFn: api.getDiagnosticCases,
    refetchInterval: 10000,
  });

  const fixMut = useMutation({
    mutationFn: (caseId: string) => api.createFixCase(caseId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["diagnostic-cases"] }); setFixingId(null); },
    onError: () => setFixingId(null),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateDiagnosticCaseStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diagnostic-cases"] }),
  });

  const caseList: any[] = Array.isArray(cases) ? cases : [];

  const urgentCases = useMemo(() =>
    caseList.filter((c: any) => c.risk_level === "critical" || c.risk_level === "high").slice(0, 3),
    [caseList]
  );

  const openCases = useMemo(() =>
    caseList.filter((c: any) => c.status !== "RESOLVED"),
    [caseList]
  );

  const resolvedCases = useMemo(() =>
    caseList.filter((c: any) => c.status === "RESOLVED").slice(0, 3),
    [caseList]
  );

  const casesByDept = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const d of DEPTS) map[d.key] = [];
    for (const c of openCases) {
      const dept = mapModule(c.module);
      if (map[dept]) map[dept].push(c);
    }
    for (const c of resolvedCases) {
      if (map.resolved) map.resolved.push(c);
    }
    return map;
  }, [openCases, resolvedCases]);

  const totalOpen = openCases.length;
  const totalResolved = resolvedCases.length + (cases ? cases.filter((c: any) => c.status === "RESOLVED").length : 0);
  const slaAtRisk = openCases.filter((c: any) => c.risk_level === "high" || c.risk_level === "critical").length;
  const escalated = openCases.filter((c: any) => c.status === "ESCALATED").length;

  const handleFix = (caseId: string) => { setFixingId(caseId); fixMut.mutate(caseId); };
  const handleResolve = (caseId: string) => statusMut.mutate({ id: caseId, status: "RESOLVED" });
  const handleEscalate = (caseId: string) => statusMut.mutate({ id: caseId, status: "ESCALATED" });

  useEffect(() => {
    const interval = setInterval(() => {
      setAgents(prev => prev.map(a => {
        const dept = a.dept;
        const deptCases = casesByDept[dept] || [];
        const hasOpen = deptCases.some((c: any) => c.status === "OPEN" || c.status === "INVESTIGATING");
        return { ...a, busy: hasOpen, currentCase: hasOpen ? deptCases[0]?.id?.slice(0, 7) : undefined };
      }));
    }, 5000);
    return () => clearInterval(interval);
  }, [casesByDept]);

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Abiertos", value: totalOpen, color: "text-blue-400" },
          { label: "Resueltos", value: totalResolved, color: "text-emerald-400" },
          { label: "SLA en riesgo", value: slaAtRisk, color: "text-orange-400" },
          { label: "Escalados", value: escalated, color: "text-red-400" },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border/60 bg-card/40 px-4 py-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Urgent queue */}
      {urgentCases.length > 0 && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/[0.03] p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <h3 className="text-xs font-semibold text-foreground">Cola de urgentes</h3>
            <span className="text-[10px] text-muted-foreground/60">· Se atienden primero</span>
          </div>
          <div className="flex gap-3 flex-wrap">
            {urgentCases.map((c: any) => (
              <CaseCard key={c.id} c={c} compact
                onFix={handleFix} onResolve={handleResolve} onEscalate={handleEscalate}
                isFixing={fixingId === c.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Department map */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {DEPTS.filter(d => d.key !== "resolved").map(d => {
          const activeCase = (casesByDept[d.key] || []).filter((c: any) => c.status !== "RESOLVED")[0];
          const nextCase = (casesByDept[d.key] || []).filter((c: any) => c.status !== "RESOLVED")[1];
          const deptAgents = agents.filter(a => a.dept === d.key);

          return (
            <div key={d.key} className={`rounded-xl border ${d.border} bg-card/40 p-5`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <h3 className="text-sm font-semibold text-foreground">{d.label}</h3>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {(casesByDept[d.key] || []).length} caso{(casesByDept[d.key] || []).length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Agent presence with callouts */}
              <div className="flex items-center gap-2 mb-3">
                {deptAgents.map(a => (
                  <AgentMascot key={a.id} agent={a} deptCases={(casesByDept[d.key] || []).filter((c: any) => c.status !== "RESOLVED")} />
                ))}
              </div>

              {/* Cases with action buttons */}
              <div className="space-y-2">
                <div>
                  <span className="text-[10px] text-muted-foreground font-medium">Activo</span>
                  {activeCase ? (
                    <div className="mt-1">
                      <CaseCard c={activeCase}
                        onFix={handleFix} onResolve={handleResolve} onEscalate={handleEscalate}
                        isFixing={fixingId === activeCase.id}
                      />
                    </div>
                  ) : (
                    <div className="mt-1 rounded-lg border border-dashed border-border/40 p-3 text-center">
                      <p className="text-[10px] text-muted-foreground/50">Sin casos activos</p>
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground font-medium">Siguiente caso</span>
                  {nextCase ? (
                    <div className="mt-1">
                      <CaseCard c={nextCase}
                        onFix={handleFix} onResolve={handleResolve} onEscalate={handleEscalate}
                        isFixing={fixingId === nextCase.id}
                      />
                    </div>
                  ) : (
                    <div className="mt-1 rounded-lg border border-dashed border-border/40 p-3 text-center">
                      <p className="text-[10px] text-muted-foreground/50">Sin casos delegados</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Resolved department */}
        <div className="rounded-xl border border-zinc-500/20 bg-card/40 p-5 opacity-60">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
            <h3 className="text-sm font-semibold text-foreground">Resueltos</h3>
          </div>
          <div className="space-y-2">
            {(casesByDept.resolved || []).map((c: any) => (
              <CaseCard key={c.id} c={c} />
            ))}
            {(!casesByDept.resolved || casesByDept.resolved.length === 0) && (
              <div className="rounded-lg border border-dashed border-border/40 p-3 text-center">
                <p className="text-[10px] text-muted-foreground/50">Los casos completados se archivan aquí</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="rounded-lg border border-border/60 bg-card/40 p-4">
        <h4 className="text-[11px] font-semibold text-foreground mb-2">Cómo funciona</h4>
        <div className="flex flex-wrap gap-4 text-[10px] text-muted-foreground">
          <span><span className="font-semibold text-red-400">1.</span> Urgente — Se atienden primero</span>
          <span><span className="font-semibold text-amber-400">2.</span> En curso — El agente resuelve</span>
          <span><span className="font-semibold text-blue-400">3.</span> Siguiente caso — Se delega</span>
          <span><span className="font-semibold text-emerald-400">4.</span> Fix — Se crea automáticamente si hay solución conocida</span>
        </div>
        <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground/60">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Disponible</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Ocupado</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Fix sugerido</span>
        </div>
      </div>
    </div>
  );
}
