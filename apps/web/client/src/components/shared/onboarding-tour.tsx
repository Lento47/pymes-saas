import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'pymeshub_onboarding_done';
const TOUR_DURATION_MS = 5 * 60 * 1000;

type Step = {
  title: string;
  body: string;
  targetSelector?: string;
  offsetX?: number; // extra horizontal offset for the pet
};

const STEPS: Step[] = [
  {
    title: '¡Hola! Soy Hubby',
    body: 'Tu asistente inteligente en PyMesHub. Dejame mostrarte lo más importante.',
  },
  {
    title: 'Dashboard',
    body: 'Acá ves el resumen de tu negocio: métricas, gráficos e insights.',
    targetSelector: 'a[href="/"]',
  },
  {
    title: 'Bandeja',
    body: 'WhatsApp, email y chat en un solo lugar.',
    targetSelector: 'a[href="/inbox"]',
  },
  {
    title: 'Contactos',
    body: 'Gestioná clientes, leads y proveedores. Todo centralizado.',
    targetSelector: 'a[href="/contacts"]',
  },
  {
    title: 'Pipeline',
    body: 'Seguí tus oportunidades desde el primer contacto hasta el cierre.',
    targetSelector: 'a[href="/pipeline"]',
  },
  {
    title: 'Automatizaciones',
    body: 'Creá reglas para que tareas repetitivas se hagan solas.',
    targetSelector: 'a[href="/automations"]',
  },
  {
    title: '¡Y yo estoy acá!',
    body: 'Preguntame lo que necesites. Creo contactos, tareas, analizo datos y más.',
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
        <ellipse cx="12" cy="28" rx="5" ry="3" fill="#7c3aed" transform="rotate(-20 12 28)">
          <animateTransform attributeName="transform" type="rotate" values="-20 12 28;10 12 28;-20 12 28" dur="0.6s" repeatCount="indefinite" />
        </ellipse>
      )}
      <ellipse cx="18" cy="54" rx="6" ry="4" fill="#7c3aed" />
      <ellipse cx="46" cy="54" rx="6" ry="4" fill="#7c3aed" />
      <path d="M10 40 Q4 35 6 30" stroke="#7c3aed" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function isOnboardingDone() {
  const done = localStorage.getItem(STORAGE_KEY);
  if (!done) return false;
  return Date.now() - parseInt(done) > 500;
}

