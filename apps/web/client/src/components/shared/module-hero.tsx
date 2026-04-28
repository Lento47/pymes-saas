import { type ModuleKey, heroThemes } from "@/lib/moduleHeroTheme";

// ── Shared wave SVG overlay ────────────────────────────────────────────────────
function WaveOverlay({ color }: { color: string }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 900 200"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <path
        d="M0 120 C150 80 300 160 450 100 C600 40 750 140 900 80 L900 200 L0 200 Z"
        fill={color}
        fillOpacity="0.06"
      />
      <path
        d="M0 150 C200 100 400 180 600 120 C750 70 850 150 900 110 L900 200 L0 200 Z"
        fill={color}
        fillOpacity="0.04"
      />
    </svg>
  );
}

// ── Floating accent dots ───────────────────────────────────────────────────────
function FloatingDots({ color }: { color: string }) {
  const dots = [
    { cx: "82%", cy: "25%", r: 3 },
    { cx: "88%", cy: "55%", r: 2 },
    { cx: "75%", cy: "70%", r: 4 },
    { cx: "92%", cy: "35%", r: 2 },
    { cx: "68%", cy: "40%", r: 3 },
  ];
  return (
    <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={color} fillOpacity="0.35" />
      ))}
    </svg>
  );
}

// ── Soft glow blob ─────────────────────────────────────────────────────────────
function GlowBlob({ color }: { color: string }) {
  return (
    <div
      className="absolute right-0 top-0 w-72 h-full pointer-events-none"
      style={{
        background: `radial-gradient(ellipse at 80% 50%, ${color}22 0%, transparent 70%)`,
      }}
    />
  );
}

// ── Module-specific symbolic SVGs ─────────────────────────────────────────────

function DashboardSymbol({ color, secondary }: { color: string; secondary: string }) {
  return (
    <svg className="absolute right-6 top-1/2 -translate-y-1/2 h-[85%] w-auto opacity-80" viewBox="0 0 200 160" aria-hidden="true">
      <rect x="20" y="20" width="70" height="70" rx="16" fill={color} fillOpacity="0.18" />
      <rect x="30" y="30" width="70" height="70" rx="16" fill={secondary} fillOpacity="0.22" />
      <rect x="40" y="40" width="70" height="70" rx="16" fill={color} fillOpacity="0.28" stroke={color} strokeWidth="1.5" strokeOpacity="0.4" />
      <circle cx="150" cy="40" r="12" fill={color} fillOpacity="0.15" />
      <circle cx="165" cy="55" r="8" fill={secondary} fillOpacity="0.2" />
    </svg>
  );
}

function InboxSymbol({ color }: { color: string }) {
  return (
    <svg className="absolute right-8 top-1/2 -translate-y-1/2 h-[80%] w-auto opacity-75" viewBox="0 0 220 160" aria-hidden="true">
      <rect x="10" y="50" width="120" height="70" rx="14" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1" strokeOpacity="0.3" />
      <rect x="30" y="30" width="120" height="70" rx="14" fill={color} fillOpacity="0.16" stroke={color} strokeWidth="1" strokeOpacity="0.3" />
      <rect x="50" y="10" width="120" height="70" rx="14" fill={color} fillOpacity="0.22" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
      <path d="M60 35 L110 60 L160 35" stroke={color} strokeWidth="1.5" fill="none" strokeOpacity="0.6" />
      <circle cx="185" cy="25" r="8" fill="#EF4444" fillOpacity="0.8" />
      <circle cx="185" cy="25" r="4" fill="white" fillOpacity="0.9" />
    </svg>
  );
}

function ContactsSymbol({ color }: { color: string }) {
  const nodes = [
    { cx: 130, cy: 80, r: 20 },
    { cx: 175, cy: 45, r: 14 },
    { cx: 180, cy: 115, r: 14 },
    { cx: 90, cy: 45, r: 12 },
    { cx: 85, cy: 115, r: 12 },
  ];
  return (
    <svg className="absolute right-4 top-1/2 -translate-y-1/2 h-[85%] w-auto opacity-75" viewBox="0 0 220 160" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <line key={i} x1={nodes[0].cx} y1={nodes[0].cy} x2={nodes[i].cx} y2={nodes[i].cy}
          stroke={color} strokeWidth="1" strokeOpacity="0.3" />
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.cx} cy={n.cy} r={n.r + 4} fill={color} fillOpacity="0.08" />
          <circle cx={n.cx} cy={n.cy} r={n.r} fill={color} fillOpacity={i === 0 ? "0.3" : "0.18"} stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
        </g>
      ))}
    </svg>
  );
}

