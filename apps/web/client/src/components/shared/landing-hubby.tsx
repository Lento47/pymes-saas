import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Sparkles } from 'lucide-react';

type Message = { id: string; role: 'user' | 'agent'; content: string };

const API_BASE = import.meta.env.VITE_PYMESHUB_API_URL ?? import.meta.env.VITE_API_URL ?? '';

function PetSvg({ small }: { small?: boolean }) {
  const [blinking, setBlinking] = useState(false);
  const [lookingRight, setLookingRight] = useState(false);

  useEffect(() => {
    const blink = setInterval(() => {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 150);
    }, 2500 + Math.random() * 3000);

    const look = setInterval(() => {
      setLookingRight(prev => !prev);
    }, 5000 + Math.random() * 4000);

    return () => { clearInterval(blink); clearInterval(look); };
  }, []);

  const s = small ? 0.65 : 1;

  return (
    <svg width={64 * s} height={64 * s} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bG" cx="40%" cy="35%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
      </defs>
      <ellipse cx="16" cy="14" rx="7" ry="11" fill="#fcd34d" transform="rotate(-15 16 14)" />
      <ellipse cx="48" cy="14" rx="7" ry="11" fill="#fcd34d" transform="rotate(15 48 14)" />
      <ellipse cx="32" cy="36" rx="22" ry="21" fill="url(#bG)" />
      <ellipse cx="32" cy="42" rx="12" ry="11" fill="#fef3c7" opacity="0.5" />
      <ellipse cx="20" cy="38" rx="5" ry="3" fill="#f472b6" opacity="0.3" />
      <ellipse cx="44" cy="38" rx="5" ry="3" fill="#f472b6" opacity="0.3" />
      <ellipse cx="26" cy="33" rx="6" ry="7" fill="white" />
      <ellipse cx="38" cy="33" rx="6" ry="7" fill="white" />
      <ellipse cx={lookingRight ? 28 : 25} cy="34" rx="3" ry="4" fill="#78350f" style={{ transition: 'cx 0.3s' }} />
      <ellipse cx={lookingRight ? 40 : 37} cy="34" rx="3" ry="4" fill="#78350f" style={{ transition: 'cx 0.3s' }} />
      <circle cx="24" cy="31" r="1.2" fill="white" opacity="0.9" />
      <circle cx="36" cy="31" r="1.2" fill="white" opacity="0.9" />
      {blinking && (
        <>
          <ellipse cx="26" cy="33" rx="6" ry="1.5" fill="#d97706" />
          <ellipse cx="38" cy="33" rx="6" ry="1.5" fill="#d97706" />
        </>
      )}
      <ellipse cx="32" cy="40" rx="2.5" ry="2" fill="#92400e" />
      <path d="M28 43 Q32 47 36 43" stroke="#92400e" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <ellipse cx="18" cy="54" rx="6" ry="4" fill="#d97706" />
      <ellipse cx="18" cy="53" rx="3.5" ry="2.5" fill="#fcd34d" opacity="0.5" />
      <ellipse cx="46" cy="54" rx="6" ry="4" fill="#d97706" />
      <ellipse cx="46" cy="53" rx="3.5" ry="2.5" fill="#fcd34d" opacity="0.5" />
      <path d="M10 40 Q4 35 6 30" stroke="#d97706" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function LandingHubby() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [bounce, setBounce] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => setVisible(true), 2000);
    const iv = setInterval(() => {
      setBounce(true);
      setTimeout(() => setBounce(false), 600);
    }, 15000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const um: Message = { id: crypto.randomUUID(), role: 'user', content: text };
    const am: Message = { id: crypto.randomUUID(), role: 'agent', content: '' };
    setMessages(prev => [...prev, um, am]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/agent/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: text }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

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
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'response.output_text.delta') {
                setMessages(prev => prev.map(m => m.id === am.id ? { ...m, content: m.content + (data.delta || '') } : m));
              } else if (data.type === 'response.completed') {
                const text = data.response?.output_text || '';
                setMessages(prev => prev.map(m => m.id === am.id ? { ...m, content: text || m.content } : m));
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      setMessages(prev => prev.map(m => m.id === am.id ? { ...m, content: 'Hmm, algo falló. ¡Intentá de nuevo!' } : m));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-700 ${
        visible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-20 opacity-0 scale-75'
      }`}
    >
      {/* Chat panel */}
      {open && (
        <div
          className="absolute bottom-20 right-0 w-80 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300"
          style={{ background: '#fff', border: '1px solid #e5e7eb' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
            <PetSvg small />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white">Hubby 🐾</h3>
              <p className="text-xs text-amber-100">Asistente de PyMesHub</p>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded-full hover:bg-white/20 transition-colors">
              <X style={{ width: 16, height: 16, color: 'white' }} />
            </button>
          </div>

          {/* Messages */}
          <div ref={chatRef} className="h-72 overflow-y-auto px-4 py-3 space-y-3" style={{ background: '#f9fafb' }}>
            {messages.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 mb-2">¡Hola! Soy Hubby 🐾</p>
                <p className="text-xs text-gray-400">Preguntame sobre PyMesHub: funcionalidades, precios, cómo empezar...</p>
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'bg-amber-500 text-white rounded-tr-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                  }`}
                >
                  {m.content || (loading && m.role === 'agent' ? (
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  ) : null)}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-gray-200 flex items-center gap-2" style={{ background: '#fff' }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(); }}
              placeholder="Preguntame algo..."
              disabled={loading}
              className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 outline-none focus:border-amber-400 disabled:opacity-50"
              style={{ background: '#f9fafb' }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="p-2 rounded-xl bg-amber-500 text-white disabled:opacity-30 transition-all hover:bg-amber-600"
            >
              {loading ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : <Send style={{ width: 16, height: 16 }} />}
            </button>
          </div>
        </div>
      )}

      {/* Pet button */}
      <button
        onClick={() => setOpen(!open)}
        className={`relative group ${bounce ? 'animate-bounce' : ''}`}
        style={{ filter: 'drop-shadow(0 4px 12px rgba(245,158,11,0.5))' }}
      >
        <div className="absolute -inset-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 blur-lg"
          style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.3) 0%, transparent 70%)' }} />
        <div className="relative transition-transform duration-300 group-hover:scale-110">
          <PetSvg />
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse"
            style={{ background: '#ef4444', border: '2px solid white' }} />
        </div>
        <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs font-medium bg-white text-gray-700 px-2.5 py-1.5 rounded-xl shadow whitespace-nowrap border border-gray-100">¡Hola! Preguntame 🐾</span>
        </div>
      </button>
    </div>
  );
}
