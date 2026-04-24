import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BrainCircuit,
  ChartSpline,
  ChevronDown,
  Globe2,
  MessageSquareText,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { Link } from "wouter";
import { BrandLockup } from "@/components/marketing/brand-lockup";

const navItems = [
  { label: "Platform", id: "platform" },
  { label: "Workflows", id: "workflows" },
  { label: "Insights", id: "insights" },
  { label: "Security", id: "security" },
];

const workflowSignals = [
  { label: "WhatsApp", value: "Always on" },
  { label: "Email", value: "Unified queue" },
  { label: "Invoices", value: "Faster collection" },
  { label: "Pipeline", value: "Shared visibility" },
];

const productCards: Array<{
  icon: LucideIcon;
  title: string;
  description: string;
  bullets: string[];
}> = [
  {
    icon: MessageSquareText,
    title: "Conversations that stay organized",
    description:
      "Bring channels into one workspace so your team always sees context, owner, and next action.",
    bullets: [
      "Centralize WhatsApp, email, and internal notes",
      "Assign conversations without losing accountability",
      "Surface urgent customers before they slip",
    ],
  },
  {
    icon: ReceiptText,
    title: "Billing that keeps momentum",
    description:
      "Send invoices, follow payment status, and keep financial operations aligned with the sales team.",
    bullets: [
      "Issue invoices from the same operational flow",
      "Track approvals, documents, and payment reminders",
      "Support local compliance-heavy processes with clarity",
    ],
  },
  {
    icon: Workflow,
    title: "Pipeline visibility your team can use",
    description:
      "See deal movement, stalled opportunities, and activity trends without stitching multiple tools together.",
    bullets: [
      "Watch stage movement in real time",
      "Coordinate follow-ups across sales and ops",
      "Measure throughput with live dashboards",
    ],
  },
];

const trustSignals = [
  "WhatsApp",
  "Email",
  "Documents",
  "Invoices",
  "Pipeline",
  "Automations",
];

