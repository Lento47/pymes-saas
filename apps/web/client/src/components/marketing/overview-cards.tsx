import type { ReactNode } from "react";

interface OverviewCardProps {
  copy: Record<string, any>;
  variant: "carousel" | "desktop";
  children?: ReactNode;
}

const hoverClasses =
  "transition-all duration-300 hover:shadow-md";

const channelColors: Record<string, string> = {
  WhatsApp: "#25D366",
  Email: "#4F6EF7",
  Invoices: "#F59E0B",
  Pipeline: "#8B7CF6",
};

export function InboxCard({ copy, variant }: OverviewCardProps) {
  return (
    <article
      className={`landing-card rounded-xl p-6 ${variant === "desktop" ? hoverClasses : ""}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 p-2">
        <img
          src="/landing-icons/world.png"
          alt=""
          className="h-full w-full object-contain"
          aria-hidden="true"
        />
      </div>
      <h2 className="font-marketing mt-6 text-2xl font-semibold tracking-[-0.03em] text-gray-900">
        {copy.overview.inbox.title}
      </h2>
      <p className="mt-3 text-sm leading-7 text-gray-500">
        {copy.overview.inbox.description}
      </p>

      <div className="mt-8 space-y-3">
        {copy.overview.inbox.signals.map((signal: { label: string; value: string }) =>
          variant === "carousel" ? (
            <div
              key={signal.label}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3"
            >
              <span className="min-w-0 flex-1 font-marketing text-sm font-semibold text-gray-700">
                {signal.label}
              </span>
              <span className="max-w-[8.75rem] whitespace-normal text-right text-[0.68rem] uppercase leading-[1.35] tracking-[0.12em] text-amber-600">
                {signal.value}
              </span>
            </div>
          ) : (
            <div
              key={signal.label}
              className="flex items-center gap-3 rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  background: channelColors[signal.label] ?? "#7C3AED",
                  boxShadow: `0 0 8px ${channelColors[signal.label] ?? "#7C3AED"}66`,
                }}
              />
              <span className="min-w-0 flex-1 font-marketing text-sm font-semibold text-gray-700">
                {signal.label}
              </span>
              <span className="max-w-[8.75rem] whitespace-normal text-right text-[0.68rem] uppercase leading-[1.35] tracking-[0.12em] text-amber-600">
                {signal.value}
              </span>
            </div>
          )
        )}
      </div>

      <div className="mt-8 grid grid-cols-7 gap-2">
        {Array.from({ length: 28 }, (_, index) => {
          const active = [1, 4, 8, 12, 17, 18, 23, 25, 27].includes(index);
          return (
            <span
              key={index}
              className={`h-2.5 w-2.5 rounded-full ${
                active ? "bg-amber-400" : "bg-violet-100"
              }`}
            />
          );
        })}
      </div>

      <div className="mt-8 rounded-full bg-gray-50 border border-gray-100 px-4 py-3 text-sm text-gray-500">
        {copy.overview.inbox.footer}
      </div>
    </article>
  );
}

export function PerformanceCard({ copy, variant }: OverviewCardProps) {
  return (
    <article
      className={`landing-card rounded-xl p-6 ${
        variant === "desktop" ? hoverClasses : ""
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 p-2">
          <img
            src="/landing-icons/performance.png"
            alt=""
            className="h-full w-full object-contain"
            aria-hidden="true"
          />
        </div>
        <div>
          <h2 className="font-marketing text-2xl font-semibold tracking-[-0.03em] text-gray-900">
            {copy.overview.performance.title}
          </h2>
          <p className="text-sm text-gray-500">
            {copy.overview.performance.description}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <p className="text-sm uppercase tracking-[0.25em] text-gray-400">
          {copy.overview.performance.metricLabel}
        </p>
        <div className="mt-2 flex items-end gap-3">
          <span className="font-marketing text-4xl font-semibold tracking-[-0.04em] text-gray-900">
            {copy.overview.performance.metricValue}
          </span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
            {copy.overview.performance.metricChange}
          </span>
        </div>
      </div>

      <div className="mt-8 h-[18rem] w-full rounded-xl border border-gray-100 bg-gray-50 p-3">
        <svg viewBox="0 0 460 260" className="h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="request-line" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#FDE68A" />
            </linearGradient>
            <linearGradient id="request-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(245,158,11,0.25)" />
              <stop offset="100%" stopColor="rgba(245,158,11,0.01)" />
            </linearGradient>
            <filter id="request-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {[0, 1, 2, 3, 4, 5].map((index) => (
            <line
              key={`h-${index}`}
              x1="48"
              x2="420"
              y1={48 + index * 34}
              y2={48 + index * 34}
              stroke="rgba(0,0,0,0.06)"
              strokeWidth="1"
            />
          ))}

          {[0, 1, 2, 3, 4, 5].map((index) => (
            <line
              key={`v-${index}`}
              x1={48 + index * 74}
              x2={48 + index * 74}
              y1="48"
              y2="218"
              stroke="rgba(0,0,0,0.05)"
              strokeWidth="1"
            />
          ))}

          <path
            d="M48 197C74 185 84 166 112 168C136 170 150 176 176 150C193 132 210 136 232 118C252 101 269 97 288 126C304 149 329 146 351 130C367 118 382 122 401 110C414 102 420 92 420 92V218H48Z"
            fill="url(#request-area)"
          />
          <path
            d="M48 197C74 185 84 166 112 168C136 170 150 176 176 150C193 132 210 136 232 118C252 101 269 97 288 126C304 149 329 146 351 130C367 118 382 122 401 110C414 102 420 92 420 92"
            fill="none"
            stroke="url(#request-line)"
            strokeWidth="4"
            strokeLinecap="round"
            filter="url(#request-glow)"
          />

          {copy.overview.performance.chartDays.map((label: string, index: number) => (
            <text
              key={label}
              x={48 + index * 74}
              y="242"
              fill="rgba(107,114,128,0.8)"
              fontSize="12"
              fontFamily="Manrope, sans-serif"
            >
              {label}
            </text>
          ))}
        </svg>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {copy.overview.performance.stats.map(
          ({ label, value }: { label: string; value: string }) => (
            <div key={label} className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-gray-400">{label}</p>
              <p className="font-marketing mt-2 text-2xl font-semibold tracking-[-0.03em] text-gray-900">
                {value}
              </p>
            </div>
          )
        )}
      </div>
    </article>
  );
}

