import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
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
  FileSearch,
  MessageSquareText,
  BrainCircuit,
} from 'lucide-react';

type Message = {
  id: string;
  role: 'user' | 'agent' | 'system' | 'tool';
  content: string;
  isStreaming?: boolean;
};

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
    inputRef.current?.focus();
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
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.content}
                      {msg.isStreaming && (
                        <span className="inline-block w-0.5 h-4 ml-0.5 bg-blue-400 animate-pulse align-text-bottom" />
                      )}
                    </p>
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
