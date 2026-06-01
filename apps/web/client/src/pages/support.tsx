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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

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

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  COMPLETED: 'default',
  NEEDS_HUMAN: 'secondary',
  NEEDS_CLARIFICATION: 'outline',
  RUNNING: 'outline',
  FAILED: 'destructive',
  CLOSED: 'secondary',
};

function StatusBadge({ status }: { status: string }) {
  type VariantType = 'default' | 'secondary' | 'destructive' | 'outline';
  const icon = (variant: VariantType) => {
    switch (status) {
      case 'RUNNING': return <Loader2 className="w-3 h-3 animate-spin" />;
      case 'COMPLETED': return <CheckCircle2 className="w-3 h-3" />;
      case 'NEEDS_HUMAN': return <AlertCircle className="w-3 h-3" />;
      case 'NEEDS_CLARIFICATION': return <MessageSquare className="w-3 h-3" />;
      case 'FAILED': return <XCircle className="w-3 h-3" />;
      case 'CLOSED': return <X className="w-3 h-3" />;
      default: return null;
    }
  };
  const label = 
    status === 'COMPLETED' ? 'Resuelto' :
    status === 'NEEDS_HUMAN' ? 'Requiere revisión' :
    status === 'NEEDS_CLARIFICATION' ? 'Pide más datos' :
    status === 'RUNNING' ? 'En progreso' :
    status === 'FAILED' ? 'Falló' :
    status === 'CLOSED' ? 'Cerrado' : status;

  return (
    <Badge variant={STATUS_VARIANTS[status] ?? 'secondary'} className="gap-1 text-[10px] px-1.5 py-0">
      {icon(STATUS_VARIANTS[status] ?? 'secondary')}
      {label}
    </Badge>
  );
}

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
            <p className="text-muted-foreground mt-0.5 line-clamp-4">{stage.output_preview.slice(0, 800)}</p>
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
  const [clarifying, setClarifying] = useState(false);
  const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialized = useRef(false);
  const liveStagesRef = useRef<LiveStage[]>([]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (!isRunning) inputRef.current?.focus(); }, [isRunning]);

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

      // If the triage agent needs clarification, show questions to user
      if ((result as any).status === 'NEEDS_CLARIFICATION' && (result as any).questions?.length) {
        setClarificationQuestions((result as any).questions);
        setClarifying(true);
      }
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const isAbort = rawMsg.includes('abort') || rawMsg.includes('AbortError') || rawMsg.includes('timeout');
      const msg = isAbort
        ? 'El diagnóstico está tardando más de lo esperado. No te preocupes — los agentes siguen trabajando. Revisá "Casos recientes" en unos segundos para ver el resultado.'
        : rawMsg || 'Error al conectar con el asistente';
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
  const handleSendClarification = async () => {
    if (!currentRunId || !input.trim() || clarifying === false || isRunning) return;
    setClarifying('sending');
    setError(null);

    const answerText = input.trim();
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: answerText };
    const progressMessage: ChatMessage = { id: 'live-progress', role: 'live-progress', content: '', liveStages: [] };

    setMessages(prev => [...prev, userMessage, progressMessage]);
    setInput('');
    setIsRunning(true);
    liveStagesRef.current = [];

    try {
      const result = await api.continueSupport(currentRunId, answerText) as OrchestrateResult;
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
      setClarifying(false);
      setClarificationQuestions([]);
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const isAbort = rawMsg.includes('abort') || rawMsg.includes('AbortError') || rawMsg.includes('timeout');
      const msg = isAbort
        ? 'El diagnóstico continúa en segundo plano. Revisá "Casos recientes" en unos segundos.'
        : rawMsg || 'Error al continuar el diagnóstico';
      setError(msg);
      setMessages(prev => prev.filter(m => m.id !== 'live-progress'));
    } finally {
      setIsRunning(false);
      setClarifying(false);
    }
  };

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

  const lastResult = [...messages].reverse().find(m => m.result)?.result;
  const showFollowUp = lastResult && !isRunning && !caseClosed && lastResult.status !== 'CLOSED';
  const Icon = agent.icon;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-xs -ml-2">
          <ChevronLeft className="w-3.5 h-3.5" />
          Soporte
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span className="text-[13px] font-medium text-foreground">{agent.title}</span>
        </div>
        {lastResult && !caseClosed && lastResult.status !== 'CLOSED' && (
          <StatusBadge status={lastResult.status} />
        )}
        <div className="ml-auto flex items-center gap-2">
          {showFollowUp && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setCaseClosed(true); setError('Caso cerrado. Podés abrir uno nuevo volviendo al menú.'); }}
              className="text-[11px] h-7"
            >
              <Check className="w-3 h-3" />
              Cerrar caso
            </Button>
          )}
          {messages.length > 1 && !escalated && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEscalate}
              disabled={escalating}
              className="text-[11px] h-7"
            >
              {escalating ? <Loader2 className="w-3 h-3 animate-spin" /> : <LifeBuoy className="w-3 h-3" />}
              Escalar a humano
            </Button>
          )}
          {escalated && (
            <Badge variant="default" className="gap-1 text-[11px]">
              <CheckCircle2 className="w-3 h-3" /> Caso abierto
            </Badge>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto max-w-[680px] space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role !== 'user' && (
                <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                  msg.role === 'live-progress' ? 'border-primary/20 bg-primary/5 text-primary' :
                  msg.role === 'system' ? 'border-border bg-muted text-muted-foreground' :
                  'border-border bg-card text-muted-foreground'
                }`}>
                  {msg.role === 'live-progress' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : msg.role === 'system' ? '!' : <MessageSquare className="w-3 h-3" />}
                </div>
              )}
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'rounded-lg bg-primary text-primary-foreground px-3 py-2.5 text-sm leading-relaxed' : ''}`}>
                {msg.role === 'user' ? (
                  msg.content
                ) : msg.role === 'live-progress' ? (
                  <Card className="max-w-full overflow-hidden">
                    <CardHeader className="flex-row items-center gap-2 px-4 py-3 border-b border-primary/20 bg-primary/5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      <CardTitle className="text-xs font-medium">Ejecutando diagnóstico...</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 py-3 space-y-2">
                      {msg.liveStages && msg.liveStages.length > 0 ? (
                        msg.liveStages.map((stage, i) => <StageResult key={i} stage={stage} />)
                      ) : (
                        <p className="text-xs text-muted-foreground">Iniciando agentes de soporte...</p>
                      )}
                    </CardContent>
                  </Card>
                ) : msg.role === 'agent' && msg.result ? (
                  <Card className="max-w-full overflow-hidden">
                    <CardHeader className={`flex-row items-center gap-2 px-4 py-3 border-b ${
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
                      <CardTitle className="text-xs font-medium">
                        {msg.result.status === 'COMPLETED' ? 'Diagnóstico completado' :
                         msg.result.status === 'NEEDS_HUMAN' ? 'Requiere revisión humana' : 'Diagnóstico fallido'}
                      </CardTitle>
                      <div className="ml-auto flex items-center gap-1">
                        {msg.result.tier && (
                          <span className="text-[10px] text-muted-foreground">Tier {msg.result.tier}</span>
                        )}
                        {msg.result.total_cost_credits != null && msg.result.total_cost_credits > 0 && (
                          <Badge variant="outline" className="text-[10px]">{msg.result.total_cost_credits.toFixed(1)} créd.</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 py-3">
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
                    </CardContent>
                    {msg.result.stages.length > 0 && (
                      <>
                        <Separator />
                        <CardContent className="px-4 py-3 space-y-2">
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Pipeline de diagnóstico</p>
                          {msg.result.stages.map((stage, i) => <StageResult key={i} stage={stage} />)}
                        </CardContent>
                      </>
                    )}
                    {!caseClosed && msg.result.summary && (
                      <>
                        <Separator />
                        <CardContent className="px-4 py-2">
                          <p className="text-[10px] text-muted-foreground">
                            ¿Necesitás más ayuda? Escribí tu consulta abajo o usá "Cerrar caso" cuando esté resuelto.
                          </p>
                        </CardContent>
                      </>
                    )}
                  </Card>
                ) : msg.role === 'system' ? (
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <Card className="px-3 py-2.5">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="mb-2 list-disc pl-4 text-sm last:mb-0">{children}</ul>,
                        li: ({ children }) => <li className="mb-0.5 text-sm">{children}</li>,
                      }}
                    >{msg.content}</ReactMarkdown>
                  </Card>
                )}
              </div>
            </div>
          ))}
          {error && (
            <div className="flex items-center gap-2 justify-center">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {/* Clarification questions panel */}
          {clarifying && clarificationQuestions.length > 0 && (
            <Card className="border-primary/30 bg-primary/[0.02]">
              <CardHeader className="pb-2 px-4 pt-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <CardTitle className="text-xs font-medium text-primary">El agente necesita más información</CardTitle>
                </div>
                <CardDescription className="text-xs mt-1">
                  Respondé estas preguntas para que el diagnóstico sea más preciso:
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2">
                {clarificationQuestions.map((q, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                    <span className="flex-shrink-0 flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                      {i + 1}
                    </span>
                    <span>{q}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {!isRunning && !caseClosed && messages.length > 3 && (
            <div className="flex justify-center pt-2">
              <span className="text-[10px] text-muted-foreground/50">{lastResult?.run_id?.slice(0, 8)}</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {!caseClosed && (
        <div className="shrink-0 border-t border-border bg-card px-4 py-3">
          <div className="mx-auto max-w-[680px] flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={clarifying ? (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendClarification(); }} : handleKeyDown}
              disabled={isRunning}
              placeholder={clarifying ? "Escribí tu respuesta a las preguntas del agente..." : showFollowUp ? "Escribí para continuar el diagnóstico..." : "Describí tu problema..."}
              rows={1}
              className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
              style={{ minHeight: 36, maxHeight: 120 }}
            />
            <Button
              size="icon"
              onClick={clarifying ? handleSendClarification : handleSend}
              disabled={!input.trim() || isRunning}
            >
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
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
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    );
  }

  const run = detail as Record<string, any> | null;
  if (!run) {
    return <div className="px-4 py-3 text-xs text-muted-foreground">No se pudo cargar el detalle.</div>;
  }

  const stages: any[] = Array.isArray(run.stages) ? run.stages : [];
  const isRunning = run.status === 'RUNNING' || (!runStatus && run.status !== 'COMPLETED' && run.status !== 'FAILED' && run.status !== 'NEEDS_HUMAN' && run.status !== 'CLOSED' && run.status !== 'NEEDS_CLARIFICATION');
  const statusLabel = runStatus ?? run.status;
  const showStages = stages.length > 0 || liveStages.length > 0;
  const allStages = [...stages, ...liveStages.filter(ls => !stages.some(s => s.agent_slug === ls.agent_slug))];

  return (
    <div className="border-t border-border/40">
      <Card className="border-0 shadow-none rounded-none">
        <CardHeader className="flex-row items-center gap-2 px-4 py-2.5">
          <StatusBadge status={statusLabel} />
          {run.case_type && (
            <span className="text-[10px] text-muted-foreground capitalize">{run.case_type}</span>
          )}
          {run.severity && (
            <span className="text-[10px] text-muted-foreground/70">· {run.severity}</span>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground/60">
            {run.created_at ? formatDistanceToNow(new Date(run.created_at), { addSuffix: true, locale: es }) : ''}
          </span>
        </CardHeader>

        {run.summary && (
          <>
            <Separator />
            <CardContent className="px-4 py-3">
              <ReactMarkdown remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="text-xs leading-relaxed text-foreground/80 mb-1.5 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="mb-1.5 list-disc pl-4 text-xs last:mb-0">{children}</ul>,
                  li: ({ children }) => <li className="mb-0.5 text-xs">{children}</li>,
                  code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono">{children}</code>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                }}
              >{run.summary}</ReactMarkdown>
            </CardContent>
          </>
        )}

        {showStages && (
          <>
            <Separator />
            <CardContent className="px-4 py-3 space-y-2">
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
                          <p className="text-muted-foreground mt-0.5 line-clamp-4">{stage.output_preview.slice(0, 800)}</p>
                        )
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {stage.duration_ms && (
                          <span className="text-[10px] text-muted-foreground/60">{(stage.duration_ms / 1000).toFixed(1)}s</span>
                        )}
                        {stage.cost_credits != null && stage.cost_credits > 0 && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0">{stage.cost_credits.toFixed(2)} créd.</Badge>
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
            </CardContent>
          </>
        )}

        {(run.total_cost_credits != null && run.total_cost_credits > 0) && (
          <>
            <Separator />
            <CardContent className="px-4 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {liveStages.length > 0 ? 'Costo acumulado' : 'Costo total'}
                </span>
                <Badge variant="secondary" className="text-[10px]">{run.total_cost_credits.toFixed(2)} créditos</Badge>
              </div>
            </CardContent>
          </>
        )}
      </Card>
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
      <div className="mt-8 space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-muted-foreground" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
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
        <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
      </div>
      <div className="space-y-1.5">
        {items.slice(0, 10).map((run: any) => {
          const isExpanded = expandedId === run.id;
          const isActive = run.status === 'RUNNING';
          const dotColor = isActive ? 'bg-primary animate-pulse' :
            run.status === 'COMPLETED' ? 'bg-emerald-500' :
            run.status === 'NEEDS_HUMAN' ? 'bg-amber-500' :
            run.status === 'CLOSED' ? 'bg-muted-foreground/40' :
            run.status === 'FAILED' ? 'bg-destructive' : 'bg-muted-foreground/50';

          return (
            <Collapsible key={run.id} open={isExpanded} onOpenChange={(open) => setExpandedId(open ? run.id : null)}>
              <Card className="transition-colors">
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 rounded-t-lg">
                    <div className={`flex-shrink-0 w-2 h-2 rounded-full ${dotColor}`} />
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
                          <Badge variant="outline" className="text-[9px]">{run.total_cost_credits.toFixed(2)} créd.</Badge>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <RunDetailExpanded runId={run.id} onClose={() => setExpandedId(null)} />
                </CollapsibleContent>
              </Card>
            </Collapsible>
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
      <div className="flex h-full flex-col overflow-hidden bg-background">
        <ChatView agent={selectedAgent} channelId={channelId} onBack={() => setSelectedAgent(null)} />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
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
              <Card
                key={agent.id}
                className="group cursor-pointer transition-colors hover:border-primary/30 hover:bg-primary/5"
                onClick={() => setSelectedAgent(agent)}
              >
                <CardHeader className="flex-row items-start gap-4 p-5">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground group-hover:border-primary/30 group-hover:text-primary transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-[13px]">{agent.title}</CardTitle>
                    <CardDescription className="mt-0.5 text-xs leading-relaxed">{agent.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        <SupportHistorySection />

        <Card className="mt-8">
          <CardHeader className="flex-row items-center gap-3 p-5">
            <LifeBuoy className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <CardTitle className="text-[13px]">¿Ya abriste un caso antes?</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Podés ver el historial de tickets en{' '}
                <Link href="/admin/support" className="text-primary hover:underline">
                  panel de administración
                </Link>.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