export function AutomationsCard({ copy, variant }: OverviewCardProps) {
  return (
    <article
      className={`landing-card rounded-xl p-6 ${variant === "desktop" ? hoverClasses : ""}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 p-2">
        <img
          src="/landing-icons/Smart-automations.png"
          alt=""
          className="h-full w-full object-contain"
          aria-hidden="true"
        />
      </div>
      <h2 className="font-marketing mt-6 text-2xl font-semibold tracking-[-0.03em] text-gray-900">
        {copy.overview.automations.title}
      </h2>
      <p className="mt-3 text-sm leading-7 text-gray-500">
        {copy.overview.automations.description}
      </p>

      <OrbitGraphic />

      {variant === "desktop" && copy.overview.automations.chips && (
        <div className="mt-3 space-y-2">
          {copy.overview.automations.chips.map(
            (chip: { step: string; action: string; color: string }) => (
              <div
                key={chip.step}
                className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: chip.color, boxShadow: `0 0 6px ${chip.color}88` }}
                />
                <span className="font-marketing text-xs text-gray-500">{chip.step}</span>
                <span className="text-gray-300 text-xs">→</span>
                <span className="font-marketing text-xs font-semibold text-gray-800">{chip.action}</span>
              </div>
            )
          )}
        </div>
      )}

      <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="font-marketing text-sm font-semibold text-gray-700">
            {copy.overview.automations.statusLabel}
          </span>
          <span className="flex items-center gap-2 text-sm text-amber-600">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_4px_rgba(245,158,11,0.6)]" />
            {copy.overview.automations.statusValue}
          </span>
        </div>
      </div>
    </article>
  );
}

function OrbitGraphic() {
  return (
    <div className="relative mx-auto mt-8 h-56 w-56">
      <div className="absolute inset-0 rounded-full border border-violet-200/60" />
      <div className="absolute inset-5 rounded-full border border-violet-200/50" />
      <div className="absolute inset-11 rounded-full border border-violet-200/40" />
      <div className="absolute inset-[4.65rem] rounded-full border border-violet-200/30" />
      <div className="animate-pulse-halo absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.85)_0%,rgba(245,158,11,0.15)_40%,transparent_72%)]" />
      <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-200 bg-white text-amber-500 shadow-[0_0_24px_rgba(245,158,11,0.20)]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446A9 9 0 1 1 12 2.992z" />
          <path d="M8.5 14.5l-1 2.5" />
          <path d="M12 12v-3" />
          <path d="M15.5 14.5l1 2.5" />
        </svg>
      </div>
      <div className="absolute left-[18%] top-[34%] h-3 w-3 rounded-full bg-violet-400/80 shadow-[0_0_6px_rgba(124,58,237,0.4)]" />
      <div className="absolute bottom-[18%] right-[14%] h-3.5 w-3.5 rounded-full bg-violet-400/70 shadow-[0_0_14px_rgba(124,58,237,0.35)]" />
      <div className="absolute right-[26%] top-[13%] h-2.5 w-2.5 rounded-full bg-indigo-400/80 shadow-[0_0_10px_rgba(99,102,241,0.45)]" />
      <div className="absolute left-[50%] top-[8%] h-2 w-2 -translate-x-1/2 rounded-full bg-amber-400/70 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
    </div>
  );
}
