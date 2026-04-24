import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  ChartSpline,
  ChevronDown,
  FileText,
  Globe2,
  LifeBuoy,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { Link } from "wouter";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { useI18n } from "@/components/providers/i18n-provider";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "platform", key: "platform" },
  { id: "workflows", key: "workflows" },
  { id: "insights", key: "insights" },
  { id: "security", key: "security" },
] as const;

type NavKey = (typeof navItems)[number]["key"];

interface MarketingMenuLink {
  description: string;
  href: string;
  icon: LucideIcon;
  title: string;
}

function MarketingMenuAction({
  description,
  featured = false,
  href,
  icon: Icon,
  onNavigate,
  title,
}: MarketingMenuLink & {
  featured?: boolean;
  onNavigate: (href: string) => void;
}) {
  const classes = cn(
    "group block rounded-[26px] border p-5 text-left transition hover:-translate-y-[2px]",
    featured
      ? "border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]"
      : "border-white/8 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.05]"
  );

  const content = (
    <>
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-2xl",
          featured
            ? "bg-[linear-gradient(135deg,rgba(232,255,89,0.24),rgba(127,244,210,0.18))] text-[#f1ff9a]"
            : "bg-[linear-gradient(135deg,rgba(108,126,255,0.22),rgba(232,255,89,0.10))] text-white/88"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-marketing mt-5 text-xl font-semibold tracking-[-0.03em] text-white">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-7 text-[#bcc5ee]/68">{description}</p>
    </>
  );

  if (href.startsWith("#")) {
    return (
      <button type="button" onClick={() => onNavigate(href)} className={classes}>
        {content}
      </button>
    );
  }

  return (
    <Link href={href}>
      <a onClick={() => onNavigate(href)} className={classes}>
        {content}
      </a>
    </Link>
  );
}

