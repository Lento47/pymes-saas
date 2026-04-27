import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bot,
  Send,
  User,
  Trash2,
  Sparkles,
  AlertCircle,
  Paperclip,
  X,
  ArrowUp,
  Loader2,
  Zap,
  CheckCircle2,
  FileSearch,
  MessageSquareText,
  BrainCircuit,
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
  icon: any;
  tool: string;
  fields: FormField[];
  values: Record<string, string>;
  isSubmitting: boolean;
  result?: string;
  error?: string;
};

const QUICK_FORMS: { label: string; icon: any; tool: string; title: string; fields: FormField[] }[] = [
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
      { name: 'description', label: 'Descripción', type: 'text', required: false, placeholder: 'Detalles de la tarea...' },
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

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 ml-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  );
}

const SUGGESTIONS = [
  { icon: MessageSquareText, text: '¿Cómo están mis ventas este mes?' },
  { icon: FileSearch, text: 'Analiza mis métricas clave del negocio' },
  { icon: Zap, text: '¿Qué tareas pendientes tengo urgentes?' },
  { icon: BrainCircuit, text: 'Dame recomendaciones para mejorar cobros' },
];

export default function Agent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [activeForm, setActiveForm] = useState<EmbeddedForm | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isStreaming && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isStreaming]);

  const handleSend = useCallback(async (text?: string) => {
    const messageText = (text ?? input).trim();
    if (!messageText || isStreaming) return;

    setError(null);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText,
    };

    const agentMessage: Message = {
      id: crypto.randomUUID(),
      role: 'agent',
      content: '',
      isStreaming: true,
    };

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
              setMessages(prev =>
                prev.map(m =>
                  m.id === agentMessage.id
                    ? { ...m, content: m.content + (data.delta || '') }
                    : m
                ),
              );
            } else if (data.type === 'response.output_item.added' && data.item) {
              if (data.item.type === 'function_call') {
                setToolCalls(prev => [...prev, { id: data.item.id || data.item.call_id, name: data.item.name || 'tool', status: 'running' }]);
              }
            } else if (data.type === 'response.output_item.done' && data.item) {
              setToolCalls(prev => prev.map(t => t.id === (data.item.id || data.item.call_id) ? { ...t, status: 'done' } : t));
            } else if (data.type === 'response.completed' && data.response?.id) {
              setConversationId(data.response.id);
            } else if (data.type === 'error') {
              setError(data.error?.message || 'Error del agente');
            }
          } catch {
            // Skip unparseable SSE lines
          }
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'Error de conexión';
      setError(msg);
      setMessages(prev =>
        prev.map(m =>
          m.id === agentMessage.id
            ? { ...m, content: m.content || msg, role: 'system', isStreaming: false }
            : m
        ),
      );
    } finally {
      setMessages(prev =>
        prev.map(m =>
          m.id === agentMessage.id ? { ...m, isStreaming: false } : m
        ),
      );
      setIsStreaming(false);
    }
  }, [input, isStreaming, conversationId]);

  const handleNewConversation = () => {
    setMessages([]);
    setConversationId(undefined);
    setError(null);
    setInput('');
    setActiveForm(null);
    inputRef.current?.focus();
  };

  const openForm = (formDef: typeof QUICK_FORMS[0]) => {
    const values: Record<string, string> = {};
    formDef.fields.forEach(f => { values[f.name] = ''; });
    setActiveForm({
      id: crypto.randomUUID(),
      title: formDef.title,
      icon: formDef.icon,
      tool: formDef.tool,
      fields: formDef.fields,
      values,
      isSubmitting: false,
    });
  };

  const updateFormValue = (name: string, value: string) => {
    setActiveForm(prev => prev ? { ...prev, values: { ...prev.values, [name]: value } } : null);
  };

  const submitForm = async () => {
    if (!activeForm || activeForm.isSubmitting) return;
    setActiveForm(prev => prev ? { ...prev, isSubmitting: true } : null);
    try {
      const args: Record<string, any> = {};
      for (const f of activeForm.fields) {
        const v = activeForm.values[f.name]?.trim();
        if (f.required && !v) {
          setActiveForm(prev => prev ? { ...prev, isSubmitting: false, error: `"${f.label}" es requerido` } : null);
          return;
        }
        if (v) {
          if (f.type === 'number') args[f.name] = parseFloat(v);
          else args[f.name] = v;
        }
      }
      const result = await api.executeAgentTool(activeForm.tool, args);
      setActiveForm(prev => prev ? { ...prev, isSubmitting: false, result: JSON.stringify(result, null, 2) } : null);
    } catch (err: any) {
      setActiveForm(prev => prev ? { ...prev, isSubmitting: false, error: err?.message || 'Error' } : null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full" style={{ background: 'hsl(var(--bg))' }}>
      {/* Header */}
      <header
        className="shrink-0 px-6 py-3 flex items-center justify-between gap-4"
        style={{ borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--bg-sidebar))' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <Sparkles style={{ width: 16, height: 16, color: 'white' }} />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white leading-none">Asistente IA</h1>
            <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--fg-3))' }}>
              {isStreaming ? 'Respondiendo...' : 'Agente inteligente'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'hsl(var(--accent) / 0.12)', color: 'hsl(var(--accent))' }}
          >
            GPT-5.4
          </span>
          {hasMessages && (
            <button
              onClick={handleNewConversation}
              className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
              style={{ color: 'hsl(var(--fg-3))' }}
              title="Nueva conversación"
            >
              <Trash2 style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full px-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <Sparkles style={{ width: 28, height: 28, color: 'white' }} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Asistente IA</h2>
            <p className="text-sm text-center mb-8" style={{ color: 'hsl(var(--fg-2))', maxWidth: 380 }}>
              Tu agente inteligente para consultas, análisis de documentos, datos del negocio y automatizaciones.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
              {SUGGESTIONS.map(({ icon: Icon, text }, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(text)}
                  disabled={isStreaming}
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-left transition-all duration-150 disabled:opacity-40"
                  style={{
                    background: 'hsl(var(--bg-card))',
                    border: '1px solid hsl(var(--border))',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'hsl(var(--accent))')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'hsl(var(--border))')}
                >
                  <Icon style={{ width: 16, height: 16, color: 'hsl(var(--accent))', flexShrink: 0 }} />
                  <span className="text-sm" style={{ color: 'hsl(var(--fg-1))' }}>{text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Messages */
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role !== 'user' && (
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background:
                        msg.role === 'system'
                          ? 'hsl(var(--danger) / 0.15)'
                          : msg.role === 'tool'
                            ? 'hsl(var(--warning) / 0.15)'
                            : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    }}
                  >
                    {msg.role === 'system' ? (
                      <AlertCircle style={{ width: 13, height: 13, color: 'hsl(var(--danger))' }} />
                    ) : msg.role === 'tool' ? (
                      <Zap style={{ width: 13, height: 13, color: 'hsl(var(--warning))' }} />
                    ) : (
                      <Sparkles style={{ width: 13, height: 13, color: 'white' }} />
                    )}
                  </div>
                )}

                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'rounded-tr-md'
                      : msg.role === 'system'
                        ? 'rounded-tl-md'
                        : 'rounded-tl-md'
                  }`}
                  style={
                    msg.role === 'user'
                      ? {
                          background: 'hsl(var(--accent))',
                          color: 'white',
                        }
                      : msg.role === 'system'
                        ? {
                            background: 'hsl(var(--danger) / 0.08)',
                            border: '1px solid hsl(var(--danger) / 0.2)',
                            color: 'hsl(var(--danger))',
                          }
                        : {
                            background: 'hsl(var(--bg-card))',
                            border: '1px solid hsl(var(--border))',
                            color: 'hsl(var(--fg-1))',
                          }
                  }
                >
                  {msg.role === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  ) : msg.isStreaming && !msg.content ? (
                    <ThinkingDots />
                  ) : (
                    <div className="text-sm prose prose-invert prose-sm max-w-none break-words [&_*]:text-inherit [&_pre]:bg-black/30 [&_pre]:rounded-lg [&_pre]:p-3 [&_code]:bg-black/20 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                      {msg.isStreaming && (
                        <span className="inline-block w-0.5 h-4 ml-0.5 bg-blue-400 animate-pulse align-text-bottom" />
                      )}
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'hsl(var(--accent) / 0.15)', color: 'hsl(var(--accent))' }}
                  >
                    <User style={{ width: 13, height: 13 }} />
                  </div>
                )}
              </div>
            ))}

            {/* Tool call badges */}
            {/* Embedded form card */}
            {activeForm && (
              <div className="flex justify-start pl-10">
                <div
                  className="w-full max-w-md rounded-2xl rounded-tl-md p-4"
                  style={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border))' }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <activeForm.icon style={{ width: 16, height: 16, color: 'hsl(var(--accent))' }} />
                    <span className="text-sm font-semibold" style={{ color: 'hsl(var(--fg-1))' }}>{activeForm.title}</span>
                    <button
                      onClick={() => setActiveForm(null)}
                      className="ml-auto p-0.5 rounded hover:bg-white/10 transition-colors"
                      style={{ color: 'hsl(var(--fg-3))' }}
                    >
                      <X style={{ width: 12, height: 12 }} />
                    </button>
                  </div>

                  {!activeForm.result && !activeForm.error && (
                    <div className="space-y-2.5">
                      {activeForm.fields.map(f => (
                        <div key={f.name}>
                          <label className="block text-xs font-medium mb-1" style={{ color: 'hsl(var(--fg-2))' }}>
                            {f.label}{f.required ? ' *' : ''}
                          </label>
                          {f.type === 'select' ? (
                            <select
                              value={activeForm.values[f.name]}
                              onChange={e => updateFormValue(f.name, e.target.value)}
                              disabled={activeForm.isSubmitting}
                              className="w-full rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-40"
                              style={{ background: 'hsl(var(--bg))', color: 'hsl(var(--fg-1))', border: '1px solid hsl(var(--border))' }}
                            >
                              <option value="">Seleccionar...</option>
                              {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            <input
                              type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : 'text'}
                              value={activeForm.values[f.name]}
                              onChange={e => updateFormValue(f.name, e.target.value)}
                              placeholder={f.placeholder}
                              disabled={activeForm.isSubmitting}
                              className="w-full rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-40"
                              style={{ background: 'hsl(var(--bg))', color: 'hsl(var(--fg-1))', border: '1px solid hsl(var(--border))' }}
                            />
                          )}
                        </div>
                      ))}

                      <button
                        onClick={submitForm}
                        disabled={activeForm.isSubmitting}
                        className="w-full mt-2 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-150 disabled:opacity-50"
                        style={{ background: 'hsl(var(--accent))' }}
                      >
                        {activeForm.isSubmitting ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> Enviando...
                          </span>
                        ) : 'Enviar'}
                      </button>
                    </div>
                  )}

                  {activeForm.result && (
                    <div className="rounded-lg p-3" style={{ background: 'hsl(142 60% 8%)', border: '1px solid hsl(142 60% 20%)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 style={{ width: 14, height: 14, color: 'hsl(142 60% 60%)' }} />
                        <span className="text-xs font-semibold" style={{ color: 'hsl(142 60% 60%)' }}>¡Creado!</span>
                      </div>
                      <pre className="text-xs whitespace-pre-wrap overflow-x-auto" style={{ color: 'hsl(142 60% 80%)' }}>{activeForm.result}</pre>
                      <button
                        onClick={() => setActiveForm(null)}
                        className="mt-2 text-xs font-medium rounded px-3 py-1 transition-colors"
                        style={{ color: 'hsl(var(--accent))', background: 'hsl(var(--accent) / 0.1)' }}
                      >
                        Cerrar
                      </button>
                    </div>
                  )}

                  {activeForm.error && (
                    <div className="rounded-lg p-3" style={{ background: 'hsl(var(--danger) / 0.08)', border: '1px solid hsl(var(--danger) / 0.2)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle style={{ width: 14, height: 14, color: 'hsl(var(--danger))' }} />
                        <span className="text-xs font-medium" style={{ color: 'hsl(var(--danger))' }}>Error</span>
                      </div>
                      <p className="text-xs" style={{ color: 'hsl(var(--danger))' }}>{activeForm.error}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {toolCalls.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-start pl-10">
                {toolCalls.map(tc => (
                  <div
                    key={tc.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-300"
                    style={{
                      background: tc.status === 'running' ? 'hsl(var(--accent) / 0.1)' : 'hsl(142 60% 12%)',
                      border: `1px solid ${tc.status === 'running' ? 'hsl(var(--accent) / 0.25)' : 'hsl(142 60% 25%)'}`,
                      color: tc.status === 'running' ? 'hsl(var(--accent))' : 'hsl(142 60% 60%)',
                    }}
                  >
                    {tc.status === 'running' ? (
                      <Loader2 style={{ width: 10, height: 10 }} className="animate-spin" />
                    ) : (
                      <CheckCircle2 style={{ width: 10, height: 10 }} />
                    )}
                    <span>{tc.name}</span>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm max-w-3xl"
                style={{
                  background: 'hsl(var(--danger) / 0.06)',
                  color: 'hsl(var(--danger))',
                  border: '1px solid hsl(var(--danger) / 0.15)',
                }}
              >
                <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
                <span>{error}</span>
                <button
                  onClick={() => setError(null)}
                  className="ml-auto p-0.5 rounded hover:bg-white/10 transition-colors"
                >
                  <X style={{ width: 12, height: 12 }} />
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 px-4 pb-4 pt-2" style={{ background: 'hsl(var(--bg))' }}>
        <div className="max-w-3xl mx-auto">
          {/* Quick-action toolbar */}
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            {QUICK_FORMS.map((qf) => (
              <button
                key={qf.tool}
                onClick={() => openForm(qf)}
                disabled={isStreaming || !!activeForm}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 disabled:opacity-30 hover:scale-[1.02]"
                style={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--fg-2))' }}
              >
                <qf.icon style={{ width: 12, height: 12, color: 'hsl(var(--accent))' }} />
                {qf.label}
              </button>
            ))}
          </div>

          <div
            className="flex items-end gap-2 rounded-2xl px-4 py-2.5 transition-colors"
            style={{
              background: 'hsl(var(--bg-card))',
              border: '1px solid hsl(var(--border))',
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu mensaje..."
              disabled={isStreaming}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm outline-none disabled:opacity-40"
              style={{ color: 'hsl(var(--fg-1))', maxHeight: '120px' }}
              onInput={e => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 120) + 'px';
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isStreaming}
              className="p-2 rounded-xl transition-all duration-150 shrink-0 disabled:opacity-30"
              style={{
                background: input.trim() && !isStreaming ? 'hsl(var(--accent))' : 'transparent',
                color: input.trim() && !isStreaming ? 'white' : 'hsl(var(--fg-3))',
              }}
            >
              {isStreaming ? (
                <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
              ) : (
                <ArrowUp style={{ width: 16, height: 16 }} />
              )}
            </button>
          </div>

          <p className="text-xs mt-2 text-center" style={{ color: 'hsl(var(--fg-3))' }}>
            El agente IA puede consultar datos, analizar documentos y ejecutar tareas. Verifica la información crítica.
          </p>
        </div>
      </div>
    </div>
  );
}
