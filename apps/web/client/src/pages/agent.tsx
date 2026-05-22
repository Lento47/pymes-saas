import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'wouter';
import { api } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Trash2,
  MessageSquareText,
  X,
  ArrowUp,
  Loader2,
  CheckCircle2,
  LifeBuoy,
  UserPlus,
  ClipboardCheck,
  TrendingUp,
} from 'lucide-react';

type Message = {
  id: string;
  role: 'user' | 'agent' | 'system' | 'tool';
  content: string;
  isStreaming?: boolean;
};

type ToolCall = {
  id: string;
  name: string;
  status: 'running' | 'done';
};

type FormField = {
  name: string;
  label: string;
  type: 'text' | 'email' | 'select' | 'date' | 'number';
  required: boolean;
  placeholder?: string;
  options?: string[];
};

type EmbeddedForm = {
  id: string;
  title: string;
  icon: React.ElementType;
  tool: string;
  fields: FormField[];
  values: Record<string, string>;
  isSubmitting: boolean;
  result?: string;
  error?: string;
};

const QUICK_FORMS: { label: string; icon: React.ElementType; tool: string; title: string; fields: FormField[] }[] = [
  {
    label: 'Contacto', icon: UserPlus, tool: 'create_contact', title: 'Nuevo Contacto',
    fields: [
      { name: 'full_name', label: 'Nombre completo', type: 'text', required: true, placeholder: 'Ej: Juan Pérez' },
      { name: 'email', label: 'Email', type: 'email', required: false, placeholder: 'juan@ejemplo.com' },
      { name: 'phone', label: 'Teléfono', type: 'text', required: false, placeholder: '8888-0000' },
      { name: 'type', label: 'Tipo', type: 'select', required: false, options: ['CUSTOMER', 'LEAD', 'SUPPLIER', 'PARTNER'] },
    ],
  },
  {
    label: 'Tarea', icon: ClipboardCheck, tool: 'create_task', title: 'Nueva Tarea',
    fields: [
      { name: 'title', label: 'Título', type: 'text', required: true, placeholder: 'Ej: Llamar al cliente' },
      { name: 'description', label: 'Descripción', type: 'text', required: false, placeholder: 'Detalles...' },
      { name: 'priority', label: 'Prioridad', type: 'select', required: false, options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
      { name: 'due_date', label: 'Fecha límite', type: 'date', required: false },
    ],
  },
  {
    label: 'Deal', icon: TrendingUp, tool: 'create_deal', title: 'Nuevo Deal',
    fields: [
      { name: 'title', label: 'Título', type: 'text', required: true, placeholder: 'Ej: Venta de software' },
      { name: 'stage_id', label: 'ID del Stage', type: 'text', required: true, placeholder: 'ID de la etapa del pipeline' },
      { name: 'value', label: 'Valor', type: 'number', required: false, placeholder: '50000' },
    ],
  },
];

const SUGGESTIONS = [
  { text: '¿Cómo están mis ventas este mes?', sub: 'Métricas' },
  { text: 'Revisa mis indicadores clave del negocio', sub: 'Operación' },
  { text: '¿Qué tareas pendientes tengo urgentes?', sub: 'Tareas' },
  { text: 'Resume las cuentas por cobrar que requieren atención', sub: 'Facturación' },
];

export default function Agent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [activeForm, setActiveForm] = useState<EmbeddedForm | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [location] = useLocation();
  const pageContext = useMemo(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    return params.get('page') || null;
  }, [location]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);
  useEffect(() => { if (!isStreaming && inputRef.current) inputRef.current.focus(); }, [isStreaming]);
  useEffect(() => {
    const done = localStorage.getItem('PymesHub_onboarding_done');
    if (done && Date.now() - parseInt(done) < 60000) setShowWelcome(true);
  }, []);

  const handleSend = useCallback(async (text?: string) => {
    const messageText = (text ?? input).trim();
    if (!messageText || isStreaming) return;
    setError(null);

    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: messageText };
    const agentMessage: Message = { id: crypto.randomUUID(), role: 'agent', content: '', isStreaming: true };

    setMessages(prev => [...prev, userMessage, agentMessage]);
    setToolCalls([]);
    setInput('');
    setIsStreaming(true);

    try {
      const response = await api.createAgentStream(messageText, conversationId);
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
            } else if (data.type === 'response.output_item.added' && data.item?.type === 'function_call') {
              setToolCalls(prev => [...prev, { id: data.item.id || data.item.call_id, name: data.item.name || 'tool', status: 'running' }]);
            } else if (data.type === 'response.output_item.done' && data.item) {
              setToolCalls(prev => prev.map(t => t.id === (data.item.id || data.item.call_id) ? { ...t, status: 'done' } : t));
            } else if (data.type === 'response.completed' && data.response?.id) {
              setConversationId(data.response.id);
            } else if (data.type === 'error') {
              setError(data.error?.message || 'Error del agente');
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
      setMessages(prev => prev.map(m => m.id === agentMessage.id ? { ...m, role: 'system', content: err instanceof Error ? err.message : 'Error', isStreaming: false } : m));
    } finally {
      setMessages(prev => prev.map(m => m.id === agentMessage.id ? { ...m, isStreaming: false } : m));
      setIsStreaming(false);
    }
  }, [input, isStreaming, conversationId]);

  const handleNewConversation = () => {
    setMessages([]); setConversationId(undefined); setError(null);
    setInput(''); setActiveForm(null); inputRef.current?.focus();
  };

  const openForm = (formDef: typeof QUICK_FORMS[0]) => {
    const values: Record<string, string> = {};
    formDef.fields.forEach(f => { values[f.name] = ''; });
    setActiveForm({ id: crypto.randomUUID(), title: formDef.title, icon: formDef.icon, tool: formDef.tool, fields: formDef.fields, values, isSubmitting: false });
  };

  const updateFormValue = (name: string, value: string) => {
    setActiveForm(prev => prev ? { ...prev, values: { ...prev.values, [name]: value } } : null);
  };

  const submitForm = async () => {
    if (!activeForm || activeForm.isSubmitting) return;
    setActiveForm(prev => prev ? { ...prev, isSubmitting: true } : null);
    try {
      const args: Record<string, unknown> = {};
      for (const f of activeForm.fields) {
        const v = activeForm.values[f.name]?.trim();
        if (f.required && !v) { setActiveForm(prev => prev ? { ...prev, isSubmitting: false, error: `"${f.label}" es requerido` } : null); return; }
        if (v) args[f.name] = f.type === 'number' ? parseFloat(v) : v;
      }
      const result = await api.executeAgentTool(activeForm.tool, args);
      setActiveForm(prev => prev ? { ...prev, isSubmitting: false, result: JSON.stringify(result, null, 2) } : null);
    } catch (err: unknown) {
      setActiveForm(prev => prev ? { ...prev, isSubmitting: false, error: err instanceof Error ? err.message : 'Error' } : null);
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
        lastUserMsg?.content || 'Escalación desde el asistente operativo',
        'MEDIUM',
      );
      setEscalated(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la escalación');
    } finally {
      setEscalating(false);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="relative flex shrink-0 items-center justify-between border-b border-border px-6 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
            <MessageSquareText style={{ width: 13, height: 13 }} />
          </div>
          <h1 className="text-[13px] font-semibold tracking-tight text-foreground">Asistente operativo</h1>
          <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {isStreaming ? 'Procesando' : 'Disponible'}
          </span>
        </div>
        {hasMessages && (
          <button onClick={handleNewConversation}
            className="p-1.5 rounded-lg text-muted-foreground/75 hover:text-muted-foreground/80 hover:bg-foreground/[0.04] transition-all duration-200"
            title="Nueva conversación">
            <Trash2 style={{ width: 14, height: 14 }} />
          </button>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scroll-smooth">
        {!hasMessages ? (
          <div className="flex h-full flex-col items-center justify-center px-6">
            {showWelcome && (
              <div className="mb-6 max-w-sm animate-fade-in rounded-lg border border-border bg-card px-4 py-3 text-center">
                <p className="text-sm font-medium text-foreground/85">Workspace listo</p>
                <p className="mt-1 text-xs text-muted-foreground">Puedes consultar datos o crear acciones desde aquí.</p>
              </div>
            )}
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground">
              <MessageSquareText style={{ width: 24, height: 24 }} />
            </div>
            <h2 className="mb-1.5 text-xl font-semibold tracking-tight text-foreground">Asistente operativo</h2>
            <p className="mb-10 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
              Consulta información del workspace, prepara borradores y ejecuta acciones permitidas.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
              {SUGGESTIONS.map(({ text, sub }, i) => (
                <button key={i} onClick={() => handleSend(text)} disabled={isStreaming}
                  className="group relative rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/35 disabled:opacity-30">
                  <span className="block text-[13px] text-foreground/75 group-hover:text-foreground transition-colors leading-snug">{text}</span>
                  <span className="block text-[10px] text-muted-foreground/75 mt-0.5">{sub}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-[720px] mx-auto px-4 py-6 space-y-5">
            {messages.map((msg, idx) => (
              <div key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                style={{ animationDelay: `${idx * 30}ms`, animationFillMode: 'both' }}>
                {msg.role !== 'user' && (
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                    msg.role === 'system'
                      ? 'border-destructive/25 text-destructive'
                      : msg.role === 'tool'
                        ? 'border-amber-500/25 text-amber-500'
                        : 'border-border bg-card text-muted-foreground'
                  }`}>
                    {msg.role === 'system' ? (
                      <span className="text-[11px]">!</span>
                    ) : msg.role === 'tool' ? (
                      <CheckCircle2 style={{ width: 12, height: 12 }} />
                    ) : (
                      <MessageSquareText style={{ width: 12, height: 12 }} />
                    )}
                  </div>
                )}

                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  msg.role === 'user' ? 'rounded-tr-md' : 'rounded-tl-md'
                } ${
                  msg.role === 'user'
                    ? 'bg-foreground text-background'
                    : msg.role === 'system'
                      ? 'border border-destructive/25 bg-transparent text-destructive'
                      : 'border border-border bg-card text-foreground'
                }`}>
                  {msg.role === 'user' ? (
                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                  ) : msg.isStreaming && !msg.content ? (
                    <div className="flex items-center gap-1.5 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/45 animate-pulse" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/45 animate-pulse" style={{ animationDelay: '200ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/45 animate-pulse" style={{ animationDelay: '400ms' }} />
                    </div>
                  ) : (
                    <div className="text-[14px] leading-relaxed prose prose-invert prose-sm max-w-none break-words
                      [&_*]:text-inherit
                      [&_code]:bg-foreground/[0.04] [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px]
                      [&_pre]:bg-foreground/[0.03] [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-[13px] [&_pre]:border [&_pre]:border-white/[0.05]
                      [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5
                      [&_strong]:text-foreground [&_em]:text-foreground/75">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      {msg.isStreaming && (
                        <span className="inline-block w-[2px] h-[16px] ml-0.5 align-text-bottom rounded-full animate-pulse"
                          style={{ background: 'hsl(var(--muted-foreground))' }} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Tool call chips */}
            {toolCalls.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pl-10 animate-fade-in">
                {toolCalls.map(tc => (
                  <span key={tc.id}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium transition-all duration-500"
                    style={{
                      background: 'transparent',
                      border: `1px solid ${tc.status === 'running' ? 'hsl(var(--border))' : 'hsl(var(--success) / 0.25)'}`,
                      color: tc.status === 'running' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--success))',
                    }}>
                    {tc.status === 'running' ? (
                      <Loader2 style={{ width: 10, height: 10 }} className="animate-spin" />
                    ) : (
                      <CheckCircle2 style={{ width: 10, height: 10 }} />
                    )}
                    {tc.name}
                  </span>
                ))}
              </div>
            )}

            {/* Embedded form */}
            {activeForm && (
              <div className="flex justify-start pl-10 animate-fade-in">
                <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <activeForm.icon style={{ width: 14, height: 14, color: 'hsl(var(--muted-foreground))' }} />
                    <span className="text-[13px] font-medium text-foreground/85">{activeForm.title}</span>
                    <button onClick={() => setActiveForm(null)} className="ml-auto p-0.5 rounded hover:bg-muted/40 text-muted-foreground/75">
                      <X style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                  {!activeForm.result && !activeForm.error && (
                    <div className="space-y-2">
                      {activeForm.fields.map(f => (
                        <div key={f.name}>
                          <label className="block text-[11px] font-medium mb-1 text-muted-foreground/80">{f.label}{f.required ? ' *' : ''}</label>
                          {f.type === 'select' ? (
                            <select value={activeForm.values[f.name]} onChange={e => updateFormValue(f.name, e.target.value)} disabled={activeForm.isSubmitting}
                              className="w-full rounded-lg px-3 py-1.5 text-[13px] outline-none disabled:opacity-40 text-foreground/85"
                              style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}>
                              <option value="" className="bg-card">Seleccionar...</option>
                              {f.options?.map(o => <option key={o} value={o} className="bg-card">{o}</option>)}
                            </select>
                          ) : (
                            <input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : 'text'}
                              value={activeForm.values[f.name]} onChange={e => updateFormValue(f.name, e.target.value)} placeholder={f.placeholder} disabled={activeForm.isSubmitting}
                              className="w-full rounded-lg px-3 py-1.5 text-[13px] outline-none disabled:opacity-40 text-foreground/85 placeholder:text-foreground/15"
                              style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                          )}
                        </div>
                      ))}
                      <button onClick={submitForm} disabled={activeForm.isSubmitting}
                        className="w-full mt-2 py-1.5 rounded-lg text-[13px] font-medium text-foreground transition-all duration-200 disabled:opacity-50 hover:opacity-90"
                        style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                        {activeForm.isSubmitting ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin mx-auto" /> : 'Enviar'}
                      </button>
                    </div>
                  )}
                  {activeForm.result && (
                    <div className="rounded-lg border border-emerald-500/25 p-3">
                      <span className="text-[11px] font-medium text-emerald-500">Creado</span>
                      <pre className="text-[11px] text-muted-foreground mt-1 whitespace-pre-wrap">{activeForm.result}</pre>
                    </div>
                  )}
                  {activeForm.error && (
                    <div className="rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
                      <span className="text-[11px] font-medium text-red-400">Error</span>
                      <p className="text-[11px] text-red-300/70 mt-1">{activeForm.error}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl animate-fade-in"
                style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)', color: '#fca5a5' }}>
                <span className="text-[13px]">{error}</span>
                <button onClick={() => setError(null)} className="ml-auto p-0.5 rounded hover:bg-white/5 text-muted-foreground/80"><X style={{ width: 10, height: 10 }} /></button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="relative shrink-0 px-4 pb-5 pt-2">
        <div className="max-w-[720px] mx-auto">
          {/* Escalation */}
          <div className="flex justify-center mb-2">
            <button onClick={handleEscalate} disabled={escalating || escalated}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-medium transition-colors disabled:opacity-40"
              style={{
                background: 'transparent',
                borderColor: escalated ? 'hsl(var(--success)/0.25)' : 'hsl(var(--border))',
                color: escalated ? 'hsl(var(--success))' : 'hsl(var(--warning)/0.8)',
              }}>
              {escalated ? (
                <><CheckCircle2 style={{ width: 11, height: 11 }} /> Ticket creado</>
              ) : escalating ? (
                <><Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> Creando ticket...</>
              ) : (
                <><LifeBuoy style={{ width: 11, height: 11 }} /> Escalar a soporte humano</>
              )}
            </button>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-1.5 mb-2.5 flex-wrap justify-center">
            {QUICK_FORMS.map(qf => (
              <button key={qf.tool} onClick={() => openForm(qf)} disabled={isStreaming || !!activeForm}
                className="flex items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/35 hover:text-foreground disabled:opacity-20">
                <qf.icon style={{ width: 11, height: 11 }} />
                {qf.label}
              </button>
            ))}
          </div>

          {/* Input bar */}
          <div className="relative flex items-end gap-2 rounded-xl border border-border bg-card px-4 py-3 transition-colors focus-within:border-primary/35"
            style={{
              boxShadow: 'none',
            }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={pageContext ? `Consulta sobre ${pageContext}...` : "Escribe una consulta operativa..."}
              disabled={isStreaming} rows={1}
              className="flex-1 resize-none bg-transparent text-[14px] outline-none disabled:opacity-30 text-foreground/85 placeholder:text-muted-foreground/75"
              style={{ maxHeight: '120px' }}
              onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }} />
            <button onClick={() => handleSend()} disabled={!input.trim() || isStreaming}
              className="p-2 rounded-md transition-colors shrink-0 disabled:opacity-20"
              style={{ background: input.trim() && !isStreaming ? 'hsl(var(--primary))' : 'transparent', color: input.trim() && !isStreaming ? 'hsl(var(--primary-fg))' : 'hsl(var(--fg-3))' }}>
              {isStreaming ? <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" /> : <ArrowUp style={{ width: 15, height: 15 }} />}
            </button>
          </div>

          <p className="text-[10px] text-center mt-2 text-foreground/15">
            El asistente puede consultar datos, analizar documentos y ejecutar tareas permitidas.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out; }
      `}</style>
    </div>
  );
}
