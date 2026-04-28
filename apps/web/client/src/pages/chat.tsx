import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowUp, Loader2, Sparkles, Bot, User, Zap } from 'lucide-react';

type Message = {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  isStreaming?: boolean;
};

type ToolCall = {
  id: string;
  name: string;
  status: 'running' | 'done';
};

const SUGGESTIONS = [
  '¿Cómo están mis ventas este mes?',
  'Creá un contacto nuevo',
  'Analiza mis tareas pendientes',
  'Dame recomendaciones para mejorar',
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string>();
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => { scrollToBottom(); }, [messages]);
  useEffect(() => { if (!streaming) inputRef.current?.focus(); }, [streaming]);

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || streaming) return;

    setError(null);
    const um: Message = { id: crypto.randomUUID(), role: 'user', content: msg };
    const am: Message = { id: crypto.randomUUID(), role: 'agent', content: '', isStreaming: true };

    setMessages(prev => [...prev, um, am]);
    setToolCalls([]);
    setInput('');
    setStreaming(true);

    try {
      const res = await api.createAgentStream(msg, conversationId);
      const reader = res.body!.getReader();
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
              setMessages(prev => prev.map(m => m.id === am.id ? { ...m, content: m.content + (data.delta || '') } : m));
            } else if (data.type === 'response.output_item.added' && data.item?.type === 'function_call') {
              setToolCalls(prev => [...prev, { id: data.item.id || data.item.call_id, name: data.item.name || 'tool', status: 'running' }]);
            } else if (data.type === 'response.output_item.done') {
              setToolCalls(prev => prev.map(t => t.id === (data.item?.id || data.item?.call_id) ? { ...t, status: 'done' } : t));
            } else if (data.type === 'response.completed' && data.response?.id) {
              setConversationId(data.response.id);
            } else if (data.type === 'error') {
              setError(data.error?.message || 'Error');
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setMessages(prev => prev.map(m => m.id === am.id ? { ...m, content: err?.message || 'Error de conexión', role: 'system', isStreaming: false } : m));
    } finally {
      setMessages(prev => prev.map(m => m.id === am.id ? { ...m, isStreaming: false } : m));
      setStreaming(false);
    }
  }, [input, streaming, conversationId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">Hubby</h1>
              <p className="text-[11px] text-muted-foreground/60 -mt-0.5">{streaming ? 'Respondiendo...' : 'Asistente IA'}</p>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">GPT-5.4</span>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 max-w-3xl mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-5 shadow-lg shadow-primary/15">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-1.5">¿En qué puedo ayudarte?</h2>
            <p className="text-sm text-muted-foreground mb-8 text-center max-w-sm">
              Preguntame sobre tu negocio, creá contactos, analizá datos o gestioná tareas.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  disabled={streaming}
                  className="text-left px-4 py-2.5 rounded-xl text-sm text-muted-foreground bg-card hover:bg-accent border border-border transition-all duration-200 disabled:opacity-50 hover:border-border/80"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
            {messages.map((m) => (
              <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  m.role === 'user'
                    ? 'bg-foreground'
                    : m.role === 'system'
                      ? 'bg-red-500/10'
                      : 'bg-gradient-to-br from-violet-500 to-indigo-600'
                }`}>
                  {m.role === 'user'
                    ? <User className="w-3.5 h-3.5 text-background" />
                    : m.role === 'system'
                      ? <Zap className="w-3.5 h-3.5 text-red-500" />
                      : <Sparkles className="w-3.5 h-3.5 text-white" />}
                </div>

                {/* Bubble */}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  m.role === 'user'
                    ? 'bg-foreground text-background rounded-tr-md'
                    : m.role === 'system'
                      ? 'bg-red-500/5 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/20 rounded-tl-md'
                      : 'bg-muted/40 text-foreground border border-border rounded-tl-md'
                }`}>
                  {m.role === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                  ) : m.isStreaming && !m.content ? (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  ) : (
                    <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-pre:bg-foreground prose-pre:text-background prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1 prose-code:rounded prose-a:text-primary">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.content}
                      </ReactMarkdown>
                      {m.isStreaming && (
                        <span className="inline-block w-0.5 h-4 ml-0.5 bg-primary animate-pulse align-text-bottom rounded-full" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Tool calls */}
            {toolCalls.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pl-10">
                {toolCalls.map(tc => (
                  <span key={tc.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    tc.status === 'running'
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                  }`}>
                    {tc.status === 'running' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                    {tc.name}
                  </span>
                ))}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/5 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300">✕</button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 bg-background border-t border-border px-4 pb-4 pt-2">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 bg-muted/30 rounded-2xl px-4 py-2 border border-border focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10 transition-all duration-200">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu mensaje..."
              disabled={streaming}
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50 disabled:opacity-50 py-1"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || streaming}
              className="w-8 h-8 rounded-xl bg-foreground hover:bg-foreground/90 disabled:bg-muted flex items-center justify-center transition-all duration-200 shrink-0 disabled:scale-100 hover:scale-105 active:scale-95"
            >
              {streaming ? (
                <Loader2 className="w-4 h-4 text-background animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4 text-background" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/50 text-center mt-2">Hubby puede cometer errores. Verificá la información importante.</p>
        </div>
      </div>
    </div>
  );
}
