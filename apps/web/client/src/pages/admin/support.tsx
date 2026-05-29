import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth, useRequireAuth } from "@/hooks/use-auth";
import { Search, Bug, ShieldAlert, AlertTriangle, Info, Clock, Check, ExternalLink, ChevronDown, ChevronUp, Building2, UserCircle, LayoutList, Map, MessageSquare, Send, Loader2, Bot, CheckCircle2, AlertCircle, SkipForward, History } from "lucide-react";
import { useEffect, useState } from "react";
import { PlaygroundBoard } from "@/components/playground/PlaygroundBoard";

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

type EvidenceWorkspace = { name?: string; slug?: string; plan?: string };
type EvidenceUser = { name?: string; email?: string; role?: string };

function parseEvidence(evidence: unknown): { workspace?: EvidenceWorkspace; user?: EvidenceUser; path?: string; method?: string; source?: string; status?: number; stack?: string } {
  if (typeof evidence !== "object" || evidence === null) {
    if (typeof evidence !== "string") return {};
  }
  try {
    const e = typeof evidence === "string" ? JSON.parse(evidence) : evidence as Record<string, unknown>;
    if (typeof e !== "object" || e === null) return {};
    const r = e as Record<string, unknown>;
    const ws = typeof r.workspace === "object" && r.workspace !== null ? r.workspace as Record<string, unknown> : null;
    const usr = typeof r.user === "object" && r.user !== null ? r.user as Record<string, unknown> : null;
    return {
      workspace: ws ? {
        name: typeof ws.name === "string" ? ws.name : undefined,
        slug: typeof ws.slug === "string" ? ws.slug : undefined,
        plan: typeof ws.plan === "string" ? ws.plan : undefined,
      } : undefined,
      user: usr ? {
        name: typeof usr.name === "string" ? usr.name : undefined,
        email: typeof usr.email === "string" ? usr.email : undefined,
        role: typeof usr.role === "string" ? usr.role : undefined,
      } : undefined,
      path: typeof r.path === "string" ? r.path : undefined,
      method: typeof r.method === "string" ? r.method : undefined,
      source: typeof r.source === "string" ? r.source : undefined,
      status: typeof r.status === "number" ? r.status : undefined,
      stack: typeof r.stack === "string" ? r.stack : undefined,
    };
  } catch {
    return {};
  }
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/10 text-red-500 border-red-500/30",
  high: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  low: "bg-blue-500/10 text-blue-400 border-blue-500/30",
};

const STAGE_LABELS: Record<string, string> = {
  "intake-triage": "Triage",
  "customer-support": "Soporte al cliente",
  "channel-integration": "Integración de canal",
  "crm-workflow": "CRM",
  "billing-subscription": "Facturación",
  "technical-diagnostic": "Diagnóstico técnico",
  "code-fix-proposal": "Propuesta de fix",
  "security-compliance": "Seguridad",
  "human-handoff": "Handoff humano",
};