function PerformanceChart() {
  return (
    <svg viewBox="0 0 460 260" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="request-line" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#dfff4a" />
          <stop offset="100%" stopColor="#f5ff9b" />
        </linearGradient>
        <linearGradient id="request-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(222,255,74,0.40)" />
          <stop offset="100%" stopColor="rgba(222,255,74,0.02)" />
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
          stroke="rgba(124, 139, 255, 0.14)"
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
          stroke="rgba(124, 139, 255, 0.12)"
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

      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, index) => (
        <text
          key={label}
          x={48 + index * 74}
          y="242"
          fill="rgba(208,216,255,0.58)"
          fontSize="12"
          fontFamily="Manrope, sans-serif"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

function OrbitGraphic() {
  return (
    <div className="relative mx-auto mt-8 h-56 w-56">
      <div className="absolute inset-0 rounded-full border border-[#5f72ff]/30" />
      <div className="absolute inset-5 rounded-full border border-[#5f72ff]/25" />
      <div className="absolute inset-11 rounded-full border border-[#5f72ff]/20" />
      <div className="absolute inset-[4.65rem] rounded-full border border-[#5f72ff]/15" />
      <div className="animate-pulse-halo absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(233,255,93,0.95)_0%,rgba(232,255,89,0.2)_40%,transparent_72%)]" />
      <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#e8ff59]/35 bg-[#10173a]/90 text-[#e8ff59] shadow-[0_0_32px_rgba(232,255,89,0.35)]">
        <Sparkles className="h-6 w-6" />
      </div>
      <div className="absolute left-[18%] top-[34%] h-3 w-3 rounded-full bg-[#5c72ff]/80 shadow-[0_0_16px_rgba(92,114,255,0.65)]" />
      <div className="absolute bottom-[18%] right-[14%] h-3.5 w-3.5 rounded-full bg-[#5c72ff]/70 shadow-[0_0_18px_rgba(92,114,255,0.55)]" />
      <div className="absolute right-[26%] top-[13%] h-2.5 w-2.5 rounded-full bg-[#9db0ff]/90 shadow-[0_0_14px_rgba(157,176,255,0.7)]" />
      <div className="absolute left-[50%] top-[8%] h-2 w-2 -translate-x-1/2 rounded-full bg-[#e8ff59]/70 shadow-[0_0_14px_rgba(232,255,89,0.7)]" />
    </div>
  );
}

export default function Landing() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="relative overflow-hidden bg-[#05091d] text-white">
      <div className="pointer-events-none absolute inset-0">
        <img
          src="/images/hero-bg.png"
          alt=""
          aria-hidden="true"
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-[0.82]"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,28,88,0.16),transparent_42%),linear-gradient(180deg,rgba(4,8,26,0.08)_0%,rgba(5,9,29,0.34)_30%,#05091d_100%)]" />
        <div className="animate-drift-x absolute left-[-10rem] top-[8rem] h-80 w-80 rounded-full bg-[#5771ff]/16 blur-[110px]" />
        <div className="animate-pulse-halo absolute bottom-[-6rem] right-[-5rem] h-96 w-96 rounded-full bg-[#d5ff63]/12 blur-[130px]" />
        <div className="marketing-grid absolute inset-x-0 bottom-0 h-[36rem] opacity-50" />
      </div>

      <main className="relative z-10">
        <section className="px-4 pb-16 pt-6 md:px-8 md:pb-24">
          <div className="mx-auto max-w-7xl">
            <nav className="glass-panel luminous-border flex items-center justify-between rounded-full px-5 py-4 md:px-7">
              <BrandLockup compact />

              <div className="hidden items-center gap-8 lg:flex">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    className="font-marketing text-sm font-medium text-white/78 transition hover:text-white"
                  >
                    {item.label}
                    {(item.label === "Platform" || item.label === "Insights") && (
                      <ChevronDown className="ml-1 inline h-4 w-4 text-white/55" />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 md:gap-4">
                <Link href="/login">
                  <a className="font-marketing text-sm font-medium text-white/78 transition hover:text-white">
                    Log in
                  </a>
                </Link>
                <Link href="/login">
                  <a className="glow-button font-marketing inline-flex items-center gap-2 rounded-full bg-[linear-gradient(90deg,#efff53_0%,#dfff4a_55%,#7ff4d2_100%)] px-4 py-3 text-sm font-semibold text-[#071126] transition hover:translate-y-[-1px] md:px-6">
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Link>
              </div>
            </nav>

            <div className="mx-auto max-w-4xl pt-16 text-center md:pt-20">
              <div className="glass-panel-soft inline-flex items-center gap-3 rounded-full px-5 py-2.5 text-sm text-white/84">
                <span className="h-2.5 w-2.5 rounded-full bg-[#dfff4a] shadow-[0_0_14px_rgba(223,255,74,0.85)]" />
                Introducing smarter customer operations for growing teams
              </div>

              <h1 className="font-marketing mt-8 text-5xl font-extrabold leading-[0.96] tracking-[-0.05em] text-white sm:text-6xl md:text-[6.8rem]">
                Customer operations
                <br />
                that keep moving.
              </h1>

              <p className="font-editorial soft-glow mt-4 text-[3rem] font-semibold italic leading-none text-[#e7ff5a] sm:text-[3.6rem] md:text-[4.65rem]">
                Clarity that converts.
              </p>

              <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-[#c9d0f5]/78 md:text-xl">
                PymeHub brings conversations, invoicing, workflows, and pipeline visibility into one operating system so your team can respond faster, follow through, and grow with confidence.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/login">
                  <a className="glow-button font-marketing inline-flex items-center gap-2 rounded-full bg-[linear-gradient(90deg,#efff53_0%,#ddff47_55%,#78efd0_100%)] px-8 py-4 text-base font-bold text-[#071126] transition hover:translate-y-[-1px]">
                    Start Free Today
                    <ArrowRight className="h-5 w-5" />
                  </a>
                </Link>
                <button
                  type="button"
                  onClick={() => scrollToSection("platform")}
                  className="font-marketing inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-6 py-4 text-sm font-semibold text-white/84 transition hover:border-white/20 hover:bg-white/[0.07]"
                >
                  Explore the platform
                </button>
              </div>

              <p className="mt-5 text-sm text-[#c9d0f5]/52">
                No credit card required. Launch your workspace in minutes.
              </p>
            </div>

            <div className="mt-16 grid gap-6 xl:grid-cols-[0.95fr_1.7fr_0.95fr]">
              <article className="glass-panel animate-float-y rounded-[30px] p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(114,137,255,0.34),rgba(84,101,255,0.18))] text-[#dfe6ff]">
                  <Globe2 className="h-6 w-6" />
                </div>
                <h2 className="font-marketing mt-6 text-2xl font-semibold tracking-[-0.03em]">
                  Omnichannel inbox
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#b9c1e8]/72">
                  Route every conversation through the same workspace so your team knows what happened, who owns it, and what should happen next.
                </p>

                <div className="mt-8 space-y-3">
                  {workflowSignals.map((signal) => (
                    <div
                      key={signal.label}
                      className="glass-panel-soft flex items-center justify-between rounded-2xl px-4 py-3"
                    >
                      <span className="font-marketing text-sm font-semibold text-white/88">
                        {signal.label}
                      </span>
                      <span className="text-xs uppercase tracking-[0.18em] text-[#dfff4a]/74">
                        {signal.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-8 grid grid-cols-7 gap-2">
                  {Array.from({ length: 28 }, (_, index) => {
                    const active = [1, 4, 8, 12, 17, 18, 23, 25, 27].includes(index);
                    return (
                      <span
                        key={index}
                        className={`h-2.5 w-2.5 rounded-full ${
                          active
                            ? "bg-[#dfff4a] shadow-[0_0_18px_rgba(223,255,74,0.7)]"
                            : "bg-[#6b7dff]/28"
                        }`}
                      />
                    );
                  })}
                </div>

                <div className="glass-panel-soft mt-8 rounded-full px-4 py-3 text-sm text-white/70">
                  Avg. first response under 6 minutes
                </div>
              </article>

              <article className="glass-panel rounded-[34px] px-6 py-7 md:px-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(98,118,255,0.34),rgba(82,97,241,0.16))] text-[#dfe6ff]">
                        <ChartSpline className="h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="font-marketing text-2xl font-semibold tracking-[-0.03em]">
                          Performance overview
                        </h2>
                        <p className="text-sm text-[#bcc5ee]/64">
                          One view for activity, revenue movement, and team momentum
                        </p>
                      </div>
                    </div>

                    <div className="mt-8">
                      <p className="text-sm uppercase tracking-[0.25em] text-[#aeb6df]/42">
                        Total conversations handled
                      </p>
                      <div className="mt-2 flex items-end gap-3">
                        <span className="font-marketing text-5xl font-semibold tracking-[-0.04em]">
                          2.45M
                        </span>
                        <span className="rounded-full border border-[#dfff4a]/30 bg-[#dfff4a]/10 px-3 py-1 text-sm font-semibold text-[#dfff4a]">
                          +18.6%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel-soft rounded-2xl px-4 py-3 text-sm text-white/72">
                    Last 7 days
                  </div>
                </div>

                <div className="mt-8 h-[18rem] w-full rounded-[28px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-3">
                  <PerformanceChart />
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  {[
                    ["Response SLA", "94%"],
                    ["Invoices sent", "1.2K"],
                    ["Pipeline velocity", "Fast"],
                  ].map(([label, value]) => (
                    <div key={label} className="glass-panel-soft rounded-2xl px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-[#aeb6df]/42">
                        {label}
                      </p>
                      <p className="font-marketing mt-2 text-2xl font-semibold tracking-[-0.03em] text-white/90">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="glass-panel rounded-[30px] p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(233,255,93,0.28),rgba(121,244,211,0.16))] text-[#f4ffb1]">
                  <BrainCircuit className="h-6 w-6" />
                </div>
                <h2 className="font-marketing mt-6 text-2xl font-semibold tracking-[-0.03em]">
                  Smart automations
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#b9c1e8]/72">
                  Trigger reminders, handoffs, and follow-ups based on the live state of your workspace instead of manual checklists.
                </p>

                <OrbitGraphic />

                <div className="glass-panel-soft mt-3 rounded-2xl px-4 py-4">
                  <div className="flex items-center justify-between">
                    <span className="font-marketing text-sm font-semibold text-white/84">
                      Optimization status
                    </span>
                    <span className="flex items-center gap-2 text-sm text-[#dfff4a]">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#dfff4a] shadow-[0_0_12px_rgba(223,255,74,0.8)]" />
                      Active
                    </span>
                  </div>
                </div>
              </article>
            </div>

            <div className="mt-16 border-t border-white/10 pt-10">
              <p className="text-center text-xs font-semibold uppercase tracking-[0.4em] text-[#95a0cc]/44">
                Trusted across customer, finance, and operations workflows
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-5 text-lg font-semibold text-white/42">
                {trustSignals.map((signal) => (
                  <span key={signal} className="font-marketing tracking-[-0.02em]">
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="platform" className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="font-marketing text-sm font-semibold uppercase tracking-[0.36em] text-[#dfff4a]/72">
                Platform
              </p>
              <h2 className="font-marketing mt-5 text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">
                Built for the whole customer journey, not just one slice of it.
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[#c9d0f5]/70 md:text-lg">
                Sales, service, billing, and follow-through all live in one calm workspace. That means fewer blind spots and faster handoffs between teams.
              </p>
            </div>

            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              {productCards.map((card) => {
                const Icon = card.icon;
                return (
                  <article key={card.title} className="glass-panel rounded-[28px] p-7">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(108,126,255,0.28),rgba(232,255,89,0.12))] text-white/90">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-marketing mt-7 text-2xl font-semibold tracking-[-0.03em]">
                      {card.title}
                    </h3>
                    <p className="mt-4 text-sm leading-7 text-[#bcc5ee]/72">
                      {card.description}
                    </p>
                    <ul className="mt-8 space-y-3 text-sm leading-7 text-white/78">
                      {card.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-3">
                          <span className="mt-2 h-2.5 w-2.5 rounded-full bg-[#dfff4a] shadow-[0_0_14px_rgba(223,255,74,0.65)]" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="workflows" className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.08fr_0.92fr]">
            <article className="glass-panel rounded-[34px] p-8 md:p-10">
              <p className="font-marketing text-sm font-semibold uppercase tracking-[0.36em] text-[#dfff4a]/72">
                Workflows
              </p>
              <h2 className="font-marketing mt-5 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
                A workspace that mirrors how your team already works.
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[#c9d0f5]/70">
                Instead of bouncing between inboxes, spreadsheets, invoicing tools, and follow-up lists, PymeHub keeps the operational thread intact from the first message to final payment.
              </p>

              <div className="mt-10 grid gap-5 md:grid-cols-2">
                {[
                  {
                    icon: Workflow,
                    title: "Shared handoffs",
                    body: "Assign, escalate, or reopen work without losing the original customer context.",
                  },
                  {
                    icon: Sparkles,
                    title: "Smarter follow-ups",
                    body: "Surface stalled deals and overdue replies before they become revenue leaks.",
                  },
                  {
                    icon: ChartSpline,
                    title: "Live team pulse",
                    body: "See what is moving, what is blocked, and which metrics need attention this week.",
                  },
                  {
                    icon: Globe2,
                    title: "Regional-ready operations",
                    body: "Stay ready for compliance-heavy, multi-channel work common across Latin American teams.",
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="glass-panel-soft rounded-[24px] p-5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06] text-[#e3e8ff]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="font-marketing mt-5 text-xl font-semibold tracking-[-0.03em]">
                        {item.title}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-[#bcc5ee]/68">
                        {item.body}
                      </p>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="glass-panel rounded-[34px] p-6 md:p-8">
              <div className="glass-panel-soft rounded-[26px] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-marketing text-sm font-semibold uppercase tracking-[0.3em] text-[#aeb6df]/52">
                      Workspace flow
                    </p>
                    <h3 className="font-marketing mt-3 text-2xl font-semibold tracking-[-0.03em]">
                      From conversation to collection
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-[#dfff4a]/28 bg-[#dfff4a]/10 px-3 py-1.5 text-sm text-[#dfff4a]">
                    <span className="h-2 w-2 rounded-full bg-[#dfff4a]" />
                    Live
                  </div>
                </div>

                <div className="mt-8 space-y-4">
                  {[
                    ["New inquiry", "WhatsApp assigned to Andrea"],
                    ["Qualified lead", "Proposal sent and reminder scheduled"],
                    ["Invoice issued", "Payment follow-up set for Friday"],
                    ["Won account", "Operations onboarding activated"],
                  ].map(([title, detail], index) => (
                    <div key={title} className="flex gap-4 rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4">
                      <div className="flex flex-col items-center">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#efff53,#7ff4d2)] text-sm font-bold text-[#051127]">
                          {index + 1}
                        </span>
                        {index < 3 && <span className="mt-2 h-8 w-px bg-white/10" />}
                      </div>
                      <div>
                        <p className="font-marketing text-base font-semibold text-white/90">
                          {title}
                        </p>
                        <p className="mt-1 text-sm leading-7 text-[#bcc5ee]/66">
                          {detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="glass-panel-soft rounded-[24px] p-5">
                  <p className="font-marketing text-sm font-semibold uppercase tracking-[0.26em] text-[#aeb6df]/44">
                    Inbox health
                  </p>
                  <p className="font-marketing mt-3 text-3xl font-semibold tracking-[-0.04em] text-white/92">
                    91%
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[#bcc5ee]/66">
                    of customer threads have an owner, next step, and due date.
                  </p>
                </div>
                <div className="glass-panel-soft rounded-[24px] p-5">
                  <p className="font-marketing text-sm font-semibold uppercase tracking-[0.26em] text-[#aeb6df]/44">
                    Team signal
                  </p>
                  <p className="font-marketing mt-3 text-3xl font-semibold tracking-[-0.04em] text-white/92">
                    4.7x
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[#bcc5ee]/66">
                    more clarity on what is stalled, overdue, or ready to close.
                  </p>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section id="insights" className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="glass-panel rounded-[34px] px-8 py-10 md:px-12 md:py-14">
              <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
                <div>
                  <p className="font-marketing text-sm font-semibold uppercase tracking-[0.36em] text-[#dfff4a]/72">
                    Insights
                  </p>
                  <h2 className="font-marketing mt-5 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
                    Know where momentum is building and where it is leaking.
                  </h2>
                  <p className="mt-6 max-w-2xl text-base leading-8 text-[#c9d0f5]/70">
                    PymeHub highlights reply speed, invoice progress, and pipeline health in one place so leaders can act before slowdowns show up in revenue.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    ["14 min", "median first reply"],
                    ["82%", "invoice follow-through"],
                    ["3.2x", "faster team handoff"],
                    ["99.9%", "workspace availability"],
                  ].map(([value, label]) => (
                    <div key={label} className="glass-panel-soft rounded-[24px] p-5">
                      <p className="font-marketing text-3xl font-semibold tracking-[-0.04em] text-white">
                        {value}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[#bcc5ee]/64">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="security" className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="font-marketing text-sm font-semibold uppercase tracking-[0.36em] text-[#dfff4a]/72">
                Security
              </p>
              <h2 className="font-marketing mt-5 text-4xl font-semibold tracking-[-0.04em] text-white md:text-5xl">
                Operational confidence at every layer.
              </h2>
              <p className="mt-6 text-base leading-8 text-[#c9d0f5]/70">
                Keep workspace access structured, audit activity when needed, and give teams a surface they can rely on day after day.
              </p>
            </div>

            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {[
                {
                  title: "Workspace permissions",
                  body: "Separate responsibilities across teams while keeping a single shared source of truth.",
                },
                {
                  title: "Traceable activity",
                  body: "See how conversations, billing, and operational tasks evolve across the lifecycle.",
                },
                {
                  title: "Always-on experience",
                  body: "Fast, stable surfaces for the daily work your revenue engine depends on.",
                },
              ].map((item) => (
                <article key={item.title} className="glass-panel rounded-[28px] p-7">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(232,255,89,0.18),rgba(116,244,212,0.15))] text-[#eaff9d]">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h3 className="font-marketing mt-6 text-2xl font-semibold tracking-[-0.03em]">
                    {item.title}
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-[#bcc5ee]/70">
                    {item.body}
                  </p>
                </article>
              ))}
            </div>

            <div className="glass-panel mt-12 rounded-[34px] px-8 py-10 text-center md:px-12 md:py-14">
              <p className="font-marketing text-sm font-semibold uppercase tracking-[0.36em] text-[#dfff4a]/72">
                Ready to launch
              </p>
              <h2 className="font-marketing mt-5 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
                Start with the same workspace your team will actually use.
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[#c9d0f5]/70">
                Make the first click feel confident, give your team a single operating rhythm, and move from customer message to paid invoice without patching tools together.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/login">
                  <a className="glow-button font-marketing inline-flex items-center gap-2 rounded-full bg-[linear-gradient(90deg,#efff53_0%,#ddff47_55%,#78efd0_100%)] px-8 py-4 text-base font-bold text-[#071126] transition hover:translate-y-[-1px]">
                    Open your workspace
                    <ArrowRight className="h-5 w-5" />
                  </a>
                </Link>
                <button
                  type="button"
                  onClick={() => scrollToSection("platform")}
                  className="font-marketing rounded-full border border-white/12 bg-white/[0.04] px-6 py-4 text-sm font-semibold text-white/84 transition hover:border-white/20 hover:bg-white/[0.07]"
                >
                  Review the platform
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
