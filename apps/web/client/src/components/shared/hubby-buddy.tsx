import { useState, useRef, useEffect } from 'react';
import { Link } from 'wouter';

const ONBOARDING_KEY = 'pymeshub_onboarding_done';

export function HubbyBuddy() {
  const [visible, setVisible] = useState(false);
  const [bounce, setBounce] = useState(false);
  const [waving, setWaving] = useState(false);
  const [blinking, setBlinking] = useState(false);
  const [lookingRight, setLookingRight] = useState(false);
  const intervalRef = useRef<any>(null);
  const blinkRef = useRef<any>(null);

  useEffect(() => {
    const onboardingDone = localStorage.getItem(ONBOARDING_KEY);
    if (!onboardingDone) return; // Don't show during onboarding tour

    const showTimer = setTimeout(() => setVisible(true), 1500);

    // Bounce/wave every 12 seconds
    intervalRef.current = setInterval(() => {
      setBounce(true);
      setWaving(true);
      setTimeout(() => setBounce(false), 600);
      setTimeout(() => setWaving(false), 1500);
    }, 12000);

    // Blink every 1.5-4s with random delay each time
    const scheduleBlink = () => {
      const delay = 1500 + Math.random() * 2500;
      blinkRef.current = setTimeout(() => {
        setBlinking(true);
        setTimeout(() => setBlinking(false), 220);
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();

    // Look around every 6-10 seconds
    const scheduleLook = () => {
      const delay = 6000 + Math.random() * 4000;
      setTimeout(() => {
        setLookingRight(prev => !prev);
        scheduleLook();
      }, delay);
    };
    scheduleLook();

    return () => {
      clearTimeout(showTimer);
      clearInterval(intervalRef.current);
      clearTimeout(blinkRef.current);
    };
  }, []);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-700 ${
        visible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-20 opacity-0 scale-75'
      }`}
      style={{ pointerEvents: visible ? 'auto' : 'none' }}
    >
      <Link href="/agent">
        <div className="relative group cursor-pointer select-none">
          {/* Speech bubble tooltip */}
          <div className="absolute bottom-full right-0 mb-3 opacity-0 group-hover:opacity-100 transition-all duration-200">
            <div
              className="relative px-3 py-2 rounded-2xl rounded-br-md text-xs font-medium whitespace-nowrap shadow-lg"
              style={{ background: '#1e1b4b', color: '#e0e7ff', border: '1px solid #4338ca' }}
            >
              <span className="relative z-10">¡Hola! Soy Hubby 🐾</span>
              <div className="absolute -bottom-1 right-3 w-2 h-2 bg-card border-r border-b border-[#4338ca] transform rotate-45" />
            </div>
          </div>

          {/* Glow ring on hover */}
          <div
            className="absolute -inset-3 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 blur-xl"
            style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)' }}
          />

          {/* Shadow */}
          <div
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-12 h-3 rounded-full opacity-30 blur-sm transition-all duration-300"
            style={{ background: '#312e81' }}
          />

          {/* === THE PET === */}
          <div
            className={`relative transition-transform duration-300 group-hover:scale-110 ${
              bounce ? 'animate-bounce' : ''
            }`}
            style={{ filter: 'drop-shadow(0 4px 12px rgba(79,70,229,0.5))' }}
          >
            {/* Body */}
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="bodyGrad" cx="40%" cy="35%" r="50%">
                  <stop offset="0%" stopColor="#a78bfa" />
                  <stop offset="60%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#5b21b6" />
                </radialGradient>
                <radialGradient id="earGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#c4b5fd" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </radialGradient>
                <radialGradient id="bellyGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ddd6fe" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </radialGradient>
              </defs>

              {/* Left ear */}
              <ellipse cx="16" cy="14" rx="7" ry="11" fill="url(#earGrad)" transform="rotate(-15 16 14)" />
              <ellipse cx="16" cy="14" rx="4" ry="7" fill="#c4b5fd" transform="rotate(-15 16 14)" opacity="0.4" />

              {/* Right ear */}
              <ellipse cx="48" cy="14" rx="7" ry="11" fill="url(#earGrad)" transform="rotate(15 48 14)" />
              <ellipse cx="48" cy="14" rx="4" ry="7" fill="#c4b5fd" transform="rotate(15 48 14)" opacity="0.4" />

              {/* Main body */}
              <ellipse cx="32" cy="36" rx="22" ry="21" fill="url(#bodyGrad)" />

              {/* Belly */}
              <ellipse cx="32" cy="42" rx="12" ry="11" fill="url(#bellyGrad)" opacity="0.6" />

              {/* Cheeks (blush) */}
              <ellipse cx="20" cy="38" rx="5" ry="3" fill="#f472b6" opacity="0.3" />
              <ellipse cx="44" cy="38" rx="5" ry="3" fill="#f472b6" opacity="0.3" />

              {/* Eyes - white part */}
              <ellipse cx="26" cy="33" rx="6" ry="7" fill="white" />
              <ellipse cx="38" cy="33" rx="6" ry="7" fill="white" />

              {/* Eyes - pupil (moves side to side) */}
              <ellipse
                cx={lookingRight ? 28 : 25}
                cy="34"
                rx="3"
                ry="4"
                fill="#1e1b4b"
                style={{ transition: 'cx 0.3s ease' }}
              />
              <ellipse
                cx={lookingRight ? 40 : 37}
                cy="34"
                rx="3"
                ry="4"
                fill="#1e1b4b"
                style={{ transition: 'cx 0.3s ease' }}
              />

              {/* Eyes - sparkle */}
              <circle cx="24" cy="31" r="1.2" fill="white" opacity="0.9" />
              <circle cx="36" cy="31" r="1.2" fill="white" opacity="0.9" />

              {/* Blinking eyelids — smooth close/open */}
              <g style={{ opacity: blinking ? 1 : 0, transition: 'opacity 0.08s ease' }}>
                <ellipse cx="26" cy="33" rx="6.5" ry={blinking ? 0.8 : 7} fill="#4c1d95" style={{ transition: 'ry 0.1s ease' }} />
                <ellipse cx="38" cy="33" rx="6.5" ry={blinking ? 0.8 : 7} fill="#4c1d95" style={{ transition: 'ry 0.1s ease' }} />
              </g>

              {/* Nose */}
              <ellipse cx="32" cy="40" rx="2.5" ry="2" fill="#5b21b6" />

              {/* Mouth (smile) */}
              <path
                d="M28 43 Q32 47 36 43"
                stroke="#5b21b6"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />

              {/* Left paw */}
              <ellipse cx="18" cy="54" rx="6" ry="4" fill="#7c3aed" />
              <ellipse cx="18" cy="53" rx="3.5" ry="2.5" fill="#a78bfa" opacity="0.5" />

              {/* Right paw */}
              <ellipse cx="46" cy="54" rx="6" ry="4" fill="#7c3aed" />
              <ellipse cx="46" cy="53" rx="3.5" ry="2.5" fill="#a78bfa" opacity="0.5" />

              {/* Tiny tail on the left */}
              <path
                d="M10 40 Q4 35 6 30"
                stroke="#7c3aed"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                opacity="0.7"
              />
            </svg>

            {/* Pulse dot notification */}
            <div
              className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse"
              style={{ background: '#fbbf24', border: '2px solid #1e1b4b' }}
            />
          </div>
        </div>
      </Link>
    </div>
  );
}
