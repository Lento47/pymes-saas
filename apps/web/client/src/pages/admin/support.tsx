import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth, useRequireAuth } from "@/hooks/use-auth";
import { Search, Bug, ShieldAlert, AlertTriangle, Info, Clock, Check, ExternalLink, ChevronDown, ChevronUp, Building2, UserCircle, LayoutList, Map, MessageSquare, Send, Loader2, Bot, CheckCircle2, AlertCircle, SkipForward, History, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/hooks/use-socket";
import { PlaygroundBoard } from "@/components/playground/PlaygroundBoard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const RISK_ICONS: Record<string, any> = {
  critical: AlertTriangle,
  high: Bug,
  medium: ShieldAlert,
  low: Info,
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  INVESTIGATING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  RESOLVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  ESCALATED: "bg-red-500/10 text-red-400 border-red-500/30",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  OPEN: "default",
  INVESTIGATING: "secondary",
  RESOLVED: "outline",
  ESCALATED: "destructive",
  COMPLETED: "outline",
  NEEDS_HUMAN: "secondary",
  RUNNING: "default",
  FAILED: "destructive",
  CLOSED: "outline",
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

function LivePipeline({ runId, stages, tier }: { runId: string; stages: any[]; tier?: string }) {
  return (
    <Card className="mb-3">
      <CardHeader className="flex-row items-center gap-2 p-3 pb-2">
        <Zap className="w-3 h-3 text-primary animate-pulse shrink-0" />
        <CardTitle className="text-[11px] font-medium text-primary">Pipeline en ejecución</CardTitle>
        {tier && <Badge variant="outline" className="text-[10px] ml-auto">{tier}</Badge>}
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 space-y-1">
        {stages.length === 0 ? (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> Iniciando agentes…
          </div>
        ) : (
          <>
            {stages.map((stage: any, i: number) => (
              <div key={`${runId}-${i}`} className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border/40 bg-background/60">
                {stage.allowed === false ? (
                  <SkipForward className="w-3 h-3 shrink-0 text-muted-foreground/50" />
                ) : stage.error ? (
                  <AlertCircle className="w-3 h-3 shrink-0 text-red-400" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-500" />
                )}
                <span className="flex-1 text-[11px] text-foreground/80">{STAGE_LABELS[stage.agent_slug] ?? stage.agent_slug}</span>
                {stage.duration_ms != null && (
                  <span className="text-[10px] text-muted-foreground/60">{stage.duration_ms}ms</span>
                )}
              </div>
            ))}
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-primary/20 bg-primary/5">
              <Loader2 className="w-3 h-3 shrink-0 text-primary animate-spin" />
              <span className="text-[11px] text-primary/80">Ejecutando siguiente etapa…</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function OrchestrationResult({ result }: { result: Record<string, any> }) {
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const stages: any[] = Array.isArray(result.stages) ? result.stages : [];

  return (
    <Card className="mb-3">
      <CardContent className="p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANTS[result.status] ?? "secondary"} className="text-[10px]">
            {result.status}
          </Badge>
          {result.case_type && (
            <Badge variant="outline" className="text-[10px]">{result.case_type}</Badge>
          )}
          {result.severity && (
            <Badge variant="outline" className="text-[10px]">{result.severity}</Badge>
          )}
          {result.needs_human_review && (
            <Badge variant="secondary" className="text-[10px] flex items-center gap-1">
              <AlertCircle className="w-2.5 h-2.5" /> Requiere revisión humana
            </Badge>
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
      </CardContent>
    </Card>
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
          <Badge variant={STATUS_VARIANTS[run.status] ?? "secondary"} className="text-[10px] px-1.5 py-0">{run.status}</Badge>
          {run.case_type && <span>{run.case_type}</span>}
          {run.severity && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{run.severity}</Badge>}
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
  const isAdmin = user?.role === "ADMIN" || user?.is_platform_admin === true;
  const [view, setView] = useState<"list" | "playground">("list");
  const [filter, setFilter] = useState("OPEN");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [orchestrationResults, setOrchestrationResults] = useState<Record<string, any>>({});
  const [showRunHistory, setShowRunHistory] = useState<string | null>(null);
  const [liveRuns, setLiveRuns] = useState<Record<string, { runId: string; tier?: string; stages: any[] }>>({});
  const queryClient = useQueryClient();
  const liveRunsRef = useRef(liveRuns);
  liveRunsRef.current = liveRuns;

  useEffect(() => {
    const url = new URL(window.location.href);
    const caseId = url.searchParams.get("case");
    if (caseId) setExpandedId(caseId);
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onStarted = (payload: any) => {
      const caseId: string | undefined = payload.diagnostic_case_id;
      if (!caseId) return;
      setLiveRuns(prev => ({ ...prev, [caseId]: { runId: payload.run_id, tier: payload.tier, stages: [] } }));
      setExpandedId(prev => prev ?? caseId);
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
      queryClient.invalidateQueries({ queryKey: ["diagnostic-cases"] });
      queryClient.invalidateQueries({ queryKey: ["case-runs", caseId] });
    };

    socket.on("orchestration:started", onStarted);
    socket.on("orchestration:stage-complete", onStageComplete);
    socket.on("orchestration:done", onDone);

    return () => {
      socket.off("orchestration:started", onStarted);
      socket.off("orchestration:stage-complete", onStageComplete);
      socket.off("orchestration:done", onDone);
    };
  }, [queryClient]);

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
                <Button
                  variant={view === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("list")}
                  className="text-xs"
                >
                  <LayoutList className="w-3.5 h-3.5" /> Lista
                </Button>
                <Button
                  variant={view === "playground" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("playground")}
                  className="text-xs"
                >
                  <Map className="w-3.5 h-3.5" /> Playground
                </Button>
              </div>
            </div>
          )}
        </div>

        {isAdmin && view === "playground" && <PlaygroundBoard />}

        {view !== "playground" && (
          <>
            <div className="flex gap-2 mb-6">
              {["OPEN", "INVESTIGATING", "RESOLVED", "ESCALATED", "all"].map((status) => (
                <Button
                  key={status}
                  variant={filter === status ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilter(status)}
                  className="text-xs"
                >
                  {status === "all" ? "Todos" : status}
                </Button>
              ))}
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-5">
                      <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </CardContent>
                  </Card>
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
                  const isOpen = c.status === "OPEN" || c.status === "INVESTIGATING";
                  const isExpanded = expandedId === c.id;
                  const evidence = parseEvidence(c.evidence_json);

                  return (
                    <Card
                      key={c.id}
                      className={isOpen ? "border-primary/20" : "opacity-60"}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <RiskIcon className={`w-4 h-4 ${c.risk_level === "critical" ? "text-red-400" : c.risk_level === "high" ? "text-orange-400" : c.risk_level === "medium" ? "text-yellow-400" : "text-muted-foreground"}`} />
                              <CardTitle className="text-sm truncate">{c.title}</CardTitle>
                            </div>
                            {c.user_description && (
                              <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">
                                {c.user_description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <Badge variant={STATUS_VARIANTS[c.status] ?? "secondary"} className="text-[10px] px-1.5 py-0">
                                {c.status}
                              </Badge>
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
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedId(isExpanded ? null : c.id);
                                }}
                                className="text-[10px] h-6 px-2.5"
                              >
                                {isExpanded ? <><ChevronUp className="w-3 h-3" /> Ver menos</> : <><ChevronDown className="w-3 h-3" /> Ver más</>}
                              </Button>

                              {isAdmin && isOpen && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); statusMut.mutate({ id: c.id, status: "INVESTIGATING" }); }}
                                  className="text-[10px] h-6 px-2.5"
                                >
                                  <Search className="w-3 h-3" /> Investigar
                                </Button>
                              )}
                              {isAdmin && c.status === "INVESTIGATING" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); statusMut.mutate({ id: c.id, status: "ESCALATED" }); }}
                                  className="text-[10px] h-6 px-2.5"
                                >
                                  <ExternalLink className="w-3 h-3" /> Escalar
                                </Button>
                              )}
                              {isAdmin && (c.status === "INVESTIGATING" || c.status === "ESCALATED" || c.status === "OPEN") && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); statusMut.mutate({ id: c.id, status: "RESOLVED" }); }}
                                  className="text-[10px] h-6 px-2.5"
                                >
                                  <Check className="w-3 h-3" /> Resolver
                                </Button>
                              )}
                              {isAdmin && (c.status === "RESOLVED" || c.status === "ESCALATED") && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); statusMut.mutate({ id: c.id, status: "INVESTIGATING" }); }}
                                  className="text-[10px] h-6 px-2.5"
                                >
                                  <AlertCircle className="w-3 h-3" /> Reabrir
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Live pipeline for in-progress runs */}
                        {liveRuns[c.id] && (
                          <div className="mt-3">
                            <Separator className="mb-3" />
                            <LivePipeline runId={liveRuns[c.id].runId} stages={liveRuns[c.id].stages} tier={liveRuns[c.id].tier} />
                          </div>
                        )}

                        {/* Orchestration result */}
                        {orchestrationResults[c.id] && !liveRuns[c.id] && (
                          <div className="mt-3">
                            <Separator className="mb-3" />
                            <OrchestrationResult result={orchestrationResults[c.id]} />
                            {/* Re-run button */}
                            {isAdmin && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); orchestrateMut.mutate(c.id); }}
                                disabled={orchestrateMut.isPending}
                                className="text-[10px] h-6 px-2.5"
                              >
                                {orchestrateMut.isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Bot className="w-3 h-3" />
                                )}
                                Re-ejecutar diagnóstico
                              </Button>
                            )}
                          </div>
                        )}

                        {/* Orchestrate button */}
                        {!orchestrationResults[c.id] && !liveRuns[c.id] && isAdmin && (
                          <div className="mt-3 pt-3 border-t border-border/40">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); orchestrateMut.mutate(c.id); }}
                              disabled={orchestrateMut.isPending}
                              className="text-[10px] h-6 px-2.5"
                            >
                              {orchestrateMut.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Bot className="w-3 h-3" />
                              )}
                              Ejecutar diagnóstico
                            </Button>
                          </div>
                        )}

                        {isExpanded && (
                          <div className="mt-3">
                            <Separator className="mb-3" />
                            {evidence.workspace && (
                              <Card className="mb-3 bg-muted/20 border">
                                <CardContent className="p-3">
                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
                                    <Building2 className="w-3 h-3 shrink-0" />
                                    Workspace
                                  </div>
                                  <div className="space-y-0.5 text-xs">
                                    {evidence.workspace.name && <p><span className="text-muted-foreground/70">Nombre:</span> {evidence.workspace.name}</p>}
                                    {evidence.workspace.slug && <p><span className="text-muted-foreground/70">Slug:</span> {evidence.workspace.slug}</p>}
                                    {evidence.workspace.plan && <p><span className="text-muted-foreground/70">Plan:</span> {evidence.workspace.plan}</p>}
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                            {evidence.user && (
                              <Card className="mb-3 bg-muted/20 border">
                                <CardContent className="p-3">
                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
                                    <UserCircle className="w-3 h-3 shrink-0" />
                                    Usuario
                                  </div>
                                  <div className="space-y-0.5 text-xs">
                                    {evidence.user.name && <p><span className="text-muted-foreground/70">Nombre:</span> {evidence.user.name}</p>}
                                    {evidence.user.email && <p><span className="text-muted-foreground/70">Email:</span> {evidence.user.email}</p>}
                                    {evidence.user.role && <p><span className="text-muted-foreground/70">Rol:</span> {evidence.user.role}</p>}
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                            {evidence.path && (
                              <p className="text-[11px] text-muted-foreground mb-1">
                                <span className="font-mono text-muted-foreground/70">{evidence.method ?? "—"}</span>{" "}
                                <span className="font-mono">{evidence.path}</span>
                                {evidence.status && <span> → {evidence.status}</span>}
                              </p>
                            )}
                            {evidence.source && (
                              <p className="text-[10px] text-muted-foreground/70 mb-2">Origen: {evidence.source}</p>
                            )}
                            {evidence.stack && (
                              <pre className="text-[10px] font-mono text-muted-foreground/80 bg-muted/40 rounded p-2.5 overflow-x-auto mb-3 max-h-32 overflow-y-auto">
                                {evidence.stack}
                              </pre>
                            )}

                            {/* Run history */}
                            {isAdmin && c.id && (
                              <>
                                <div className="flex items-center gap-2 mt-2 mb-2">
                                  <History className="w-3.5 h-3.5 text-muted-foreground" />
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setShowRunHistory(showRunHistory === c.id ? null : c.id); }}
                                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    {showRunHistory === c.id ? "Ocultar historial" : "Ver historial de ejecuciones"}
                                  </button>
                                </div>
                                {showRunHistory === c.id && <CaseRunHistory caseId={c.id} />}
                              </>
                            )}

                            {/* Comments */}
                            {isAdmin && comments && Array.isArray(comments) && (
                              <div className="space-y-2 mb-3">
                                {comments.map((comment: any) => (
                                  <div key={comment.id} className="rounded-md border border-border/40 bg-background/60 p-2.5">
                                    <div className="flex items-center gap-2 mb-1">
                                      <MessageSquare className="w-3 h-3 text-muted-foreground shrink-0" />
                                      <span className="text-[10px] text-muted-foreground">
                                        {new Date(comment.created_at).toLocaleDateString("es-CR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                      </span>
                                    </div>
                                    <p className="text-xs text-foreground/80">{comment.body}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {isAdmin && (
                              <div className="flex items-center gap-2 mt-2">
                                <input
                                  value={newComment}
                                  onChange={(e) => setNewComment(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  placeholder="Agregar comentario interno..."
                                  className="flex-1 text-xs rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                                />
                                <Button
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); if (newComment.trim()) { commentMut.mutate({ caseId: c.id, body: newComment.trim() }); } }}
                                  disabled={commentMut.isPending || !newComment.trim()}
                                  className="text-[10px] h-7"
                                >
                                  {commentMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                  Enviar
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
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