export function OnboardingTour() {
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [petPos, setPetPos] = useState({ left: 0, top: 0 });
  const timerRef = useRef<any>(null);
  const autoRef = useRef<any>(null);
  const doneCheck = useRef(isOnboardingDone());

  // Calculate positions based on target element
  const updatePositions = (s: Step) => {
    if (s.targetSelector) {
      const el = document.querySelector(s.targetSelector) as HTMLElement;
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        // Pet to the right of the sidebar element, centered vertically
        setPetPos({
          left: rect.right + 28,
          top: rect.top + rect.height / 2 - 32,
        });
      }
    } else {
      // First step: center pet & bubble in visible area
      setTargetRect(null);
      const sidebar = document.querySelector('aside') as HTMLElement;
      const sbRight = sidebar ? sidebar.getBoundingClientRect().right : 200;
      const contentWidth = Math.max(window.innerWidth - sbRight - 32, 300);
      const cx = sbRight + contentWidth / 2 - 36;
      const cy = Math.min(window.innerHeight * 0.4, 350);
      setPetPos({
        left: Math.max(sbRight + 40, cx),
        top: cy,
      });
    }
  };

  useEffect(() => {
    if (doneCheck.current) return;
    setMounted(true);
    updatePositions(STEPS[0]);

    const onResize = () => updatePositions(STEPS[step]);
    window.addEventListener('resize', onResize);

    timerRef.current = setTimeout(() => finish(), TOUR_DURATION_MS);

    return () => {
      clearTimeout(timerRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    updatePositions(STEPS[step]);
    // Restart auto-advance on step change
    clearInterval(autoRef.current);
    if (step > 0) {
      autoRef.current = setInterval(() => {
        setStep(s => (s < STEPS.length - 1 ? s + 1 : s));
      }, 8000);
    }
  }, [step]);

  const finish = () => {
    setExiting(true);
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    // Clean up highlights
    STEPS.forEach(s => {
      if (!s.targetSelector) return;
      const el = document.querySelector(s.targetSelector) as HTMLElement;
      if (el) {
        el.style.boxShadow = '';
        el.style.zIndex = '';
      }
    });
    setTimeout(() => setMounted(false), 600);
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      finish();
    }
  };

  // Highlight current target
  useEffect(() => {
    if (!STEPS[step].targetSelector || exiting) return;
    const el = document.querySelector(STEPS[step].targetSelector!) as HTMLElement;
    if (!el) return;
    const origShadow = el.style.boxShadow;
    const origZ = el.style.zIndex;
    el.style.transition = 'all 0.3s ease';
    el.style.boxShadow = '0 0 0 3px #7c3aed, 0 0 20px rgba(124,58,237,0.5)';
    el.style.borderRadius = '8px';
    el.style.position = 'relative';
    el.style.zIndex = '9999';
    return () => {
      el.style.boxShadow = origShadow;
      el.style.zIndex = origZ;
    };
  }, [step, exiting]);

  if (doneCheck.current || !mounted) return null;

  const s = STEPS[step];
  const lastStep = step === STEPS.length - 1;
  const hasTarget = !!s.targetSelector && !!targetRect;
  // On narrow screens, center pet below target
  const isMobile = window.innerWidth < 640;

  return (
    <div className="fixed inset-0 z-[9998]" style={{ pointerEvents: 'all' }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity duration-500"
        onClick={() => next()}
        style={{
          background: 'rgba(0,0,0,0.35)',
          opacity: exiting ? 0 : 1,
          cursor: 'pointer',
        }}
      />

      {/* HubbyBuddy character */}
      <div
        className="absolute transition-all duration-600"
        style={{
          left: isMobile ? '50%' : `${petPos.left}px`,
          top: `${petPos.top}px`,
          transform: `translate(${isMobile ? '-50%' : '0'}, 0) scale(${exiting ? 0 : 1})`,
          opacity: exiting ? 0 : 1,
          zIndex: 9999,
          filter: 'drop-shadow(0 0 24px rgba(124,58,237,0.6))',
          transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <PetSvg size={64} mood={lastStep ? 'waving' : 'happy'} />
      </div>

      {/* Speech bubble */}
      <div
        className="absolute transition-all duration-500"
        style={{
          left: isMobile ? '50%' : `${Math.max(petPos.left - 120, 220)}px`,
          top: `${petPos.top - 130}px`,
          transform: `translate(${isMobile ? '-50%' : '0'}, 0)`,
          opacity: exiting ? 0 : 1,
          zIndex: 9999,
        }}
      >
        <div
          className="rounded-2xl p-4 max-w-[280px] shadow-2xl relative"
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

          {/* Connection arrow — points from bubble to highlighted element */}
          {hasTarget && (
            <div className="absolute" style={{
              bottom: '-30px',
              left: `${petPos.left - (petPos.left - 80) + 67}px`,
            }}>
              {/* Vertical line down from bubble */}
              <div className="w-0.5 h-7 mx-auto" style={{ background: '#7c3aed', opacity: 0.5 }} />
              {/* Chevron pointing left at target */}
              <div
                className="w-2 h-2 border-l-2 border-b-2"
                style={{
                  borderColor: '#7c3aed',
                  transform: 'rotate(45deg)',
                  marginTop: '-4px',
                  marginLeft: '-3px',
                  opacity: 0.7,
                }}
              />
            </div>
          )}

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

      {/* Timer bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/10" style={{ zIndex: 9999 }}>
        <div
          className="h-full"
          style={{
            background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
            animation: `shrink ${TOUR_DURATION_MS}ms linear forwards`,
          }}
        />
      </div>

      <style>{`@keyframes shrink { from { width: 100%; } to { width: 0%; } }`}</style>
    </div>
  );
}