function PerformanceChart({ labels }: { labels: readonly string[] }) {
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

      {labels.map((label, index) => (
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
  const { messages } = useI18n();
  const copy = messages.landing;
  const [activeMenu, setActiveMenu] = useState<NavKey | null>(null);

  const productCards: Array<{
    assetSrc?: string;
    icon: LucideIcon;
    title: string;
    description: string;
    bullets: readonly string[];
  }> = [
    {
      icon: ShieldCheck,
      assetSrc: "/landing-icons/enterprise-workspace-control.png",
      ...copy.platform.cards[0],
    },
    { icon: Workflow, ...copy.platform.cards[1] },
    { icon: BookOpen, ...copy.platform.cards[2] },
  ];

  const dropdownMenus: Record<
    NavKey,
    {
      description: string;
      eyebrow: string;
      featured: MarketingMenuLink;
      links: MarketingMenuLink[];
      title: string;
    }
  > = {
    platform: {
      eyebrow: copy.menus.platform.eyebrow,
      title: copy.menus.platform.title,
      description: copy.menus.platform.description,
      featured: {
        title: copy.menus.platform.featuredTitle,
        description: copy.menus.platform.featuredDescription,
        href: "#platform",
        icon: ShieldCheck,
      },
      links: [
        {
          title: copy.menus.platform.links[0].title,
          description: copy.menus.platform.links[0].description,
          href: "#security",
          icon: LockKeyhole,
        },
        {
          title: copy.menus.platform.links[1].title,
          description: copy.menus.platform.links[1].description,
          href: "/documentation/trust-center-overview",
          icon: ShieldCheck,
        },
        {
          title: copy.menus.platform.links[2].title,
          description: copy.menus.platform.links[2].description,
          href: "/documentation",
          icon: BookOpen,
        },
      ],
    },
    workflows: {
      eyebrow: copy.menus.workflows.eyebrow,
      title: copy.menus.workflows.title,
      description: copy.menus.workflows.description,
      featured: {
        title: copy.menus.workflows.featuredTitle,
        description: copy.menus.workflows.featuredDescription,
        href: "#workflows",
        icon: Workflow,
      },
      links: [
        {
          title: copy.menus.workflows.links[0].title,
          description: copy.menus.workflows.links[0].description,
          href: "#workflows",
          icon: Workflow,
        },
        {
          title: copy.menus.workflows.links[1].title,
          description: copy.menus.workflows.links[1].description,
          href: "/documentation/workspace-launch-guide",
          icon: FileText,
        },
        {
          title: copy.menus.workflows.links[2].title,
          description: copy.menus.workflows.links[2].description,
          href: "/documentation/support-policy",
          icon: LifeBuoy,
        },
      ],
    },
    insights: {
      eyebrow: copy.menus.insights.eyebrow,
      title: copy.menus.insights.title,
      description: copy.menus.insights.description,
      featured: {
        title: copy.menus.insights.featuredTitle,
        description: copy.menus.insights.featuredDescription,
        href: "#insights",
        icon: ChartSpline,
      },
      links: [
        {
          title: copy.menus.insights.links[0].title,
          description: copy.menus.insights.links[0].description,
          href: "#insights",
          icon: ChartSpline,
        },
        {
          title: copy.menus.insights.links[1].title,
          description: copy.menus.insights.links[1].description,
          href: "/documentation/sla",
          icon: BookOpen,
        },
        {
          title: copy.menus.insights.links[2].title,
          description: copy.menus.insights.links[2].description,
          href: "/documentation/support-policy",
          icon: LifeBuoy,
        },
      ],
    },
    security: {
      eyebrow: copy.menus.security.eyebrow,
      title: copy.menus.security.title,
      description: copy.menus.security.description,
      featured: {
        title: copy.menus.security.featuredTitle,
        description: copy.menus.security.featuredDescription,
        href: "#security",
        icon: ShieldCheck,
      },
      links: [
        {
          title: copy.menus.security.links[0].title,
          description: copy.menus.security.links[0].description,
          href: "#security",
          icon: LockKeyhole,
        },
        {
          title: copy.menus.security.links[1].title,
          description: copy.menus.security.links[1].description,
          href: "/legal",
          icon: FileText,
        },
        {
          title: copy.menus.security.links[2].title,
          description: copy.menus.security.links[2].description,
          href: "/documentation/trust-center-overview",
          icon: BookOpen,
        },
      ],
    },
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      setTimeout(() => {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  };

  const handleMenuNavigate = (href: string) => {
    setActiveMenu(null);

    if (href.startsWith("#")) {
      scrollToSection(href.slice(1));
    }
  };

  const handleNavClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Don't close if clicking inside the dropdown menu
    if (target.closest('[data-nav-dropdown]')) {
      return;
    }
    // Don't close if clicking on nav buttons - they handle their own state
    if (target.closest('[data-nav-button]')) {
      return;
    }
  };

  return (
    <div className="relative overflow-hidden bg-[#05091d] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 overflow-hidden">
          <div className="relative w-[max(1536px,100vw,calc(100vh*1.5))]">
            <img
              src="/images/hero-bg.png"
              alt=""
              aria-hidden="true"
              loading="eager"
              className="block h-auto w-full max-w-none opacity-[0.92]"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,28,88,0.10),transparent_44%),linear-gradient(180deg,rgba(4,8,26,0.04)_0%,rgba(5,9,29,0.18)_24%,rgba(5,9,29,0.64)_78%,#05091d_100%)]" />
          </div>
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,9,29,0.04)_0%,rgba(5,9,29,0.06)_22%,rgba(5,9,29,0.18)_44%,rgba(5,9,29,0.42)_64%,#05091d_86%)]" />
        <div className="animate-drift-x absolute left-[-10rem] top-[8rem] h-80 w-80 rounded-full bg-[#5771ff]/16 blur-[110px]" />
        <div className="animate-pulse-halo absolute bottom-[-6rem] right-[-5rem] h-96 w-96 rounded-full bg-[#d5ff63]/12 blur-[130px]" />
        <div className="marketing-grid absolute inset-x-0 bottom-0 h-[36rem] opacity-50" />
      </div>

      <main className="relative z-10">
        <section className="px-4 pb-16 pt-6 md:px-8 md:pb-24">
          <div className="mx-auto max-w-7xl">
            <div
              className="relative"
              onClick={handleNavClick}
              onTouchEnd={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('[data-nav-dropdown]')) {
                  return;
                }
                if (target.closest('[data-nav-button]')) {
                  return;
                }
              }}
            >
              <nav
                className="glass-panel luminous-border flex items-center justify-between rounded-full px-5 py-4 md:px-7"
                data-nav-item
                onMouseLeave={() => activeMenu && setActiveMenu(null)}
              >
                <BrandLockup compact />

                <div className="hidden items-center gap-8 lg:flex">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActiveMenu(item.key)}
                      onFocus={() => setActiveMenu(item.key)}
                      onClick={() =>
                        setActiveMenu((current) => (current === item.key ? null : item.key))
                      }
                      className="font-marketing text-sm font-medium text-white/78 transition hover:text-white"
                      data-nav-button
                    >
                      {copy.nav[item.key]}
                      <ChevronDown
                        className={cn(
                          "ml-1 inline h-4 w-4 text-white/55 transition",
                          activeMenu === item.key && "rotate-180 text-white"
                        )}
                      />
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 md:gap-4">
                  <LanguageSwitcher variant="marketing" />
                  <Link href="/documentation">
                    <a className="font-marketing hidden text-sm font-medium text-white/78 transition hover:text-white md:inline-flex">
                      {copy.nav.documentation}
                    </a>
                  </Link>
                  <Link href="/login">
                    <a className="font-marketing text-sm font-medium text-white/78 transition hover:text-white">
                      {copy.nav.logIn}
                    </a>
                  </Link>
                  <Link href="/login">
                    <a className="glow-button font-marketing inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[linear-gradient(90deg,#efff53_0%,#dfff4a_55%,#7ff4d2_100%)] px-3 py-2 text-xs font-semibold text-[#071126] transition hover:translate-y-[-1px] sm:gap-2 sm:px-4 sm:py-3 sm:text-sm md:px-6">
                      {copy.nav.getStarted}
                      <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                    </a>
                  </Link>
                </div>
              </nav>

              {activeMenu && (
                <div
                  className="absolute inset-x-0 top-full z-20 pt-4 pointer-events-auto"
                  data-nav-dropdown
                  onMouseLeave={() => setActiveMenu(null)}
                >
                  <div className="glass-panel luminous-border grid gap-6 rounded-[32px] p-6 lg:grid-cols-[1.05fr_1.25fr]">
                    <div className="space-y-4">
                      <p className="font-marketing text-xs font-semibold uppercase tracking-[0.34em] text-[#dfff4a]/72">
                        {dropdownMenus[activeMenu].eyebrow}
                      </p>
                      <h2 className="font-marketing text-3xl font-semibold tracking-[-0.04em] text-white">
                        {dropdownMenus[activeMenu].title}
                      </h2>
                      <p className="max-w-lg text-sm leading-7 text-[#bcc5ee]/70">
                        {dropdownMenus[activeMenu].description}
                      </p>

                      <div className="space-y-3">
                        <p className="font-marketing text-xs font-semibold uppercase tracking-[0.28em] text-white/42">
                          {
                            copy.menus[activeMenu].featuredLabel
                          }
                        </p>
                        <MarketingMenuAction
                          {...dropdownMenus[activeMenu].featured}
                          featured
                          onNavigate={handleMenuNavigate}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      {dropdownMenus[activeMenu].links.map((item) => (
                        <MarketingMenuAction
                          key={`${activeMenu}-${item.title}`}
                          {...item}
                          onNavigate={handleMenuNavigate}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mx-auto max-w-4xl pt-16 text-center md:pt-20">
              <div className="glass-panel-soft inline-flex items-center gap-3 rounded-full px-5 py-2.5 text-sm text-white/84">
                <span className="h-2.5 w-2.5 rounded-full bg-[#dfff4a] shadow-[0_0_14px_rgba(223,255,74,0.85)]" />
                {copy.intro}
              </div>

              <h1 className="font-marketing mt-8 text-5xl font-extrabold leading-[0.96] tracking-[-0.05em] text-white sm:text-6xl md:text-[6.8rem]">
                {copy.title[0]}
                <br />
                {copy.title[1]}
              </h1>

              <p
                className="soft-glow mt-5 text-[2.8rem] font-medium leading-[0.95] tracking-[-0.045em] text-[#e7ff5a] sm:text-[3.25rem] md:text-[4.1rem]"
                style={{
                  fontFamily:
                    'SF Pro Display, SF Pro Text, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
              >
                {copy.subtitle}
              </p>

              <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-[#c9d0f5]/78 md:text-xl">
                {copy.description}
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/login">
                  <a className="glow-button font-marketing inline-flex items-center gap-2 rounded-full bg-[linear-gradient(90deg,#efff53_0%,#ddff47_55%,#78efd0_100%)] px-8 py-4 text-base font-bold text-[#071126] transition hover:translate-y-[-1px]">
                    {copy.primaryCta}
                    <ArrowRight className="h-5 w-5" />
                  </a>
                </Link>
                <button
                  type="button"
                  onClick={() => scrollToSection("platform")}
                  className="font-marketing inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-6 py-4 text-sm font-semibold text-white/84 transition hover:border-white/20 hover:bg-white/[0.07]"
                >
                  {copy.secondaryCta}
                </button>
              </div>

              <p className="mt-5 text-sm text-[#c9d0f5]/52">
                {copy.note}
              </p>
            </div>

            <div className="mt-16 grid gap-6 xl:grid-cols-[0.95fr_1.7fr_0.95fr]">
              <article className="glass-panel rounded-[30px] p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(114,137,255,0.34),rgba(84,101,255,0.18))] p-2 text-[#dfe6ff]">
                  <img
                    src="/landing-icons/world.png"
                    alt=""
                    className="h-full w-full object-contain"
                    aria-hidden="true"
                  />
                </div>
                <h2 className="font-marketing mt-6 text-2xl font-semibold tracking-[-0.03em]">
                  {copy.overview.inbox.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#b9c1e8]/72">
                  {copy.overview.inbox.description}
                </p>

                <div className="mt-8 space-y-3">
                  {copy.overview.inbox.signals.map((signal) => (
                    <div
                      key={signal.label}
                      className="glass-panel-soft grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-2xl px-4 py-3"
                    >
                      <span className="min-w-0 flex-1 font-marketing text-sm font-semibold text-white/88">
                        {signal.label}
                      </span>
                      <span className="max-w-[8.75rem] whitespace-normal text-right text-[0.68rem] uppercase leading-[1.35] tracking-[0.12em] text-[#dfff4a]/74">
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
                  {copy.overview.inbox.footer}
                </div>
              </article>

              <article className="glass-panel rounded-[34px] px-6 py-7 md:px-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(98,118,255,0.34),rgba(82,97,241,0.16))] p-2 text-[#dfe6ff]">
                        <img
                          src="/landing-icons/performance.png"
                          alt=""
                          className="h-full w-full object-contain"
                          aria-hidden="true"
                        />
                      </div>
                      <div>
                        <h2 className="font-marketing text-2xl font-semibold tracking-[-0.03em]">
                          {copy.overview.performance.title}
                        </h2>
                        <p className="text-sm text-[#bcc5ee]/64">
                          {copy.overview.performance.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-8">
                      <p className="text-sm uppercase tracking-[0.25em] text-[#aeb6df]/42">
                        {copy.overview.performance.metricLabel}
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
                    {copy.overview.performance.timeframe}
                </div>
              </div>

                <div className="mt-8 h-[18rem] w-full rounded-[28px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-3">
                  <PerformanceChart labels={copy.overview.performance.chartDays} />
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  {copy.overview.performance.stats.map(({ label, value }) => (
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
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(233,255,93,0.28),rgba(121,244,211,0.16))] p-2 text-[#f4ffb1]">
                  <img
                    src="/landing-icons/Smart-automations.png"
                    alt=""
                    className="h-full w-full object-contain"
                    aria-hidden="true"
                  />
                </div>
                <h2 className="font-marketing mt-6 text-2xl font-semibold tracking-[-0.03em]">
                  {copy.overview.automations.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#b9c1e8]/72">
                  {copy.overview.automations.description}
                </p>

                <OrbitGraphic />

                <div className="glass-panel-soft mt-3 rounded-2xl px-4 py-4">
                  <div className="flex items-center justify-between">
                    <span className="font-marketing text-sm font-semibold text-white/84">
                      {copy.overview.automations.statusLabel}
                    </span>
                    <span className="flex items-center gap-2 text-sm text-[#dfff4a]">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#dfff4a] shadow-[0_0_12px_rgba(223,255,74,0.8)]" />
                      {copy.overview.automations.statusValue}
                    </span>
                  </div>
                </div>
              </article>
            </div>

            <div className="mt-16 border-t border-white/10 pt-10">
              <p className="text-center text-xs font-semibold uppercase tracking-[0.4em] text-[#95a0cc]/44">
                {copy.trustTitle}
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-5 text-lg font-semibold text-white/42">
                {copy.trustSignals.map((signal) => (
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
                {copy.platform.eyebrow}
              </p>
              <h2 className="font-marketing mt-5 text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">
                {copy.platform.title}
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[#c9d0f5]/70 md:text-lg">
                {copy.platform.description}
              </p>
            </div>

            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              {productCards.map((card) => {
                const Icon = card.icon;
                return (
                  <article key={card.title} className="glass-panel rounded-[28px] p-7">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(108,126,255,0.28),rgba(232,255,89,0.12))] p-2 text-white/90">
                      {card.assetSrc ? (
                        <img
                          src={card.assetSrc}
                          alt=""
                          className="h-full w-full object-contain"
                          aria-hidden="true"
                        />
                      ) : (
                        <Icon className="h-6 w-6" />
                      )}
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
                {copy.workflows.eyebrow}
              </p>
              <h2 className="font-marketing mt-5 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
                {copy.workflows.title}
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[#c9d0f5]/70">
                {copy.workflows.description}
              </p>

              <div className="mt-10 grid gap-5 md:grid-cols-2">
                {[
                  { icon: Workflow, ...copy.workflows.features[0] },
                  { icon: Sparkles, ...copy.workflows.features[1] },
                  { icon: ChartSpline, ...copy.workflows.features[2] },
                  { icon: Globe2, ...copy.workflows.features[3] },
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
                      {copy.workflows.flowTitle}
                    </p>
                    <h3 className="font-marketing mt-3 text-2xl font-semibold tracking-[-0.03em]">
                      {copy.workflows.flowHeadline}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-[#dfff4a]/28 bg-[#dfff4a]/10 px-3 py-1.5 text-sm text-[#dfff4a]">
                    <span className="h-2 w-2 rounded-full bg-[#dfff4a]" />
                    {copy.workflows.flowLive}
                  </div>
                </div>

                <div className="mt-8 space-y-4">
                  {copy.workflows.flowSteps.map(([title, detail], index) => (
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
                {copy.workflows.metrics.map(([label, value, detail]) => (
                  <div key={label} className="glass-panel-soft rounded-[24px] p-5">
                    <p className="font-marketing text-sm font-semibold uppercase tracking-[0.26em] text-[#aeb6df]/44">
                      {label}
                    </p>
                    <p className="font-marketing mt-3 text-3xl font-semibold tracking-[-0.04em] text-white/92">
                      {value}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-[#bcc5ee]/66">
                      {detail}
                    </p>
                  </div>
                ))}
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
                    {copy.insights.eyebrow}
                  </p>
                  <h2 className="font-marketing mt-5 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
                    {copy.insights.title}
                  </h2>
                  <p className="mt-6 max-w-2xl text-base leading-8 text-[#c9d0f5]/70">
                    {copy.insights.description}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {copy.insights.stats.map(([value, label]) => (
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
                {copy.security.eyebrow}
              </p>
              <h2 className="font-marketing mt-5 text-4xl font-semibold tracking-[-0.04em] text-white md:text-5xl">
                {copy.security.title}
              </h2>
              <p className="mt-6 text-base leading-8 text-[#c9d0f5]/70">
                {copy.security.description}
              </p>
            </div>

            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {copy.security.cards.map((item) => (
                <article key={item.title} className="glass-panel rounded-[28px] p-7">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(232,255,89,0.18),rgba(116,244,212,0.15))] p-2 text-[#eaff9d]">
                    <img
                      src="/landing-icons/security.png"
                      alt=""
                      className="h-full w-full object-contain"
                      aria-hidden="true"
                    />
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

            <div className="relative mt-12 overflow-hidden rounded-[34px] border border-[#2f3f93]/55 bg-[#060b21] px-8 py-10 text-center shadow-[0_28px_90px_rgba(4,8,28,0.4)] md:px-12 md:py-14">
              <img
                src="/landing-icons/readytolunch.png"
                alt=""
                className="absolute left-1/2 top-1/2 h-[124%] w-[124%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover object-center opacity-[0.98] [filter:brightness(1.2)_saturate(1.14)_contrast(1.06)]"
                aria-hidden="true"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(6, 11, 33, 0.08) 0%, rgba(6, 11, 33, 0.18) 55%, rgba(6, 11, 33, 0.34) 100%)",
                }}
              />
              <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(223,255,74,0.08),transparent_68%)]" />
              <div className="relative z-10 mx-auto max-w-4xl [text-shadow:0_2px_18px_rgba(4,8,28,0.55)]">
                <p className="font-marketing text-sm font-semibold uppercase tracking-[0.36em] text-[#dfff4a]/72">
                  {copy.security.ctaEyebrow}
                </p>
                <h2 className="font-marketing mt-5 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
                  {copy.security.ctaTitle}
                </h2>
                <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[#d4daf8]/84">
                  {copy.security.ctaDescription}
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Link href="/login">
                    <a className="glow-button font-marketing inline-flex items-center gap-2 rounded-full bg-[linear-gradient(90deg,#efff53_0%,#ddff47_55%,#78efd0_100%)] px-8 py-4 text-base font-bold text-[#071126] transition hover:translate-y-[-1px]">
                      {copy.security.ctaPrimary}
                      <ArrowRight className="h-5 w-5" />
                    </a>
                  </Link>
                  <button
                    type="button"
                    onClick={() => scrollToSection("platform")}
                    className="font-marketing rounded-full border border-white/12 bg-white/[0.04] px-6 py-4 text-sm font-semibold text-white/84 transition hover:border-white/20 hover:bg-white/[0.07]"
                  >
                    {copy.security.ctaSecondary}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
