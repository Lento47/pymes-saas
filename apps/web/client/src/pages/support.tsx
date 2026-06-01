import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, Link } from 'wouter';
import {
  MessageSquare,
  Smartphone,
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  LifeBuoy,
  Wifi,
  CreditCard,
  Bot,
  Building2,
  AlertCircle,
  Cog,
  ShieldCheck,
  Stethoscope,
  Clock,
  History,
  XCircle,
  Check,
  X,
  SkipForward,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { getSocket } from '@/hooks/use-socket';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

type SupportAgent = {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  initialPrompt: string;
};

const AGENTS: SupportAgent[] = [
  {
    id: 'whatsapp',
    title: 'WhatsApp',
    description: 'Diagnosticar conexión, código QR, mensajes no enviados.',
    icon: Smartphone,
    initialPrompt: 'Sos el asistente de soporte de PymesHub especializado en WhatsApp Business. Ayudá al usuario con problemas de conexión, código QR, mensajes, y configuración del canal de WhatsApp.',
  },
  {
    id: 'telegram',
    title: 'Telegram',
    description: 'Estado del bot, webhooks, comandos y configuración.',
    icon: Wifi,
    initialPrompt: 'Sos el asistente de soporte de PymesHub especializado en Telegram. Ayudá al usuario con problemas del bot, webhooks, comandos y configuración del canal de Telegram.',
  },
  {
    id: 'billing',
    title: 'Facturación',
    description: 'Pagos, suscripción, planes y facturas del sistema.',
    icon: CreditCard,
    initialPrompt: 'Sos el asistente de soporte de PymesHub especializado en facturación y planes. Ayudá al usuario con preguntas sobre pagos, suscripción, cambio de plan y facturas de la plataforma.',
  },
  {
    id: 'ai',
    title: 'Agente IA',
    description: 'Configuración del agente, respuestas y entrenamiento.',
    icon: Bot,
    initialPrompt: 'Sos el asistente de soporte de PymesHub especializado en el agente de inteligencia artificial. Ayudá al usuario con la configuración, respuestas, y entrenamiento del agente de IA.',
  },
  {
    id: 'workspace',
    title: 'Workspace',
    description: 'Cuenta, miembros, permisos y configuración general.',
    icon: Building2,
    initialPrompt: 'Sos el asistente de soporte de PymesHub especializado en gestión de workspace. Ayudá al usuario con configuración de cuenta, miembros, permisos y ajustes generales del workspace.',
  },
];

type OrchestrateResult = {
  run_id: string;
  tier: string;
  case_type?: string;
  severity?: string;
  status: 'COMPLETED' | 'NEEDS_HUMAN' | 'FAILED' | 'CLOSED';
  needs_human_review: boolean;
  stages: StageRecord[];
  summary: string;
  total_cost_credits?: number;
};

type StageRecord = {
  agent_slug: string;
  allowed: boolean;
  skipped_reason?: string;
  output_preview?: string;
  duration_ms?: number;
  error?: string;
  cost_credits?: number;
};

type LiveStage = {
  agent_slug: string;
  allowed: boolean;
  skipped_reason?: string;
  output_preview?: string;
  duration_ms?: number;
  error?: string;
  cost_credits?: number;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'agent' | 'system' | 'live-progress';
  content: string;
  result?: OrchestrateResult;
  liveStages?: LiveStage[];
};

const STAGE_ICONS: Record<string, typeof Stethoscope> = {
  'intake-triage': Stethoscope,
  diagnostic: Cog,
  'fix-proposal': LifeBuoy,
  'security-compliance': ShieldCheck,
  'pr-review': CheckCircle2,
};

function StageResult({ stage }: { stage: StageRecord | LiveStage }) {
  const Icon = STAGE_ICONS[stage.agent_slug] ?? Cog;
  const label = stage.agent_slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const isRunning = !stage.output_preview && !stage.error && !stage.skipped_reason;

  return (
    <div className={`flex items-start gap-2.5 rounded-md border px-3 py-2 text-xs ${
      isRunning ? 'border-primary/20 bg-primary/5' :
      stage.error ? 'border-destructive/20 bg-destructive/5' :
      stage.skipped_reason ? 'border-border/40 bg-muted/20' :
      'border-emerald-500/20 bg-emerald-500/5'
    }`}>
      <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
        isRunning ? 'text-primary animate-pulse' :
        stage.error ? 'text-destructive' :
        stage.skipped_reason ? 'text-muted-foreground/40' :
        'text-emerald-500'
      }`} />
      <div className="min-w-0">
        <p className="font-medium text-foreground">{label}</p>
        {isRunning ? (
          <p className="text-muted-foreground mt-0.5">
            <span className="inline-flex gap-0.5">
              {[0, 1, 2].map(i => (
                <span key={i} className="h-1 w-1 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </span>
          </p>
        ) : stage.error ? (
          <p className="text-destructive mt-0.5">{stage.error}</p>
        ) : stage.skipped_reason ? (
          <p className="text-muted-foreground mt-0.5">{stage.skipped_reason}</p>
        ) : (
          stage.output_preview && (
            <p className="text-muted-foreground mt-0.5 line-clamp-2">{stage.output_preview.slice(0, 300)}</p>
          )
        )}
        {stage.duration_ms && (
          <p className="text-muted-foreground/60 mt-0.5">{(stage.duration_ms / 1000).toFixed(1)}s</p>
        )}
        {stage.cost_credits != null && stage.cost_credits > 0 && !isRunning && (
          <p className="text-muted-foreground/60 mt-0.5">{stage.cost_credits.toFixed(2)} créditos</p>
        )}
      </div>
    </div>
  );
}

function ChatView({ agent, channelId, onBack }: { agent: SupportAgent; channelId?: string; onBack: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [escalating, setEscalating] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [caseClosed, setCaseClosed] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialized = useRef(false);
  const liveStagesRef = useRef<LiveStage[]>([]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (!isRunning) inputRef.current?.focus(); }, [isRunning]);

  // ── WebSocket: real-time orchestration progress ─────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onStageComplete = (payload: any) => {
      if (payload.run_id !== currentRunId) return;
      if (!payload.stage) return;

      liveStagesRef.current = [...liveStagesRef.current, payload.stage];

      setMessages(prev => prev.map(m =>
        m.id === 'live-progress' ? { ...m, liveStages: [...liveStagesRef.current] } : m
      ));
    };

    const onDone = (payload: any) => {
      if (payload.run_id !== currentRunId) return;
      setIsRunning(false);

      if (payload.result) {
        // Remove live-progress and add the final result
        setMessages(prev => {
          const withoutProgress = prev.filter(m => m.id !== 'live-progress');
          return [...withoutProgress, {
            id: crypto.randomUUID(),
            role: 'agent',
            content: payload.result.summary,
            result: payload.result,
          }];
        });
      }
    };

    socket.on('orchestration:stage-complete', onStageComplete);
    socket.on('orchestration:done', onDone);

    return () => {
      socket.off('orchestration:stage-complete', onStageComplete);
      socket.off('orchestration:done', onDone);
    };
  }, [currentRunId]);

  const sendMessage = useCallback(async (text: string, systemContext?: string) => {
    const messageText = text.trim();
    if (!messageText || isRunning) return;
    setError(null);
    setCaseClosed(false);
    liveStagesRef.current = [];

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: messageText };
    const progressMessage: ChatMessage = { id: 'live-progress', role: 'live-progress', content: '', liveStages: [] };

    setMessages(prev => [...prev, userMessage, progressMessage]);
    setInput('');
    setIsRunning(true);

    const payloadMessage = systemContext
      ? `[CONTEXTO DEL SISTEMA: ${systemContext}]\n\n${messageText}`
      : messageText;

    try {
      const result = await api.orchestrateSupport(payloadMessage, undefined, false) as OrchestrateResult;
      setCurrentRunId(result.run_id);

      // Only show if WebSocket didn't already deliver the result
      setMessages(prev => {
        const hasResult = prev.some(m => m.role === 'agent' && m.result?.run_id === result.run_id);
        if (hasResult) return prev;

        const withoutProgress = prev.filter(m => m.id !== 'live-progress');
        return [...withoutProgress, {
          id: crypto.randomUUID(),
          role: 'agent',
          content: result.summary,
          result,
        }];
      });

      if (result.needs_human_review) {
        setError('Este caso requiere revisión humana. Podés escalarlo usando el botón de arriba.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al conectar con el asistente';
      setError(msg);
      setMessages(prev => prev.filter(m => m.id !== 'live-progress'));
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, currentRunId]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const ctx = channelId
      ? `${agent.initialPrompt} El canal afectado tiene ID: ${channelId}.`
      : agent.initialPrompt;
    sendMessage(`Iniciá el diagnóstico de soporte para la categoría: ${agent.title}.`, ctx);
  }, []);

  const handleSend = () => sendMessage(input);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleEscalate = async () => {
    if (escalating || escalated) return;
    setEscalating(true);
    try {
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      await api.escalateToSupport(
        lastUserMsg?.content || `Escalación desde soporte — categoría: ${agent.title}`,
        'MEDIUM',
        { category: agent.id, channelId },
      );
      setEscalated(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la escalación');
    } finally {
      setEscalating(false);
    }
  };

  // Check if the last result needs human review or is closed
  const lastResult = [...messages].reverse().find(m => m.result)?.result;
  const showFollowUp = lastResult && !isRunning && !caseClosed &&
    lastResult.status !== 'CLOSED';

  const Icon = agent.icon;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Soporte
        </button>
        <span className="text-border">·</span>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span className="text-[13px] font-medium text-foreground">{agent.title}</span>
        </div>
        {lastResult && !caseClosed && lastResult.status !== 'CLOSED' && (
          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${
            lastResult.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600' :
            'bg-amber-500/10 text-amber-600'
          }`}>
            {lastResult.status === 'COMPLETED' ? 'Resuelto' : 'Pendiente'}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {showFollowUp && (
            <button
              onClick={() => { setCaseClosed(true); setError('Caso cerrado. Podés abrir uno nuevo volviendo al menú.'); }}
              className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Check className="w-3 h-3" />
              Cerrar caso
            </button>
          )}
          {messages.length > 1 && !escalated && (
            <button
              onClick={handleEscalate}
              disabled={escalating}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors disabled:opacity-50"
            >
              {escalating ? <Loader2 className="w-3 h-3 animate-spin" /> : <LifeBuoy className="w-3 h-3" />}
              Escalar a humano
            </button>
          )}
          {escalated && (
            <span className="flex items-center gap-1 text-[11px] text-success">
              <CheckCircle2 className="w-3 h-3" /> Caso abierto
            </span>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto max-w-[680px] space-y-4">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role !== 'user' && (
                <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                  msg.role === 'live-progress' ? 'border-primary/20 bg-primary/5 text-primary' :
                  msg.role === 'system' ? 'border-border bg-muted text-muted-foreground' :
                  'border-border bg-card text-muted-foreground'
                }`}>
                  {msg.role === 'live-progress' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : msg.role === 'system' ? (
                    '!'
                  ) : (
                    <MessageSquare className="w-3 h-3" />
                  )}
                </div>
              )}
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'rounded-lg bg-primary text-primary-foreground px-3 py-2.5 text-sm leading-relaxed' : ''}`}>
                {msg.role === 'user' ? (
                  msg.content
                ) : msg.role === 'live-progress' ? (
                  <div className="rounded-lg border border-border bg-card max-w-full overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-primary/20 bg-primary/5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      <span className="text-xs font-medium text-foreground">Ejecutando diagnóstico...</span>
                    </div>
                    <div className="px-4 py-3 space-y-2 max-h-96 overflow-y-auto">
                      {msg.liveStages && msg.liveStages.length > 0 ? (
                        msg.liveStages.map((stage, i) => (
                          <StageResult key={i} stage={stage} />
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">Iniciando agentes de soporte...</p>
                      )}
                    </div>
                  </div>
                ) : msg.role === 'agent' && msg.result ? (
                  <div className="rounded-lg border border-border bg-card text-foreground max-w-full overflow-hidden">
                    {/* Result header */}
                    <div className={`flex items-center gap-2 px-4 py-3 border-b ${
                      msg.result.status === 'COMPLETED' ? 'border-emerald-500/20 bg-emerald-500/5' :
                      msg.result.status === 'NEEDS_HUMAN' ? 'border-amber-500/20 bg-amber-500/5' :
                      'border-destructive/20 bg-destructive/5'
                    }`}>
                      {msg.result.status === 'COMPLETED' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : msg.result.status === 'NEEDS_HUMAN' ? (
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                      )}
                      <span className="text-xs font-medium">
                        {msg.result.status === 'COMPLETED' ? 'Diagnóstico completado' :
                         msg.result.status === 'NEEDS_HUMAN' ? 'Requiere revisión humana' :
                         'Diagnóstico fallido'}
                      </span>
                      <div className="ml-auto flex items-center gap-1">
                        {msg.result.tier && (
                          <span className="text-[10px] text-muted-foreground">Tier {msg.result.tier}</span>
                        )}
                        {msg.result.total_cost_credits != null && msg.result.total_cost_credits > 0 && (
                          <span className="text-[10px] text-muted-foreground ml-1">{msg.result.total_cost_credits.toFixed(1)} créd.</span>
                        )}
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="px-4 py-3">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="mb-2 list-disc pl-4 text-sm last:mb-0">{children}</ul>,
                          ol: ({ children }) => <ol className="mb-2 list-decimal pl-4 text-sm last:mb-0">{children}</ol>,
                          li: ({ children }) => <li className="mb-0.5 text-sm">{children}</li>,
                          code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">{children}</code>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        }}
                      >{msg.result.summary}</ReactMarkdown>
                    </div>

                    {/* Stages */}
                    {msg.result.stages.length > 0 && (
                      <div className="border-t border-border px-4 py-3 space-y-2">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Pipeline de diagnóstico</p>
                        {msg.result.stages.map((stage, i) => (
                          <StageResult key={i} stage={stage} />
                        ))}
                      </div>
                    )}

                    {/* Follow-up hint */}
                    {!caseClosed && msg.result.summary && (
                      <div className="border-t border-border px-4 py-2">
                        <p className="text-[10px] text-muted-foreground">
                          ¿Necesitás más ayuda? Escribí tu consulta abajo o usá "Cerrar caso" cuando esté resuelto.
                        </p>
                      </div>
                    )}
                  </div>
                ) : msg.role === 'system' ? (
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-card px-3 py-2.5">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="mb-2 list-disc pl-4 text-sm last:mb-0">{children}</ul>,
                        li: ({ children }) => <li className="mb-0.5 text-sm">{children}</li>,
                      }}
                    >{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
          {error && (
            <div className="flex items-center gap-2 justify-center">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
          {!isRunning && !caseClosed && messages.length > 3 && (
            <div className="flex justify-center pt-2">
              <span className="text-[10px] text-muted-foreground/50">
                {lastResult?.run_id?.slice(0, 8)}
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      {!caseClosed && (
        <div className="shrink-0 border-t border-border bg-card px-4 py-3">
          <div className="mx-auto max-w-[680px] flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isRunning}
              placeholder={showFollowUp ? "Escribí para continuar el diagnóstico..." : "Describí tu problema..."}
              rows={1}
              className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
              style={{ minHeight: 36, maxHeight: 120 }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isRunning}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RunDetailExpanded({ runId, onClose }: { runId: string; onClose: () => void }) {
  const [liveStages, setLiveStages] = useState<LiveStage[]>([]);
  const [runStatus, setRunStatus] = useState<string | null>(null);

  const { data: detail, isLoading } = useQuery({
    queryKey: ["supportRun", runId],
    queryFn: () => api.getSupportRun(runId),
    staleTime: 15_000,
  });

  // WebSocket: live progress for active runs
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onStage = (payload: any) => {
      if (payload.run_id !== runId) return;
      if (!payload.stage) return;
      setLiveStages(prev => [...prev, payload.stage]);
    };
    const onDone = (payload: any) => {
      if (payload.run_id !== runId) return;
      setRunStatus(payload.result?.status ?? 'COMPLETED');
    };

    socket.on('orchestration:stage-complete', onStage);
    socket.on('orchestration:done', onDone);
    return () => {
      socket.off('orchestration:stage-complete', onStage);
      socket.off('orchestration:done', onDone);
    };
  }, [runId]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        Cargando detalle del caso...
      </div>
    );
  }

  const run = detail as Record<string, any> | null;
  if (!run) {
    return (
      <div className="px-4 py-3 text-xs text-muted-foreground">No se pudo cargar el detalle.</div>
    );
  }

  const stages: any[] = Array.isArray(run.stages) ? run.stages : [];
  const isRunning = run.status === 'RUNNING' || (!runStatus && run.status !== 'COMPLETED' && run.status !== 'FAILED' && run.status !== 'NEEDS_HUMAN' && run.status !== 'CLOSED');
  const statusLabel = runStatus ?? run.status;
  const showStages = stages.length > 0 || liveStages.length > 0;
  const allStages = [...stages, ...liveStages.filter(ls => !stages.some(s => s.agent_slug === ls.agent_slug))];

  return (
    <div className="border-t border-border/60">
      {/* Status header */}
      <div className={`flex items-center gap-2 px-4 py-2.5 ${
        statusLabel === 'COMPLETED' ? 'border-b border-emerald-500/10 bg-emerald-500/[0.03]' :
        statusLabel === 'NEEDS_HUMAN' ? 'border-b border-amber-500/10 bg-amber-500/[0.03]' :
        statusLabel === 'RUNNING' ? 'border-b border-primary/10 bg-primary/[0.03]' :
        statusLabel === 'FAILED' ? 'border-b border-destructive/10 bg-destructive/[0.03]' :
        'border-b border-muted-foreground/10 bg-muted/[0.02]'
      }`}>
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
          statusLabel === 'COMPLETED' ? 'text-emerald-600 border-emerald-500/30 bg-emerald-500/5' :
          statusLabel === 'NEEDS_HUMAN' ? 'text-amber-600 border-amber-500/30 bg-amber-500/5' :
          statusLabel === 'RUNNING' ? 'text-primary border-primary/30 bg-primary/5' :
          statusLabel === 'FAILED' ? 'text-destructive border-destructive/30 bg-destructive/5' :
          'text-muted-foreground border-border bg-muted'
        }`}>
          {statusLabel === 'RUNNING' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
          {statusLabel === 'COMPLETED' && <CheckCircle2 className="w-2.5 h-2.5" />}
          {statusLabel === 'NEEDS_HUMAN' && <AlertCircle className="w-2.5 h-2.5" />}
          {statusLabel === 'FAILED' && <XCircle className="w-2.5 h-2.5" />}
          {statusLabel === 'CLOSED' && <X className="w-2.5 h-2.5" />}
          {statusLabel === 'COMPLETED' ? 'Resuelto' :
           statusLabel === 'NEEDS_HUMAN' ? 'Requiere revisión' :
           statusLabel === 'RUNNING' ? 'En progreso' :
           statusLabel === 'FAILED' ? 'Falló' :
           statusLabel === 'CLOSED' ? 'Cerrado' :
           statusLabel}
        </span>
        {run.case_type && (
          <span className="text-[10px] text-muted-foreground capitalize">{run.case_type}</span>
        )}
        {run.severity && (
          <span className="text-[10px] text-muted-foreground/70">· {run.severity}</span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground/60">
          {run.created_at ? formatDistanceToNow(new Date(run.created_at), { addSuffix: true, locale: es }) : ''}
        </span>
      </div>

      {/* Summary */}
      {run.summary && (
        <div className="px-4 py-3 border-b border-border/30">
          <ReactMarkdown remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="text-xs leading-relaxed text-foreground/80 mb-1.5 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="mb-1.5 list-disc pl-4 text-xs last:mb-0">{children}</ul>,
              li: ({ children }) => <li className="mb-0.5 text-xs">{children}</li>,
              code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono">{children}</code>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            }}
          >{run.summary}</ReactMarkdown>
        </div>
      )}

      {/* Pipeline stages */}
      {showStages && (
        <div className="px-4 py-3 space-y-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {isRunning ? 'Pipeline en ejecución' : 'Pipeline ejecutado'}
          </p>
          {allStages.map((stage: any, i: number) => {
            const isLive = !stage.output_preview && !stage.error && !stage.skipped_reason && isRunning;
            return (
              <div key={i} className={`flex items-start gap-2.5 rounded-md border px-3 py-2 text-xs ${
                isLive ? 'border-primary/20 bg-primary/5' :
                stage.error ? 'border-destructive/20 bg-destructive/5' :
                stage.skipped_reason ? 'border-border/40 bg-muted/20' :
                'border-emerald-500/20 bg-emerald-500/5'
              }`}>
                {isLive ? (
                  <Loader2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary animate-spin" />
                ) : stage.error ? (
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-destructive" />
                ) : stage.skipped_reason ? (
                  <SkipForward className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground/40" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">
                    {stage.agent_slug?.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) ?? 'Stage'}
                  </p>
                  {isLive ? (
                    <p className="text-muted-foreground mt-0.5">Ejecutando...</p>
                  ) : stage.error ? (
                    <p className="text-destructive mt-0.5">{stage.error}</p>
                  ) : stage.skipped_reason ? (
                    <p className="text-muted-foreground mt-0.5">{stage.skipped_reason}</p>
                  ) : (
                    stage.output_preview && (
                      <p className="text-muted-foreground mt-0.5 line-clamp-2">{stage.output_preview.slice(0, 300)}</p>
                    )
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {stage.duration_ms && (
                      <span className="text-[10px] text-muted-foreground/60">{(stage.duration_ms / 1000).toFixed(1)}s</span>
                    )}
                    {stage.cost_credits != null && stage.cost_credits > 0 && (
                      <span className="text-[10px] text-muted-foreground/60">{stage.cost_credits.toFixed(2)} créd.</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {isRunning && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-primary/20 bg-primary/5">
              <Loader2 className="w-3 h-3 text-primary animate-spin shrink-0" />
              <span className="text-[10px] text-primary/80">Esperando siguiente etapa...</span>
            </div>
          )}
        </div>
      )}

      {/* Cost footer */}
      {(run.total_cost_credits != null && run.total_cost_credits > 0) && (
        <div className="flex items-center justify-between border-t border-border/30 px-4 py-2">
          <span className="text-[10px] text-muted-foreground">
            {liveStages.length > 0 ? 'Costo acumulado' : 'Costo total'}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">{run.total_cost_credits.toFixed(2)} créditos</span>
        </div>
      )}
    </div>
  );
}

function SupportHistorySection() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: runs, isLoading } = useQuery({
    queryKey: ["supportRuns"],
    queryFn: () => api.listSupportRuns(15),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Cargando casos recientes...
      </div>
    );
  }

  const items = Array.isArray(runs) ? runs : (runs as any)?.data ?? [];

  if (items.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-medium text-foreground">Casos recientes</h2>
        <span className="text-[10px] text-muted-foreground/60 ml-1">{items.length}</span>
      </div>
      <div className="space-y-1.5">
        {items.slice(0, 10).map((run: any) => {
          const isExpanded = expandedId === run.id;
          const isActive = run.status === 'RUNNING';

          return (
            <div
              key={run.id}
              className={`rounded-lg border transition-colors ${
                isExpanded ? 'border-primary/30 bg-card' :
                'border-border bg-card/60 hover:border-border/80 hover:bg-card'
              }`}
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : run.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <div className={`flex-shrink-0 w-2 h-2 rounded-full ${
                  isActive ? 'bg-primary animate-pulse' :
                  run.status === 'COMPLETED' ? 'bg-emerald-500' :
                  run.status === 'NEEDS_HUMAN' ? 'bg-amber-500' :
                  run.status === 'CLOSED' ? 'bg-muted-foreground/40' :
                  run.status === 'FAILED' ? 'bg-destructive' :
                  'bg-muted-foreground/50'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">
                    {run.case_type ? (run.case_type.charAt(0).toUpperCase() + run.case_type.slice(1)) : 'Soporte'} · {run.severity ?? '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {run.summary?.slice(0, 120) ?? 'Sin resumen'}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right flex items-center gap-2">
                  <div>
                    <p className="text-[11px] text-muted-foreground">
                      {run.created_at ? formatDistanceToNow(new Date(run.created_at), { addSuffix: true, locale: es }) : ''}
                    </p>
                    {run.total_cost_credits != null && run.total_cost_credits > 0 && (
                      <p className="text-[10px] text-muted-foreground/60">{run.total_cost_credits.toFixed(2)} créd.</p>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <RunDetailExpanded runId={run.id} onClose={() => setExpandedId(null)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SupportPage() {
  useRequireAuth();
  const [location] = useLocation();
  const params = new URLSearchParams(location.split('?')[1] || '');
  const agentParam = params.get('agent') || params.get('context');
  const channelId = params.get('channel') || undefined;

  const [selectedAgent, setSelectedAgent] = useState<SupportAgent | null>(() => {
    if (!agentParam) return null;
    return AGENTS.find(a => a.id === agentParam || agentParam.toLowerCase().includes(a.id)) ?? null;
  });

  if (selectedAgent) {
    return (
      <div className="flex h-full flex-col overflow-hidden" style={{ background: 'hsl(var(--bg))' }}>
        <ChatView agent={selectedAgent} channelId={channelId} onBack={() => setSelectedAgent(null)} />
      </div>
    );
  }

  return (
    <div className="min-h-full" style={{ background: 'hsl(var(--bg))' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-foreground">Soporte</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seleccioná el área con la que necesitás ayuda para iniciar el diagnóstico.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {AGENTS.map(agent => {
            const Icon = agent.icon;
            return (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className="group flex items-start gap-4 rounded-lg border border-border bg-card px-5 py-4 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground group-hover:border-primary/30 group-hover:text-primary transition-colors">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground">{agent.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{agent.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <SupportHistorySection />

        <div className="mt-8 rounded-lg border border-border bg-card px-5 py-4">
          <div className="flex items-center gap-3">
            <LifeBuoy className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-foreground">¿Ya abriste un caso antes?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Podés ver el historial de tickets en{' '}
                <Link href="/admin/support" className="text-primary hover:underline">
                  panel de administración
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
