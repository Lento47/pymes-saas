import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { getSocket } from "@/hooks/use-socket";
import { useState, useEffect, useMemo, useRef } from "react";
import { Wrench, Check, ExternalLink, Loader2, Zap, CheckCircle2, AlertCircle, Bot, SkipForward, ChevronDown, ChevronUp } from "lucide-react";

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

const STAGE_LABELS: Record<string, string> = {
  "intake-triage": "Triage",
  diagnostic: "Diagnóstico",
  "fix-proposal": "Propuesta de fix",
  "security-compliance": "Seguridad",
  "pr-review": "Revisión de PR",
  "customer-support": "Soporte",
  "channel-integration": "Canal",
  "crm-workflow": "CRM",
  "billing-subscription": "Facturación",
  "technical-diagnostic": "Diagnóstico técnico",
  "code-fix-proposal": "Fix propuesto",
  "human-handoff": "Escalado a humano",
};

const AGENT_COLORS: Record<string, string> = {
  "intake-triage": "#f59e0b",
  diagnostic: "#ef4444",
  "fix-proposal": "#22c55e",
  "security-compliance": "#8b5cf6",
  "pr-review": "#3b82f6",
};

function mapModule(module: string): Department {
  return MODULE_TO_DEPT[module?.toLowerCase()] || "technical";
}

interface LiveRun {
  runId: string;
  caseId: string;
  tier?: string;
  stages: any[];
}

interface AgentState {
  id: string;
  name: string;
  dept: Department;
  busy: boolean;
  currentCase?: string;
}

