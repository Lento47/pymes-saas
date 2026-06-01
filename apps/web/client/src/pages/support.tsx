import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, Link } from 'wouter';
import {
  MessageSquare,
  Smartphone,
  Send,
  Loader2,
  ChevronLeft,
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
  ChevronRight,
  XCircle,
  ChevronDown,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
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
  status: 'COMPLETED' | 'NEEDS_HUMAN' | 'FAILED';
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
  input_chars?: number;
  output_chars?: number;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  result?: OrchestrateResult;
};

const STAGE_ICONS: Record<string, typeof Stethoscope> = {
  'intake-triage': Stethoscope,
  diagnostic: Cog,
  'fix-proposal': LifeBuoy,
  'security-compliance': ShieldCheck,
  'pr-review': CheckCircle2,
};

function StageResult({ stage }: { stage: StageRecord }) {
  const Icon = STAGE_ICONS[stage.agent_slug] ?? Cog;
  const label = stage.agent_slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className={`flex items-start gap-2.5 rounded-md border px-3 py-2 text-xs ${
      stage.error ? 'border-destructive/20 bg-destructive/5' :
      stage.skipped_reason ? 'border-border/40 bg-muted/20' :
      'border-emerald-500/20 bg-emerald-500/5'
    }`}>
      <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
        stage.error ? 'text-destructive' :
        stage.skipped_reason ? 'text-muted-foreground/40' :
        'text-emerald-500'
      }`} />
      <div className="min-w-0">
        <p className="font-medium text-foreground">{label}</p>
        {stage.error && <p className="text-destructive mt-0.5">{stage.error}</p>}
        {stage.skipped_reason && <p className="text-muted-foreground mt-0.5">{stage.skipped_reason}</p>}
        {stage.output_preview && !stage.error && (
          <p className="text-muted-foreground mt-0.5 line-clamp-2">{stage.output_preview.slice(0, 300)}</p>
        )}
        {stage.duration_ms && (
          <p className="text-muted-foreground/60 mt-0.5">{(stage.duration_ms / 1000).toFixed(1)}s</p>
        )}
        {stage.cost_credits != null && stage.cost_credits > 0 && (
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialized = useRef(false);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (!isRunning) inputRef.current?.focus(); }, [isRunning]);

  const sendMessage = useCallback(async (text: string, systemContext?: string) => {
    const messageText = text.trim();
    if (!messageText || isRunning) return;
    setError(null);

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: messageText };
    const thinkingMessage: ChatMessage = { id: crypto.randomUUID(), role: 'system', content: 'Ejecutando diagnóstico...' };

    setMessages(prev => systemContext
      ? [...prev, thinkingMessage]
      : [...prev, userMessage, thinkingMessage]
    );
    setInput('');
    setIsRunning(true);

    const payloadMessage = systemContext
      ? `[CONTEXTO DEL SISTEMA: ${systemContext}]\n\n${messageText}`
      : messageText;

    try {
      const result = await api.orchestrateSupport(payloadMessage, undefined, false) as OrchestrateResult;

      setMessages(prev => {
        const withoutThinking = prev.filter(m => m.id !== thinkingMessage.id);
        return [...withoutThinking, {
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
      setMessages(prev => prev.filter(m => m.id !== thinkingMessage.id));
    } finally {
      setIsRunning(false);
    }
  }, [isRunning]);

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
        <div className="ml-auto flex items-center gap-2">
          {messages.length > 1 && !escalated && (
            <button
              onClick={handleEscalate}
              disabled={escalating}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors disabled:opacity-50"
            >
              {escalating ? <Loader2 className="w-3 h-3 animate-spin" /> : <LifeBuoy className="w-3 h-3" />}
              Escalar a soporte humano
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
                  msg.role === 'system' ? 'border-border bg-muted text-muted-foreground' : 'border-border bg-card text-muted-foreground'
                }`}>
                  {msg.role === 'system' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <MessageSquare className="w-3 h-3" />
                  )}
                </div>
              )}
              <div className={`max-w-[80%] space-y-2 ${
                msg.role === 'user'
                  ? 'rounded-lg bg-primary text-primary-foreground px-3 py-2.5 text-sm leading-relaxed'
                  : msg.role === 'system'
                    ? 'rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground'
                    : ''
              }`}>
                {msg.role === 'user' ? (
                  msg.content
                ) : msg.role === 'system' ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {msg.content}
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
                      {msg.result.tier && (
                        <span className="ml-auto text-[10px] text-muted-foreground">Tier {msg.result.tier}</span>
                      )}
                      {msg.result.total_cost_credits != null && msg.result.total_cost_credits > 0 && (
                        <span className="text-[10px] text-muted-foreground ml-1">{msg.result.total_cost_credits.toFixed(1)} créditos</span>
                      )}
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
            <p className="text-center text-xs text-destructive">{error}</p>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border bg-card px-4 py-3">
        <div className="mx-auto max-w-[680px] flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isRunning}
            placeholder="Describí tu problema..."
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
    </div>
  );
}

function SupportHistorySection() {
  const { data: runs, isLoading } = useQuery({
    queryKey: ["supportRuns"],
    queryFn: () => api.listSupportRuns(10),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Cargando historial...
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
      </div>
      <div className="space-y-2">
        {items.slice(0, 5).map((run: any) => (
          <Link
            key={run.id}
            href={`/support?agent=${run.case_type || 'whatsapp'}`}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/20 hover:bg-primary/5"
          >
            <div className={`flex-shrink-0 w-2 h-2 rounded-full ${
              run.status === 'COMPLETED' ? 'bg-emerald-500' :
              run.status === 'NEEDS_HUMAN' ? 'bg-amber-500' :
              run.status === 'CLOSED' ? 'bg-muted-foreground/40' :
              run.status === 'FAILED' ? 'bg-destructive' :
              'bg-blue-500'
            }`} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-foreground truncate">
                {run.case_type ?? 'Soporte'} · {run.severity ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {run.summary?.slice(0, 120) ?? 'Sin resumen'}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-[11px] text-muted-foreground">
                {run.created_at ? formatDistanceToNow(new Date(run.created_at), { addSuffix: true, locale: es }) : ''}
              </p>
              {run.total_cost_credits != null && run.total_cost_credits > 0 && (
                <p className="text-[10px] text-muted-foreground/60">{run.total_cost_credits.toFixed(2)} créd.</p>
              )}
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
          </Link>
        ))}
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
