import { useState, useRef, useEffect } from 'react';
import { Link } from 'wouter';
import { Sparkles } from 'lucide-react';

export function HubbyBuddy() {
  const [visible, setVisible] = useState(false);
  const [bounce, setBounce] = useState(false);
  const [waving, setWaving] = useState(false);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 2000);
    intervalRef.current = setInterval(() => {
      setBounce(true);
      setWaving(true);
      setTimeout(() => setBounce(false), 600);
      setTimeout(() => setWaving(false), 1500);
    }, 12000);
    return () => {
      clearTimeout(showTimer);
      clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 transition-all duration-500 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
      }`}
      style={{ pointerEvents: visible ? 'auto' : 'none' }}
    >
      <Link href="/agent">
        <div className="relative group cursor-pointer">
          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap"
            style={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--fg-1))' }}
          >
            <span className="text-xs font-medium">¿Necesitas ayuda?</span>
          </div>

          {/* Glow ring */}
          <div
            className={`absolute inset-0 rounded-full transition-all duration-300 ${
              bounce ? 'scale-150 opacity-20' : 'scale-100 opacity-0 group-hover:scale-125 group-hover:opacity-15'
            }`}
            style={{ background: 'hsl(var(--accent))' }}
          />

          {/* Avatar */}
          <div
            className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${
              bounce ? 'animate-bounce' : ''
            }`}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)',
              boxShadow: '0 4px 24px rgba(99,102,241,0.4)',
            }}
          >
            {/* Eyes */}
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full bg-white inline-block"
                style={waving ? { transform: 'scaleY(0.3)' } : {}}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-white inline-block"
                style={waving ? { transform: 'scaleY(0.3)' } : {}}
              />
            </div>

            {/* Sparkle accent */}
            <Sparkles
              className="absolute -top-1 -right-1 transition-opacity duration-300"
              style={{
                width: 10,
                height: 10,
                color: '#fbbf24',
                opacity: bounce ? 1 : 0,
              }}
            />

            {/* Pulse dot */}
            <div
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ background: '#fbbf24', border: '2px solid rgb(17,24,39)' }}
            />
          </div>
        </div>
      </Link>
    </div>
  );
}
