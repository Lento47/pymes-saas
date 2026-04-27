import { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { X, ArrowRight, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'pymeshub_onboarding_done';
const TOUR_DURATION_MS = 5 * 60 * 1000; // 5 minutes

type Step = {
  title: string;
  body: string;
  x: number; // % from left
  y: number; // % from top
  targetSelector?: string;
};

const STEPS: Step[] = [
  {
    title: '¡Hola! Soy Hubby',
    body: 'Tu asistente inteligente en PyMesHub. Dejame mostrarte lo más importante.',
    x: 85, y: 80,
  },
  {
    title: 'Dashboard',
    body: 'Acá ves el resumen de tu negocio: métricas, gráficos e insights en tiempo real.',
    x: 22, y: 14,
    targetSelector: 'a[href="/"]',
  },
  {
    title: 'Bandeja de entrada',
    body: 'WhatsApp, email y chat en un solo lugar. Atendé a tus clientes sin cambiar de app.',
    x: 22, y: 24,
    targetSelector: 'a[href="/inbox"]',
  },
  {
    title: 'Contactos y CRM',
    body: 'Gestioná tus clientes, leads y proveedores. Todo centralizado.',
    x: 22, y: 34,
    targetSelector: 'a[href="/contacts"]',
  },
  {
    title: 'Pipeline de ventas',
    body: 'Seguí tus oportunidades de negocio desde el primer contacto hasta el cierre.',
    x: 22, y: 53,
    targetSelector: 'a[href="/pipeline"]',
  },
  {
    title: 'Automatizaciones',
    body: 'Creá reglas para que las tareas repetitivas se hagan solas.',
    x: 22, y: 60,
    targetSelector: 'a[href="/automations"]',
  },
  {
    title: '¡Y yo estoy acá!',
    body: 'Preguntame lo que necesites. Creo contactos, tareas, analizo datos y más.',
    x: 85, y: 50,
    targetSelector: 'a[href="/agent"]',
  },
];

function PetSvg({ size = 64, mood = 'happy' }: { size?: number; mood?: 'happy' | 'waving' }) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    const t = setInterval(() => { setBlink(true); setTimeout(() => setBlink(false), 220); }, 2000 + Math.random() * 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="onbG" cx="40%" cy="35%" r="50%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="60%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#5b21b6" />
        </radialGradient>
      </defs>
      <ellipse cx="16" cy="14" rx="7" ry="11" fill="#c4b5fd" transform="rotate(-15 16 14)" />
      <ellipse cx="48" cy="14" rx="7" ry="11" fill="#c4b5fd" transform="rotate(15 48 14)" />
      <ellipse cx="32" cy="36" rx="22" ry="21" fill="url(#onbG)" />
      <ellipse cx="32" cy="42" rx="12" ry="11" fill="#ddd6fe" opacity="0.5" />
      <ellipse cx="20" cy="38" rx="5" ry="3" fill="#f472b6" opacity="0.35" />
      <ellipse cx="44" cy="38" rx="5" ry="3" fill="#f472b6" opacity="0.35" />
      <ellipse cx="26" cy="33" rx="6" ry="7" fill="white" />
      <ellipse cx="38" cy="33" rx="6" ry="7" fill="white" />
      <ellipse cx="25" cy="34" rx="3" ry="4" fill="#1e1b4b" />
      <ellipse cx="37" cy="34" rx="3" ry="4" fill="#1e1b4b" />
      <circle cx="24" cy="31" r="1.2" fill="white" opacity="0.9" />
      <circle cx="36" cy="31" r="1.2" fill="white" opacity="0.9" />
      {blink && (
        <>
          <ellipse cx="26" cy="33" rx="6" ry="1" fill="#4c1d95" />
          <ellipse cx="38" cy="33" rx="6" ry="1" fill="#4c1d95" />
        </>
      )}
      <ellipse cx="32" cy="40" rx="2.5" ry="2" fill="#5b21b6" />
      {mood === 'waving' ? (
        <path d="M26 43 Q32 48 38 43" stroke="#5b21b6" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M28 44 Q32 46 36 44" stroke="#5b21b6" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      )}
      {mood === 'waving' && (
        <>
          <ellipse cx="12" cy="28" rx="4" ry="2.5" fill="#7c3aed" transform="rotate(-20 12 28)">
            <animateTransform attributeName="transform" type="rotate" values="-20 12 28;10 12 28;-20 12 28" dur="0.6s" repeatCount="indefinite" />
          </ellipse>
        </>
      )}
      <ellipse cx="18" cy="54" rx="6" ry="4" fill="#7c3aed" />
      <ellipse cx="46" cy="54" rx="6" ry="4" fill="#7c3aed" />
      <path d="M10 40 Q4 35 6 30" stroke="#7c3aed" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function PawPrints({ step }: { step: number }) {
  if (step < 1) return null;
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 9998 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <span
          key={i}
          className="absolute text-lg opacity-0"
          style={{
            left: `${15 + i * 8}%`,
            top: `${70 - i * 5}%`,
            animation: `fadeInOut 2s ${i * 0.3}s ease forwards`,
            fontSize: '20px',
          }}
        >
          🐾
        </span>
      ))}
    </div>
  );
}

export function OnboardingTour() {
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [width, setWidth] = useState(window.innerWidth);
  const timerRef = useRef<any>(null);
  const autoRef = useRef<any>(null);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (done) return;

    // Auto-advance every 8 seconds
    autoRef.current = setInterval(() => {
      setStep(s => (s < STEPS.length - 1 ? s + 1 : s));
    }, 8000);

    // Auto-dismiss after 5 minutes
    timerRef.current = setTimeout(() => finish(), TOUR_DURATION_MS);

    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);

    return () => {
      clearInterval(autoRef.current);
      clearTimeout(timerRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const finish = () => {
    setExiting(true);
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setTimeout(() => { /* component unmounts via parent */ }, 500);
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
      // Reset auto timer
      clearInterval(autoRef.current);
      autoRef.current = setInterval(() => setStep(s => s < STEPS.length - 1 ? s + 1 : s), 8000);
    } else {
      finish();
    }
  };

  const s = STEPS[step];
  const lastStep = step === STEPS.length - 1;
  // On mobile (<640px), use fixed positions
  const isMobile = width < 640;

  // Highlight target if exists
  useEffect(() => {
    if (!s.targetSelector) return;
    const el = document.querySelector(s.targetSelector) as HTMLElement;
    if (!el) return;
    el.style.transition = 'all 0.3s ease';
    el.style.boxShadow = '0 0 0 3px #7c3aed, 0 0 20px rgba(124,58,237,0.5)';
    el.style.borderRadius = '8px';
    el.style.position = 'relative';
    el.style.zIndex = '9999';
    return () => {
      el.style.boxShadow = '';
      el.style.zIndex = '';
    };
  }, [step, s.targetSelector]);

  return (
    <div className="fixed inset-0 z-[9998]" style={{ pointerEvents: 'all' }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          background: 'rgba(0,0,0,0.6)',
          opacity: exiting ? 0 : 1,
        }}
      />

      {/* Paw prints */}
      <PawPrints step={step} />

      {/* HubbyBuddy character */}
      <div
        className="absolute transition-all duration-700 ease-in-out"
        style={{
          left: isMobile ? '50%' : `${s.x}%`,
          top: isMobile ? '50%' : `${s.y}%`,
          transform: `translate(-50%, -50%) scale(${exiting ? 0 : 1})`,
          opacity: exiting ? 0 : 1,
          zIndex: 9999,
          filter: 'drop-shadow(0 0 24px rgba(124,58,237,0.6))',
        }}
      >
        {/* Bounce animation when arriving */}
        <div className="animate-bounce" style={{ animationDuration: '0.5s', animationIterationCount: '3' }}>
          <PetSvg size={72} mood={lastStep ? 'waving' : 'happy'} />
        </div>
      </div>

      {/* Speech bubble */}
      <div
        className="absolute transition-all duration-500"
        style={{
          left: isMobile ? '50%' : `${s.x}%`,
          top: isMobile ? '35%' : `${s.y - 10}%`,
          transform: `translate(-50%, -100%)`,
          opacity: exiting ? 0 : 1,
          zIndex: 9999,
        }}
      >
        <div
          className="rounded-2xl p-4 max-w-xs shadow-2xl relative"
          style={{
            background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
            border: '1px solid #4338ca',
            color: '#e0e7ff',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles style={{ width: 14, height: 14, color: '#a78bfa' }} />
            <h3 className="text-sm font-bold">{s.title}</h3>
            <span className="text-xs ml-auto" style={{ color: '#818cf8' }}>
              {step + 1}/{STEPS.length}
            </span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: '#c7d2fe' }}>{s.body}</p>

          <div className="flex items-center justify-between mt-3">
            <button
              onClick={finish}
              className="text-xs hover:underline"
              style={{ color: '#6366f1' }}
            >
              Saltar tour
            </button>
            <button
              onClick={next}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
              style={{ background: '#7c3aed', color: 'white' }}
            >
              {lastStep ? '¡Empecemos!' : 'Siguiente'}
              <ArrowRight style={{ width: 12, height: 12 }} />
            </button>
          </div>

          {/* Arrow pointing down to HubbyBuddy */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rotate-45"
            style={{
              bottom: '-6px',
              background: '#312e81',
              borderRight: '1px solid #4338ca',
              borderBottom: '1px solid #4338ca',
            }}
          />
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="absolute bottom-0 left-0 h-1 transition-all duration-300"
        style={{
          width: `${((step + 1) / STEPS.length) * 100}%`,
          background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
          zIndex: 9999,
        }}
      />

      {/* Timer bar at top - depletes over 5 minutes */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/10" style={{ zIndex: 9999 }}>
        <div
          className="h-full"
          style={{
            background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
            animation: `shrink ${TOUR_DURATION_MS}ms linear forwards`,
          }}
        />
      </div>

      <style>{`
        @keyframes shrink { from { width: 100%; } to { width: 0%; } }
        @keyframes fadeInOut { 0% { opacity: 0; transform: scale(0.5); } 50% { opacity: 0.4; } 100% { opacity: 0; transform: scale(1.2); } }
      `}</style>
    </div>
  );
}