function PipelineSymbol({ color }: { color: string }) {
  const stages = [0, 1, 2, 3, 4];
  return (
    <svg className="absolute right-4 top-1/2 -translate-y-1/2 h-[75%] w-auto opacity-75" viewBox="0 0 240 160" aria-hidden="true">
      {stages.map((i) => (
        <g key={i}>
          <rect x={20 + i * 44} y={100 - i * 12} width="32" height={50 + i * 12} rx="6"
            fill={color} fillOpacity={0.12 + i * 0.05} stroke={color} strokeWidth="1" strokeOpacity="0.3" />
        </g>
      ))}
      <polyline points="36,96 80,82 124,70 168,56 212,44"
        fill="none" stroke={color} strokeWidth="2" strokeOpacity="0.5" strokeDasharray="4 3" />
    </svg>
  );
}

function InvoicesSymbol({ color }: { color: string }) {
  return (
    <svg className="absolute right-4 top-1/2 -translate-y-1/2 h-[85%] w-auto opacity-75" viewBox="0 0 200 160" aria-hidden="true">
      <rect x="70" y="15" width="110" height="140" rx="12" fill={color} fillOpacity="0.08" stroke={color} strokeWidth="1" strokeOpacity="0.25" />
      <rect x="50" y="25" width="110" height="140" rx="12" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1" strokeOpacity="0.3" />
      <rect x="30" y="35" width="110" height="110" rx="12" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.5" strokeOpacity="0.4" />
      <line x1="50" y1="70" x2="120" y2="70" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
      <line x1="50" y1="85" x2="100" y2="85" stroke={color} strokeWidth="1" strokeOpacity="0.35" />
      <line x1="50" y1="100" x2="110" y2="100" stroke={color} strokeWidth="1" strokeOpacity="0.35" />
      <path d="M105 115 L115 105 L125 115" stroke={color} strokeWidth="2" fill="none" strokeOpacity="0.6" />
    </svg>
  );
}

function TasksSymbol({ color }: { color: string }) {
  const tasks = [30, 60, 90, 120];
  return (
    <svg className="absolute right-6 top-1/2 -translate-y-1/2 h-[80%] w-auto opacity-75" viewBox="0 0 200 160" aria-hidden="true">
      {tasks.map((y, i) => (
        <g key={i}>
          <rect x="40" y={y} width="140" height="20" rx="6"
            fill={color} fillOpacity={i === 0 ? "0.22" : "0.1"} stroke={color} strokeWidth="1" strokeOpacity="0.3" />
          <circle cx="55" cy={y + 10} r="6" fill={color} fillOpacity={i < 2 ? "0.5" : "0.2"} />
          {i < 2 && <path d={`M51 ${y + 10} L54 ${y + 13} L60 ${y + 7}`} stroke="white" strokeWidth="1.5" fill="none" />}
        </g>
      ))}
    </svg>
  );
}

function DocumentsSymbol({ color }: { color: string }) {
  return (
    <svg className="absolute right-4 top-1/2 -translate-y-1/2 h-[85%] w-auto opacity-75" viewBox="0 0 200 160" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={30 + i * 30} y={15 + i * 10} width="80" height="100" rx="8"
            fill={color} fillOpacity={0.1 + i * 0.06} stroke={color} strokeWidth="1" strokeOpacity="0.3" />
          <line x1={45 + i * 30} y1={45 + i * 10} x2={95 + i * 30} y2={45 + i * 10}
            stroke={color} strokeWidth="1.5" strokeOpacity="0.4" />
          <line x1={45 + i * 30} y1={58 + i * 10} x2={85 + i * 30} y2={58 + i * 10}
            stroke={color} strokeWidth="1" strokeOpacity="0.3" />
        </g>
      ))}
    </svg>
  );
}

function AutomationsSymbol({ color, secondary }: { color: string; secondary: string }) {
  return (
    <svg className="absolute right-4 top-1/2 -translate-y-1/2 h-[85%] w-auto opacity-80" viewBox="0 0 220 160" aria-hidden="true">
      <circle cx="80" cy="80" r="30" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="6 4" />
      <circle cx="80" cy="80" r="18" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
      <path d="M120 80 C140 50 170 90 150 110 C140 120 120 110 120 80" fill="none" stroke={secondary} strokeWidth="1.5" strokeOpacity="0.5" />
      <circle cx="150" cy="45" r="10" fill={secondary} fillOpacity="0.2" stroke={secondary} strokeWidth="1.5" strokeOpacity="0.5" />
      <circle cx="175" cy="110" r="8" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
      <line x1="97" y1="70" x2="140" y2="50" stroke={color} strokeWidth="1" strokeOpacity="0.3" />
      <line x1="97" y1="90" x2="167" y2="108" stroke={color} strokeWidth="1" strokeOpacity="0.3" />
    </svg>
  );
}

