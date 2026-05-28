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
} from 'lucide-react';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

type Message = {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  isStreaming?: boolean;
};

function ChatView({ agent, channelId, onBack }: { agent: SupportAgent; channelId?: string; onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [escalating, setEscalating] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialized = useRef(false);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (!isStreaming) inputRef.current?.focus(); }, [isStreaming]);

  const sendMessage = useCallback(async (text: string, systemContext?: string) => {
    const messageText = text.trim();
    if (!messageText || isStreaming) return;
    setError(null);

    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: messageText };
    const agentMessage: Message = { id: crypto.randomUUID(), role: 'agent', content: '', isStreaming: true };

    setMessages(prev => systemContext
      ? [...prev, agentMessage]
      : [...prev, userMessage, agentMessage]
    );
    setInput('');
    setIsStreaming(true);

    const payload = systemContext
      ? `[CONTEXTO DEL SISTEMA: ${systemContext}]\n\n${messageText}`
      : messageText;

    try {
      const response = await api.createAgentStream(payload, conversationId);
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'response.output_text.delta') {
              setMessages(prev => prev.map(m => m.id === agentMessage.id ? { ...m, content: m.content + (data.delta || '') } : m));
            } else if (data.type === 'response.completed' && data.response?.id) {
              setConversationId(data.response.id);
            } else if (data.type === 'error') {
              setError(data.error?.message || 'Error del agente');
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al conectar con el asistente';
      setError(msg);
      setMessages(prev => prev.map(m => m.id === agentMessage.id ? { ...m, role: 'system', content: msg, isStreaming: false } : m));
    } finally {
      setMessages(prev => prev.map(m => m.id === agentMessage.id ? { ...m, isStreaming: false } : m));
      setIsStreaming(false);
    }
  }, [isStreaming, conversationId]);

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
          {messages.length > 2 && !escalated && (
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
            <span className="flex items-center gap-1 text-[11px] text-emerald-600">
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
                  msg.role === 'system' ? 'border-destructive/25 text-destructive' : 'border-border bg-card text-muted-foreground'
                }`}>
                  {msg.role === 'system' ? '!' : <MessageSquare className="w-3 h-3" />}
                </div>
              )}
              <div className={`max-w-[80%] rounded-lg px-3 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#4F46E5] text-white'
                  : msg.role === 'system'
                    ? 'border border-destructive/20 bg-destructive/5 text-destructive'
                    : 'border border-border bg-card text-foreground'
              }`}>
                {msg.role === 'agent' ? (
                  <>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="mb-2 list-disc pl-4 last:mb-0">{children}</ul>,
                        ol: ({ children }) => <ol className="mb-2 list-decimal pl-4 last:mb-0">{children}</ol>,
                        li: ({ children }) => <li className="mb-0.5">{children}</li>,
                        code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">{children}</code>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      }}
                    >{msg.content}</ReactMarkdown>
                    {msg.isStreaming && !msg.content && (
                      <span className="inline-flex gap-0.5 mt-1">
                        {[0, 1, 2].map(i => (
                          <span key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                        ))}
                      </span>
                    )}
                  </>
                ) : (
                  msg.content
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
            disabled={isStreaming}
            placeholder="Describí tu problema..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-[#4F46E5]/40 disabled:opacity-50"
            style={{ minHeight: 36, maxHeight: 120 }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#4F46E5] text-white hover:bg-[#4338CA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
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
                className="group flex items-start gap-4 rounded-lg border border-border bg-card px-5 py-4 text-left transition-colors hover:border-[#4F46E5]/30 hover:bg-[#EEF2FF]/40"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground group-hover:border-[#4F46E5]/30 group-hover:text-[#4F46E5] transition-colors">
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

        <div className="mt-8 rounded-lg border border-border bg-card px-5 py-4">
          <div className="flex items-center gap-3">
            <LifeBuoy className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-foreground">¿Ya abriste un caso antes?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Podés ver el historial de tickets en{' '}
                <Link href="/admin/support" className="text-[#4F46E5] hover:underline">
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