function OrchestrationResult({ result }: { result: Record<string, any> }) {
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const stages: any[] = Array.isArray(result.stages) ? result.stages : [];

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 mb-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[result.status] ?? "bg-muted text-muted-foreground"}`}>
          {result.status}
        </span>
        {result.case_type && (
          <span className="text-[10px] px-2 py-0.5 rounded-full border bg-muted text-muted-foreground">
            {result.case_type}
          </span>
        )}
        {result.severity && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${SEVERITY_COLORS[result.severity] ?? "bg-muted text-muted-foreground"}`}>
            {result.severity}
          </span>
        )}
        {result.needs_human_review && (
          <span className="text-[10px] px-2 py-0.5 rounded-full border bg-orange-500/10 text-orange-400 border-orange-500/30 flex items-center gap-1">
            <AlertCircle className="w-2.5 h-2.5" /> Requiere revisión humana
          </span>
        )}
      </div>

      {result.summary && (
        <p className="text-xs text-foreground/80 leading-relaxed">{result.summary}</p>
      )}

      {stages.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Etapas ejecutadas</p>
          {stages.map((stage: any, i: number) => {
            const isEx = expandedStage === `${i}`;
            return (
              <div key={i} className="rounded-md border border-border/40 bg-background/60">
                <button
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left"
                  onClick={() => setExpandedStage(isEx ? null : `${i}`)}
                >
                  {stage.allowed === false ? (
                    <SkipForward className="w-3 h-3 shrink-0 text-muted-foreground/50" />
                  ) : stage.error ? (
                    <AlertCircle className="w-3 h-3 shrink-0 text-red-400" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-500" />
                  )}
                  <span className="flex-1 text-[11px] font-medium text-foreground/80">
                    {STAGE_LABELS[stage.agent_slug] ?? stage.agent_slug}
                  </span>
                  {stage.duration_ms && (
                    <span className="text-[10px] text-muted-foreground/60">{stage.duration_ms}ms</span>
                  )}
                  {isEx ? <ChevronUp className="w-3 h-3 text-muted-foreground/50" /> : <ChevronDown className="w-3 h-3 text-muted-foreground/50" />}
                </button>
                {isEx && (
                  <div className="px-2.5 pb-2.5">
                    {stage.skipped_reason && (
                      <p className="text-[10px] text-muted-foreground/70 italic">{stage.skipped_reason}</p>
                    )}
                    {stage.error && (
                      <p className="text-[10px] text-red-400">{stage.error}</p>
                    )}
                    {stage.output_preview && (
                      <p className="text-[11px] text-foreground/70 leading-relaxed whitespace-pre-wrap">{stage.output_preview}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CaseRunHistory({ caseId }: { caseId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["case-runs", caseId],
    queryFn: () => api.platformGetCaseRuns(caseId),
    staleTime: 30_000,
  });

  if (isLoading) return <div className="flex items-center gap-2 py-2"><Loader2 className="w-3 h-3 animate-spin text-muted-foreground" /><span className="text-[11px] text-muted-foreground">Cargando historial...</span></div>;

  const runs: any[] = Array.isArray(data) ? data : [];
  if (runs.length === 0) return <p className="text-[11px] text-muted-foreground/70 mb-2">Sin ejecuciones anteriores.</p>;

  return (
    <div className="space-y-1.5 mb-3">
      {runs.map((run: any) => (
        <div key={run.id} className="flex items-center gap-2 text-[11px] text-muted-foreground rounded-md border border-border/40 bg-background/60 px-2.5 py-1.5">
          <span className={`px-1.5 py-0.5 rounded text-[10px] border ${STATUS_COLORS[run.status] ?? "bg-muted"}`}>{run.status}</span>
          {run.case_type && <span>{run.case_type}</span>}
          {run.severity && <span className={`px-1.5 py-0.5 rounded text-[10px] border ${SEVERITY_COLORS[run.severity] ?? ""}`}>{run.severity}</span>}
          {run.needs_human_review && <AlertCircle className="w-3 h-3 text-orange-400 shrink-0" />}
          <span className="ml-auto text-[10px] text-muted-foreground/60">{new Date(run.created_at).toLocaleDateString("es-CR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      ))}
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  USER_GUIDANCE: "Guía de usuario",
  PERMISSION_ISSUE: "Permisos",
  PRODUCT_BUG: "Bug del producto",
  BILLING_OR_PLAN: "Facturación",
  WORKSPACE_CONFIGURATION: "Configuración",
  PLATFORM_INCIDENT: "Incidente de plataforma",
};

export default function SupportPage() {
  useRequireAuth();
  const { user } = useAuth();
  // ADMIN/platform-admin keep the workspace-wide view, the playground board
  // and the status-change actions. Other roles only see "Mis tickets" — the
  // backend filters by user_id automatically.
  const isAdmin = user?.role === "ADMIN" || user?.is_platform_admin === true;
  const [view, setView] = useState<"list" | "playground">("list");
  const [filter, setFilter] = useState("OPEN");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [orchestrationResults, setOrchestrationResults] = useState<Record<string, any>>({});
  const [showRunHistory, setShowRunHistory] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Deep-link from API-error toasts: ApiError appends "Ticket #abc abierto"
  // and a future link can navigate to /support?case=<id> to expand it.
  useEffect(() => {
    const url = new URL(window.location.href);
    const caseId = url.searchParams.get("case");
    if (caseId) setExpandedId(caseId);
  }, []);

  const { data: cases, isLoading } = useQuery({
    queryKey: ["diagnostic-cases"],
    queryFn: api.getDiagnosticCases,
    refetchInterval: 30000,
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateDiagnosticCaseStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["diagnostic-cases"] }),
  });

  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ["case-comments", expandedId],
    queryFn: () => (expandedId ? api.getCaseComments(expandedId) : null),
    enabled: !!expandedId && isAdmin,
  });

  const commentMut = useMutation({
    mutationFn: ({ caseId, body }: { caseId: string; body: string }) =>
      api.createCaseComment(caseId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case-comments", expandedId] });
      setNewComment("");
    },
  });

  const orchestrateMut = useMutation({
    mutationFn: (caseId: string) => api.platformOrchestrateSupportCase(caseId),
    onSuccess: (result: Record<string, any>, caseId: string) => {
      setOrchestrationResults(prev => ({ ...prev, [caseId]: result }));
    },
  });

  const caseList: Record<string, any>[] = Array.isArray(cases) ? cases : [];
  const filtered = filter === "all" ? caseList : caseList.filter((c) => c.status === filter);

  const openCount = caseList.filter((c) => c.status === "OPEN" || c.status === "INVESTIGATING").length;

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {isAdmin ? "Soporte" : "Mis tickets"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {view === "playground" ? "Flujo visual de agentes y casos" :
               openCount > 0 ? `${openCount} caso${openCount > 1 ? "s" : ""} pendiente${openCount > 1 ? "s" : ""}` :
               "Sin casos pendientes"}
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
                <button
                  onClick={() => setView("list")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    view === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutList className="w-3.5 h-3.5" /> Lista
                </button>
                <button
                  onClick={() => setView("playground")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    view === "playground" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Map className="w-3.5 h-3.5" /> Playground
                </button>
              </div>
            </div>
          )}
        </div>

        {isAdmin && view === "playground" && <PlaygroundBoard />}

        {view !== "playground" && (
          <>
        <div className="flex gap-2 mb-6">
          {["OPEN", "INVESTIGATING", "RESOLVED", "ESCALATED", "all"].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                filter === status
                  ? "border-primary/50 bg-primary/10 text-primary"
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
                ? (isAdmin ? "No hay casos de soporte todavía" : "No tenés tickets abiertos. Cuando algo falle, abrimos uno automáticamente.")
                : "No hay casos con ese estado"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => {
              const RiskIcon = RISK_ICONS[c.risk_level] || Info;
              const riskColor = RISK_COLORS[c.risk_level] || "text-muted-foreground";
              const statusColor = STATUS_COLORS[c.status] || "bg-muted text-muted-foreground";
              const isOpen = c.status === "OPEN" || c.status === "INVESTIGATING";
              const isExpanded = expandedId === c.id;
              const evidence = parseEvidence(c.evidence_json);

              return (
                <div
                  key={c.id}
                  className={`rounded-md border bg-card/40 transition-colors ${
                    isOpen ? "border-primary/20" : "border-border/60 opacity-60"
                  }`}
                >
                  <div className="p-5">
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
                          <span className="text-[10px] text-muted-foreground/80 uppercase">{c.module}</span>
                          {c.error_code && (
                            <span className="text-[10px] text-muted-foreground/75 font-mono">{c.error_code}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(c.created_at).toLocaleDateString("es-CR", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedId(isExpanded ? null : c.id);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                          >
                            {isExpanded ? (
                              <><ChevronUp className="w-3 h-3" /> Ver menos</>
                            ) : (
                              <><ChevronDown className="w-3 h-3" /> Ver más</>
                            )}
                          </button>
                          {isOpen && isAdmin && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  statusMut.mutate({ id: c.id, status: "RESOLVED" });
                                }}
                                disabled={statusMut.isPending}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-md border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                              >
                                <Check className="w-3 h-3" /> Resuelto
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  statusMut.mutate({ id: c.id, status: "ESCALATED" });
                                }}
                                disabled={statusMut.isPending}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-md border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" /> Escalar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border/60 px-5 py-4 space-y-3 bg-muted/20">
                      <div className="flex flex-wrap items-center gap-2">
                        {c.category && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {CATEGORY_LABELS[c.category] || c.category}
                          </span>
                        )}
                        {c.error_code && (
                          <span className="text-[10px] text-muted-foreground/60 font-mono">{c.error_code}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground/75">
                          Actualizado: {new Date(c.updated_at).toLocaleDateString("es-CR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      {(evidence.workspace || evidence.user) && (
                        <div className="flex flex-wrap gap-4">
                          {evidence.workspace && (
                            <div className="flex items-center gap-2 text-xs">
                              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Workspace:</span>
                              <span className="text-foreground font-medium">{evidence.workspace.name}</span>
                              <span className="text-muted-foreground/80">({evidence.workspace.slug} · {evidence.workspace.plan})</span>
                            </div>
                          )}
                          {evidence.user && (
                            <div className="flex items-center gap-2 text-xs">
                              <UserCircle className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Usuario:</span>
                              <span className="text-foreground font-medium">{evidence.user.name}</span>
                              <span className="text-muted-foreground/80">({evidence.user.email} · {evidence.user.role})</span>
                            </div>
                          )}
                        </div>
                      )}

                      {(evidence.path || evidence.method || evidence.source) && (
                        <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground/60">
                          {evidence.source && <span>Source: <span className="text-foreground/70">{evidence.source}</span></span>}
                          {evidence.method && evidence.path && (
                            <span className="font-mono">
                              <span className="text-muted-foreground/75">{evidence.method}</span>{" "}
                              <span className="text-foreground/60">{evidence.path}</span>
                            </span>
                          )}
                          {evidence.status && <span>HTTP {evidence.status}</span>}
                        </div>
                      )}

                      {evidence.stack && isAdmin && (
                        <details className="mt-2">
                          <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">Ver stack trace</summary>
                          <pre className="mt-2 text-[10px] font-mono text-muted-foreground/70 bg-black/20 rounded-md p-3 overflow-auto max-h-64 whitespace-pre-wrap">
                            {evidence.stack}
                          </pre>
                        </details>
                      )}

                      {c.safe_summary && (
                        <div>
                          <p className="text-[11px] text-muted-foreground mb-1">Recomendación:</p>
                          <p className="text-xs text-foreground/80 leading-relaxed">{c.safe_summary}</p>
                        </div>
                      )}

                      {isAdmin && c.resolution_json && (
                        <div>
                          <p className="text-[11px] text-muted-foreground mb-1">Resolución:</p>
                          <div className="text-xs text-foreground/70 space-y-1">
                            {(c.resolution_json as any).resolution && <p>{(c.resolution_json as any).resolution}</p>}
                            {(c.resolution_json as any).workaround && <p className="text-muted-foreground/60">Workaround: {(c.resolution_json as any).workaround}</p>}
                          </div>
                        </div>
                      )}

                      {c.trace_id && (
                        <div className="text-[10px] text-muted-foreground/80 font-mono">
                          Trace: {c.trace_id}
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground/75 font-mono">
                        ID: {c.id}
                      </div>

                      {/* ── AI Orchestration ───────────────────────────── */}
                      {isAdmin && user?.is_platform_admin && (
                        <div className="border-t border-border/40 pt-4 mt-3">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Bot className="w-3 h-3" /> Análisis con agentes IA
                            </p>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => setShowRunHistory(showRunHistory === c.id ? null : c.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-md border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <History className="w-3 h-3" /> Historial
                              </button>
                              <button
                                onClick={() => orchestrateMut.mutate(c.id)}
                                disabled={orchestrateMut.isPending && orchestrateMut.variables === c.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-md border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
                              >
                                {orchestrateMut.isPending && orchestrateMut.variables === c.id ? (
                                  <><Loader2 className="w-3 h-3 animate-spin" /> Analizando...</>
                                ) : (
                                  <><Bot className="w-3 h-3" /> Analizar con IA</>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Run history */}
                          {showRunHistory === c.id && (
                            <CaseRunHistory caseId={c.id} />
                          )}

                          {/* Latest orchestration result */}
                          {orchestrationResults[c.id] && (
                            <OrchestrationResult result={orchestrationResults[c.id]} />
                          )}
                        </div>
                      )}

                      {isAdmin && (
                        <div className="border-t border-border/40 pt-4 mt-3">
                          <p className="text-[11px] text-muted-foreground mb-3 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> Comentarios
                          </p>
                          {commentsLoading ? (
                            <div className="flex items-center gap-2 py-2">
                              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                              <span className="text-[11px] text-muted-foreground">Cargando...</span>
                            </div>
                          ) : (
                            <div className="space-y-2 mb-3">
                              {(Array.isArray(comments) ? comments : []).map((cm) => (
                                <div key={cm.id} className="flex items-start gap-2 text-xs">
                                  <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold">
                                    {(cm.user?.name || cm.user?.email || "?").charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-foreground/80">{cm.user?.name || "Sistema"}</span>
                                      <span className="text-[10px] text-muted-foreground/80">
                                        {new Date(cm.created_at).toLocaleDateString("es-CR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                      </span>
                                    </div>
                                    <p className="text-muted-foreground/70 leading-relaxed">{cm.body}</p>
                                  </div>
                                </div>
                              ))}
                              {(comments === null || (Array.isArray(comments) && comments.length === 0)) && (
                                <p className="text-[11px] text-muted-foreground/80">Sin comentarios todavía.</p>
                              )}
                            </div>
                          )}
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (!newComment.trim()) return;
                              commentMut.mutate({ caseId: c.id, body: newComment });
                            }}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="text"
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              placeholder="Escribí un comentario..."
                              className="flex-1 px-3 py-1.5 text-xs rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground/80 focus:outline-none focus:border-primary/50"
                            />
                            <button
                              type="submit"
                              disabled={commentMut.isPending || !newComment.trim()}
                              className="p-1.5 rounded-md text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              {commentMut.isPending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