function BillingSymbol({ color }: { color: string }) {
  return (
    <svg className="absolute right-4 top-1/2 -translate-y-1/2 h-[85%] w-auto opacity-75" viewBox="0 0 200 160" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <rect key={i} x={20 + i * 18} y={20 + i * 12} width="140" height="80" rx="12"
          fill={color} fillOpacity={0.08 + i * 0.06} stroke={color} strokeWidth="1" strokeOpacity={0.2 + i * 0.1} />
      ))}
      <path d="M90 80 C110 50 140 70 130 100" stroke={color} strokeWidth="2" fill="none" strokeOpacity="0.5" />
      <path d="M100 65 A 20 20 0 1 1 100 64.9" stroke={color} strokeWidth="1.5" fill="none" strokeOpacity="0.35" strokeDasharray="5 3" />
    </svg>
  );
}

function SettingsSymbol({ color }: { color: string }) {
  return (
    <svg className="absolute right-6 top-1/2 -translate-y-1/2 h-[85%] w-auto opacity-70" viewBox="0 0 200 160" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx="110" cy={40 + i * 40} r={28 - i * 4} fill="none" stroke={color} strokeWidth="1.5" strokeOpacity={0.35 - i * 0.05} strokeDasharray={i % 2 === 0 ? "none" : "5 3"} />
        </g>
      ))}
      <line x1="40" y1="40" x2="180" y2="40" stroke={color} strokeWidth="1.5" strokeOpacity="0.3" />
      <line x1="40" y1="80" x2="180" y2="80" stroke={color} strokeWidth="1.5" strokeOpacity="0.3" />
      <line x1="40" y1="120" x2="180" y2="120" stroke={color} strokeWidth="1.5" strokeOpacity="0.3" />
      <circle cx="90" cy="40" r="6" fill={color} fillOpacity="0.5" />
      <circle cx="140" cy="80" r="6" fill={color} fillOpacity="0.5" />
      <circle cx="100" cy="120" r="6" fill={color} fillOpacity="0.5" />
    </svg>
  );
}

// ── Selector map ───────────────────────────────────────────────────────────────
const SYMBOLS: Record<ModuleKey, (props: { color: string; secondary: string }) => JSX.Element> = {
  dashboard:   ({ color, secondary }) => <DashboardSymbol color={color} secondary={secondary} />,
  inbox:       ({ color }) => <InboxSymbol color={color} />,
  contacts:    ({ color }) => <ContactsSymbol color={color} />,
  pipeline:    ({ color }) => <PipelineSymbol color={color} />,
  invoices:    ({ color }) => <InvoicesSymbol color={color} />,
  tasks:       ({ color }) => <TasksSymbol color={color} />,
  documents:   ({ color }) => <DocumentsSymbol color={color} />,
  automations: ({ color, secondary }) => <AutomationsSymbol color={color} secondary={secondary} />,
  billing:     ({ color }) => <BillingSymbol color={color} />,
  settings:    ({ color }) => <SettingsSymbol color={color} />,
};

// ── Public component ───────────────────────────────────────────────────────────
interface ModuleHeroProps {
  module: ModuleKey;
  children?: React.ReactNode;
  className?: string;
}

export function ModuleHero({ module, children, className = "" }: ModuleHeroProps) {
  const theme = heroThemes[module];
  const Symbol = SYMBOLS[module];

  return (
    <div
      className={`relative w-full rounded-[20px] overflow-hidden ${className}`}
      style={{ background: theme.gradient, minHeight: 140 }}
    >
      {/* Layer 1: wave lines */}
      <WaveOverlay color={theme.accentColor} />

      {/* Layer 2: glow blob */}
      <GlowBlob color={theme.accentColor} />

      {/* Layer 3: symbolic graphic */}
      <Symbol color={theme.accentColor} secondary={theme.secondaryColor} />

      {/* Layer 4: floating dots */}
      <FloatingDots color={theme.accentColor} />

      {/* Layer 5: content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