function CaseCard({ c, onFix, onResolve, onEscalate, onAnalyze, isFixing, isAnalyzing, compact }: {
  c: Record<string, any>; onFix?: (id: string) => void; onResolve?: (id: string) => void;
  onEscalate?: (id: string) => void; onAnalyze?: (id: string) => void;
  isFixing?: boolean; isAnalyzing?: boolean; compact?: boolean;
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
      {isOpen && (
        <div className="flex gap-1 mt-2 pt-2 border-t border-border/40">
          {onAnalyze && (
            <button
              onClick={(e) => { e.stopPropagation(); onAnalyze(c.id); }}
              disabled={isAnalyzing}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-[9px] font-medium rounded-md border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
            >
              {isAnalyzing ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Bot className="w-2.5 h-2.5" />}
              IA
            </button>
          )}
          {c.matched_known_issue && c.status !== "INVESTIGATING" && onFix && (
            <button
              onClick={(e) => { e.stopPropagation(); onFix(c.id); }}
              disabled={isFixing}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-[9px] font-medium rounded-md border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
            >
              {isFixing ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Wrench className="w-2.5 h-2.5" />}
              Fix
            </button>
          )}
          {onResolve && (
            <button
              onClick={(e) => { e.stopPropagation(); onResolve(c.id); }}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-[9px] font-medium rounded-md border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              <Check className="w-2.5 h-2.5" /> Resolver
            </button>
          )}
          {onEscalate && (
            <button
              onClick={(e) => { e.stopPropagation(); onEscalate(c.id); }}
              className="inline-flex items-center justify-center gap-1 px-2 py-1 text-[9px] font-medium rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <ExternalLink className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Live pipeline card shown while orchestration runs. */
function LivePipelineCard({ run, stages }: { run: LiveRun; stages: any[] }) {
  const [expanded, setExpanded] = useState(true);
  const agentSlugs = stages.map(s => s.agent_slug);
  const activeAgents = agentSlugs.slice(-3); // last 3 active agents

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-primary animate-pulse shrink-0" />
          <span className="text-xs font-semibold text-foreground">Pipeline en ejecución</span>
          <span className="text-[10px] text-muted-foreground">{run.caseId?.slice(0, 7)}</span>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="p-1 text-muted-foreground hover:text-foreground">
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Active agents visualization */}
      <div className="flex items-center gap-3 mb-3">
        {activeAgents.map((slug, i) => {
          const color = AGENT_COLORS[slug] || "#6b7280";
          const label = STAGE_LABELS[slug] || slug.replace(/-/g, " ");
          return (
            <div key={`${slug}-${i}`} className="flex flex-col items-center gap-1">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[9px] font-semibold"
                style={{ backgroundColor: color, opacity: 1 }}
              >
                {label.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-[8px] text-muted-foreground">{label}</span>
              <span className="text-[7px] text-primary italic">Analizando...</span>
            </div>
          );
        })}
      </div>

      {expanded && (
        <div className="space-y-1">
          {stages.map((stage: any, i: number) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border/40 bg-background/60">
              {stage.allowed === false ? (
                <SkipForward className="w-3 h-3 shrink-0 text-muted-foreground/50" />
              ) : stage.error ? (
                <AlertCircle className="w-3 h-3 shrink-0 text-red-400" />
              ) : (
                <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-500" />
              )}
              <span className="flex-1 text-[11px] text-foreground/80">{STAGE_LABELS[stage.agent_slug] ?? stage.agent_slug}</span>
              {stage.duration_ms != null && (
                <span className="text-[10px] text-muted-foreground/60">{(stage.duration_ms / 1000).toFixed(1)}s</span>
              )}
              {stage.cost_credits != null && stage.cost_credits > 0 && (
                <span className="text-[10px] text-muted-foreground/60">{stage.cost_credits.toFixed(2)} cr.</span>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-primary/20 bg-primary/5">
            <Loader2 className="w-3 h-3 shrink-0 text-primary animate-spin" />
            <span className="text-[11px] text-primary/80">Ejecutando siguiente etapa...</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Completed orchestration result card. */
function OrchestrationResultCard({ result }: { result: Record<string, any> }) {
  const stages: any[] = Array.isArray(result.stages) ? result.stages : [];
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="text-xs font-semibold text-foreground">
            {result.status === "COMPLETED" ? "Diagnóstico completado" :
             result.status === "NEEDS_HUMAN" ? "Requiere revisión humana" : "Diagnóstico"}
          </span>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="p-1 text-muted-foreground hover:text-foreground">
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {result.case_type && (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full border bg-muted text-muted-foreground mr-1">{result.case_type}</span>
      )}
      {result.severity && (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full border bg-muted text-muted-foreground mr-1">{result.severity}</span>
      )}
      {result.total_cost_credits != null && result.total_cost_credits > 0 && (
        <span className="text-[9px] text-muted-foreground/60">{result.total_cost_credits.toFixed(1)} créd.</span>
      )}

      {expanded && result.summary && (
        <p className="text-[11px] text-foreground/70 leading-relaxed mt-2">{result.summary}</p>
      )}

      {expanded && stages.length > 0 && (
        <div className="space-y-1 mt-2">
          {stages.map((stage: any, i: number) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border/40 bg-background/60 text-[11px]">
              {stage.error ? (
                <AlertCircle className="w-3 h-3 shrink-0 text-red-400" />
              ) : (
                <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-500" />
              )}
              <span className="flex-1 text-foreground/80">{STAGE_LABELS[stage.agent_slug] ?? stage.agent_slug}</span>
              {stage.duration_ms != null && (
                <span className="text-[10px] text-muted-foreground/60">{(stage.duration_ms / 1000).toFixed(1)}s</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PlaygroundBoard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [liveRuns, setLiveRuns] = useState<Record<string, LiveRun>>({});
  const [orchestrationResults, setOrchestrationResults] = useState<Record<string, any>>({});
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const liveRunsRef = useRef(liveRuns);
  liveRunsRef.current = liveRuns;

  const { data: cases } = useQuery({
    queryKey: ["diagnostic-cases"],
    queryFn: api.getDiagnosticCases,
    refetchInterval: 10000,
  });

  // ── WebSocket: real-time orchestration progress ──────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onStarted = (payload: any) => {
      const caseId: string | undefined = payload.diagnostic_case_id;
      if (!caseId) return;
      setLiveRuns(prev => ({ ...prev, [caseId]: { runId: payload.run_id, caseId, tier: payload.tier, stages: [] } }));
    };

    const onStageComplete = (payload: any) => {
      const caseId = Object.keys(liveRunsRef.current).find(
        id => liveRunsRef.current[id].runId === payload.run_id,
      );
      if (!caseId || !payload.stage) return;
      setLiveRuns(prev => {
        const run = prev[caseId];
        if (!run) return prev;
        return { ...prev, [caseId]: { ...run, stages: [...run.stages, payload.stage] } };
      });
    };

    const onDone = (payload: any) => {
      const caseId = Object.keys(liveRunsRef.current).find(
        id => liveRunsRef.current[id].runId === payload.run_id,
      );
      if (!caseId) return;
      if (payload.result) {
        setOrchestrationResults(prev => ({ ...prev, [caseId]: payload.result }));
      }
      setLiveRuns(prev => {
        const next = { ...prev };
        delete next[caseId];
        return next;
      });
      setAnalyzingIds(prev => { const n = new Set(prev); n.delete(caseId); return n; });
    };

    socket.on("orchestration:started", onStarted);
    socket.on("orchestration:stage-complete", onStageComplete);
    socket.on("orchestration:done", onDone);

    return () => {
      socket.off("orchestration:started", onStarted);
      socket.off("orchestration:stage-complete", onStageComplete);
      socket.off("orchestration:done", onDone);
    };
  }, []);

  // ── Orchestration mutation ───────────────────────────────────────────
  const orchestrateMut = useMutation({
    mutationFn: (caseId: string) => api.platformOrchestrateSupportCase(caseId),
    onSuccess: (result: Record<string, any>, caseId: string) => {
      setOrchestrationResults(prev => ({ ...prev, [caseId]: result }));
      setAnalyzingIds(prev => { const n = new Set(prev); n.delete(caseId); return n; });
    },
    onError: (_err, caseId) => {
      setAnalyzingIds(prev => { const n = new Set(prev); n.delete(caseId); return n; });
    },
  });

  const handleAnalyze = (caseId: string) => {
    setAnalyzingIds(prev => new Set(prev).add(caseId));
    orchestrateMut.mutate(caseId);
  };

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

  const caseList: Record<string, any>[] = Array.isArray(cases) ? cases : [];

  const urgentCases = useMemo(() =>
    caseList.filter((c) => c.risk_level === "critical" || c.risk_level === "high").slice(0, 3),
    [caseList]
  );

  const openCases = useMemo(() =>
    caseList.filter((c) => c.status !== "RESOLVED"),
    [caseList]
  );

  const resolvedCases = useMemo(() =>
    caseList.filter((c) => c.status === "RESOLVED").slice(0, 3),
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

  // Dynamic agents based on live orchestration stages
  const liveSlugs = Object.values(liveRuns).flatMap(r => r.stages.map(s => s.agent_slug));
  const dynamicAgents: AgentState[] = useMemo(() => {
    if (liveSlugs.length === 0) return [];
    const seen = new Set<string>();
    return liveSlugs
      .filter(slug => { if (seen.has(slug)) return false; seen.add(slug); return true; })
      .slice(0, 5)
      .map((slug, i) => ({
        id: `live-${i}`,
        name: (STAGE_LABELS[slug] || slug).slice(0, 10),
        dept: "technical" as Department,
        busy: true,
        currentCase: Object.keys(liveRuns)[0]?.slice(0, 7),
      }));
  }, [liveSlugs, JSON.stringify(Object.keys(liveRuns))]);

  // Merge: dynamic agents take priority, fallback to cosmetic for empty departments
  const displayAgents = dynamicAgents.length > 0 ? dynamicAgents : agents;

  const totalOpen = openCases.length;
  const totalResolved = resolvedCases.length + (cases ? cases.filter((c: any) => c.status === "RESOLVED").length : 0);
  const slaAtRisk = openCases.filter((c) => c.risk_level === "high" || c.risk_level === "critical").length;
  const escalated = openCases.filter((c) => c.status === "ESCALATED").length;
  const activePipelines = Object.keys(liveRuns).length;

  const handleFix = (caseId: string) => { setFixingId(caseId); fixMut.mutate(caseId); };
  const handleResolve = (caseId: string) => statusMut.mutate({ id: caseId, status: "RESOLVED" });
  const handleEscalate = (caseId: string) => statusMut.mutate({ id: caseId, status: "ESCALATED" });

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Abiertos", value: totalOpen, color: "text-info" },
          { label: "Resueltos", value: totalResolved, color: "text-success" },
          { label: "SLA riesgo", value: slaAtRisk, color: "text-warning" },
          { label: "Escalados", value: escalated, color: "text-destructive" },
          { label: "Pipelines", value: activePipelines, color: activePipelines > 0 ? "text-primary" : "text-muted-foreground" },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border/60 bg-card/40 px-4 py-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Active orchestration pipelines */}
      {Object.entries(liveRuns).map(([caseId, run]) => (
        <LivePipelineCard key={run.runId} run={run} stages={run.stages} />
      ))}

      {/* Completed orchestration results */}
      {Object.entries(orchestrationResults).filter(([caseId]) => !liveRuns[caseId]).slice(0, 3).map(([caseId, result]) => (
        <OrchestrationResultCard key={caseId} result={result} />
      ))}

      {/* Dynamic agent bar */}
      {displayAgents.length > 0 && (
        <div className="rounded-lg border border-primary/20 bg-card/40 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">Agentes en ejecución</span>
          </div>
          <div className="flex items-center gap-3">
            {displayAgents.map(a => {
              const c = AGENT_COLORS[a.id] || "#6b7280";
              return (
                <div key={a.id} className="flex flex-col items-center gap-1">
                  <div className="relative">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-semibold"
                      style={{ backgroundColor: c, opacity: a.busy ? 1 : 0.5 }}
                    >
                      {a.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span
                      className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background"
                      style={{ backgroundColor: a.busy ? "#ef4444" : "#22c55e" }}
                      title={a.busy ? "Ocupado" : "Disponible"}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground">{a.name}</span>
                  <span className="text-[8px] text-muted-foreground/80 italic">{a.busy ? "Trabajando..." : "En espera"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Urgent queue */}
      {urgentCases.length > 0 && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/[0.03] p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <h3 className="text-xs font-semibold text-foreground">Cola de urgentes</h3>
            <span className="text-[10px] text-muted-foreground/60">· Se atienden primero</span>
          </div>
          <div className="flex gap-3 flex-wrap">
            {urgentCases.map((c) => (
              <CaseCard key={c.id} c={c} compact
                onFix={handleFix} onResolve={handleResolve} onEscalate={handleEscalate}
                onAnalyze={handleAnalyze} isFixing={fixingId === c.id}
                isAnalyzing={analyzingIds.has(c.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Department map */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {DEPTS.filter(d => d.key !== "resolved").map(d => {
          const activeCase = (casesByDept[d.key] || []).filter((c) => c.status !== "RESOLVED")[0];
          const nextCase = (casesByDept[d.key] || []).filter((c) => c.status !== "RESOLVED")[1];

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

              <div className="space-y-2">
                <div>
                  <span className="text-[10px] text-muted-foreground font-medium">Activo</span>
                  {activeCase ? (
                    <div className="mt-1">
                      <CaseCard c={activeCase}
                        onFix={handleFix} onResolve={handleResolve} onEscalate={handleEscalate}
                        onAnalyze={handleAnalyze} isFixing={fixingId === activeCase.id}
                        isAnalyzing={analyzingIds.has(activeCase.id)}
                      />
                    </div>
                  ) : (
                    <div className="mt-1 rounded-lg border border-dashed border-border/40 p-3 text-center">
                      <p className="text-[10px] text-muted-foreground/80">Sin casos activos</p>
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground font-medium">Siguiente caso</span>
                  {nextCase ? (
                    <div className="mt-1">
                      <CaseCard c={nextCase}
                        onFix={handleFix} onResolve={handleResolve} onEscalate={handleEscalate}
                        onAnalyze={handleAnalyze} isFixing={fixingId === nextCase.id}
                        isAnalyzing={analyzingIds.has(nextCase.id)}
                      />
                    </div>
                  ) : (
                    <div className="mt-1 rounded-lg border border-dashed border-border/40 p-3 text-center">
                      <p className="text-[10px] text-muted-foreground/80">Sin casos delegados</p>
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
            {(casesByDept.resolved || []).map((c) => (
              <CaseCard key={c.id} c={c} onAnalyze={handleAnalyze} isAnalyzing={analyzingIds.has(c.id)} />
            ))}
            {(!casesByDept.resolved || casesByDept.resolved.length === 0) && (
              <div className="rounded-lg border border-dashed border-border/40 p-3 text-center">
                <p className="text-[10px] text-muted-foreground/80">Los casos completados se archivan aquí</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="rounded-lg border border-border/60 bg-card/40 p-4">
        <h4 className="text-[11px] font-semibold text-foreground mb-2">Cómo funciona</h4>
        <div className="flex flex-wrap gap-4 text-[10px] text-muted-foreground">
          <span><span className="font-semibold text-destructive">1.</span> Urgente — Se atienden primero</span>
          <span><span className="font-semibold text-warning">2.</span> Analizar con IA — Ejecuta el pipeline de agentes</span>
          <span><span className="font-semibold text-info">3.</span> Fix — Se crea automáticamente si hay solución conocida</span>
          <span><span className="font-semibold text-success">4.</span> Resolver — El caso se marca como completado</span>
        </div>
        <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground/60">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-success" /> Disponible</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-destructive" /> Ocupado</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> Pipeline activo</span>
        </div>
      </div>
    </div>
  );
}
