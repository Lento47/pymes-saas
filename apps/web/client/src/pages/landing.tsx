import { useState, useEffect, useRef } from "react";
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
  Menu,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { Footer } from "@/components/marketing/footer";
import { LandingHubby } from "@/components/shared/landing-hubby";
import { useI18n } from "@/components/providers/i18n-provider";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { cn } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

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
    "group block rounded-xl px-4 py-3 text-left transition-all duration-200",
    featured
      ? "bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06]"
      : "hover:bg-white/[0.04]"
  );

  const content = (
    <>
      <div className="flex items-start gap-3">
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
          featured
            ? "bg-[#dfff4a]/10 text-[#dfff4a]"
            : "bg-white/[0.06] text-white/50 group-hover:text-white/80"
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="font-marketing text-sm font-semibold tracking-[-0.01em] text-white group-hover:text-white/90">
            {title}
          </h3>
          <p className="mt-0.5 text-xs leading-5 text-white/40">{description}</p>
        </div>
      </div>
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
      <div className="absolute left-[18%] top-[34%] h-3 w-3 rounded-full bg-[#5c72ff]/80 shadow-[0_0_6px_rgba(92,114,255,0.65)]" />
      <div className="absolute bottom-[18%] right-[14%] h-3.5 w-3.5 rounded-full bg-[#5c72ff]/70 shadow-[0_0_18px_rgba(92,114,255,0.55)]" />
      <div className="absolute right-[26%] top-[13%] h-2.5 w-2.5 rounded-full bg-[#9db0ff]/90 shadow-[0_0_14px_rgba(157,176,255,0.7)]" />
      <div className="absolute left-[50%] top-[8%] h-2 w-2 -translate-x-1/2 rounded-full bg-[#e8ff59]/70 shadow-[0_0_14px_rgba(232,255,89,0.7)]" />
    </div>
  );
}

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add("visible"); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

export default function Landing() {
  const { messages } = useI18n();
  const copy = messages.landing;
  const [activeMenu, setActiveMenu] = useState<NavKey | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const revealCards = useReveal();
  const revealTrust = useReveal();
  const revealMockup = useReveal();

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

  const handleMenuNavigate = (href: string) => {
    setActiveMenu(null);
    if (href.startsWith("#")) {
      window.location.href = `/${href.slice(1)}`;
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
    // Don't close if clicking inside mobile menu
    if (target.closest('[data-mobile-menu]')) {
      return;
    }
    // Close menu if clicking outside nav area
    if (activeMenu) {
      setActiveMenu(null);
    }
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  };

  const handleNavTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Don't close if touching inside the dropdown menu
    if (target.closest('[data-nav-dropdown]')) {
      return;
    }
    // Don't close if touching on nav buttons - they handle their own state
    if (target.closest('[data-nav-button]')) {
      return;
    }
    // Don't close if touching inside mobile menu
    if (target.closest('[data-mobile-menu]')) {
      return;
    }
    // Close menu if touching outside nav area
    if (activeMenu) {
      setActiveMenu(null);
    }
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
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
        <div className="absolute right-[20%] top-[30%] h-72 w-72 rounded-full bg-[#4F6EF7]/8 blur-[100px]" />
        <div className="absolute left-[38%] top-[-4rem] h-64 w-64 rounded-full bg-[#CBFF47]/5 blur-[90px]" />
        <div className="marketing-grid absolute inset-x-0 bottom-0 h-[36rem] opacity-50" />
      </div>

      <main className="relative z-10">
        <section className="px-4 pb-16 pt-6 md:px-8 md:pb-24">
          <div className="mx-auto max-w-7xl">
            <div
              className="relative"
              onClick={handleNavClick}
              onTouchEnd={handleNavTouchEnd}
            >
              <nav
                className={cn(
                  "flex items-center justify-between rounded-lg px-5 py-4 md:px-7 transition-all duration-300",
                  scrolled
                    ? "bg-[rgba(5,9,29,0.88)] backdrop-blur-[32px] border border-white/[0.06] shadow-sm"
                    : "glass-panel"
                )}
                data-nav-item
              >
                <BrandLockup compact />

                <div className="hidden items-center gap-8 lg:flex">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      data-nav-button
                      onClick={() =>
                        setActiveMenu((current) => (current === item.key ? null : item.key))
                      }
                      className="font-marketing text-sm font-medium text-white/78 transition hover:text-white"
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

                <div className="flex items-center gap-1 md:gap-4 flex-shrink-0">
                  <div className="hidden md:flex items-center gap-4">
                    <Link href="/pricing">
                      <a className="font-marketing text-sm font-medium text-white/78 transition hover:text-white">
                        {copy.nav.pricing}
                      </a>
                    </Link>
                    <Link href="/documentation">
                      <a className="font-marketing text-sm font-medium text-white/78 transition hover:text-white">
                        {copy.nav.documentation}
                      </a>
                    </Link>
                    <Link href="/product">
                      <a className="font-marketing text-sm font-medium text-white/78 transition hover:text-white">
                        {copy.nav.platform}
                      </a>
                    </Link>
                  </div>
                  <Link href="/login">
                    <a className="font-marketing hidden sm:block text-sm font-medium text-white/78 transition hover:text-white">
                      {copy.nav.logIn}
                    </a>
                  </Link>
                  <Link href="/login">
                    <a className="font-marketing hidden sm:inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[linear-gradient(90deg,#efff53_0%,#dfff4a_55%,#7ff4d2_100%)] px-3 py-2 text-xs font-semibold text-white transition hover:translate-y-[-1px] sm:gap-2 sm:px-4 sm:py-3 sm:text-sm md:px-6">
                      {copy.nav.getStarted}
                      <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                    </a>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="md:hidden text-white/78 transition hover:text-white flex-shrink-0"
                  >
                    {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </button>
                </div>
              </nav>

              {mobileMenuOpen && (
                <div className="md:hidden mt-2 glass-panel rounded-xl p-4" data-mobile-menu>
                  <div className="space-y-2">
                    <Link href="/pricing">
                      <a className="block w-full text-left px-4 py-3 font-marketing text-sm font-medium text-white/78 transition hover:text-white hover:bg-white/5 rounded-lg">
                        {copy.nav.pricing}
                      </a>
                    </Link>
                    <Link href="/documentation">
                      <a className="block w-full text-left px-4 py-3 font-marketing text-sm font-medium text-white/78 transition hover:text-white hover:bg-white/5 rounded-lg">
                        {copy.nav.documentation}
                      </a>
                    </Link>
                    <Link href="/login">
                      <a className="block w-full text-left px-4 py-3 font-marketing text-sm font-medium text-white/78 transition hover:text-white hover:bg-white/5 rounded-lg">
                        {copy.nav.logIn}
                      </a>
                    </Link>
                    <Link href="/login">
                      <a className="font-marketing block w-full text-center items-center gap-1 rounded-full bg-[linear-gradient(90deg,#efff53_0%,#dfff4a_55%,#7ff4d2_100%)] px-3 py-2 text-xs font-semibold text-white transition hover:translate-y-[-1px]">
                        {copy.nav.getStarted}
                        <ArrowRight className="h-3 w-3 inline" />
                      </a>
                    </Link>
                  </div>
                </div>
              )}

              {activeMenu && (
                <div
                  className="absolute inset-x-0 top-full z-20 pt-4 pointer-events-auto"
                  data-nav-dropdown
                >
                  <div className="bg-[#0a1022]/98 backdrop-blur-xl border border-white/[0.07] rounded-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.03)_inset]">
                    {/* Header row */}
                    <div className="flex items-center justify-between px-6 pt-5 pb-2">
                      <div>
                        <p className="font-marketing text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
                          {dropdownMenus[activeMenu].eyebrow}
                        </p>
                        <h2 className="font-marketing mt-1 text-xl font-semibold tracking-[-0.02em] text-white">
                          {dropdownMenus[activeMenu].title}
                        </h2>
                      </div>
                    </div>

                    <div className="grid gap-3 p-4 pt-2 lg:grid-cols-[1fr_1.5fr]">
                      {/* Left: featured */}
                      <div>
                        <p className="font-marketing text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25 px-1 pb-2">
                          {copy.menus[activeMenu].featuredLabel}
                        </p>
                        <MarketingMenuAction
                          {...dropdownMenus[activeMenu].featured}
                          featured
                          onNavigate={handleMenuNavigate}
                        />
                      </div>

                      {/* Right: link list */}
                      <div className="space-y-1">
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
                </div>
              )}
            </div>

            <div className="mx-auto max-w-4xl pt-16 text-center md:pt-20">
              <div className="glass-panel-soft inline-flex items-center gap-3 rounded-full px-5 py-2.5 text-sm text-white/84">
                <span className="h-2.5 w-2.5 rounded-full bg-[#dfff4a] shadow-[0_0_14px_rgba(223,255,74,0.85)]" />
                {copy.intro}
              </div>

              <h1 className="font-marketing mt-6 md:mt-8 text-[2.5rem] leading-[0.94] tracking-[-0.05em] font-extrabold text-white sm:text-5xl md:text-6xl lg:text-[6.8rem]">
                {copy.title[0]}
                <br />
                {copy.title[1]}
              </h1>

              <p
                className="soft-glow mt-4 md:mt-5 text-[1.6rem] font-medium leading-[0.95] tracking-[-0.045em] text-[#e7ff5a] sm:text-4xl md:text-[4.1rem]"
                style={{
                  fontFamily:
                    'SF Pro Display, SF Pro Text, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
              >
                {copy.subtitle}
              </p>

              <p className="mx-auto mt-6 md:mt-8 max-w-3xl text-base leading-7 md:text-lg md:leading-8 text-[#c9d0f5]/78 md:text-xl">
                {copy.description}
              </p>

              <div className="mt-8 md:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                <Link href="/login">
                  <a className="font-marketing inline-flex items-center gap-2 rounded-lg bg-[#2563eb] px-6 md:px-8 py-3.5 md:py-4 text-sm md:text-base font-bold text-white transition hover:translate-y-[-1px]">
                    {copy.primaryCta}
                    <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
                  </a>
                </Link>
                <Link href="/product">
                  <a className="font-marketing inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-5 md:px-6 py-3.5 md:py-4 text-sm font-semibold text-white/84 transition hover:border-white/20 hover:bg-white/[0.07]">
                    {copy.secondaryCta}
                  </a>
                </Link>
              </div>

              <p className="mt-5 text-sm text-[#c9d0f5]/52">
                {copy.note}
              </p>

              <div className="mt-8 flex items-center justify-center gap-3">
                <div className="flex -space-x-2">
                  {["#4F6EF7","#CBFF47","#7FC8F8","#F87171"].map((c, i) => (
                    <span key={i} className="h-7 w-7 rounded-full border-2 border-[#05091d]" style={{ background: c, opacity: 0.88 }} />
                  ))}
                </div>
                <p className="text-sm text-[#c9d0f5]/60">
                  Trusted by <span className="font-semibold text-white/80">200+ SMEs</span> across LATAM
                </p>
              </div>

              {/* Mini hero dashboard mockup */}
              <div ref={revealMockup} className="mx-auto mt-14 max-w-2xl reveal-up" style={{ transitionDelay: "120ms" }}>
                <div className="glass-panel rounded-xl p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2 px-1">
                    {["#ff5f57","#febc2e","#28c840"].map((c, i) => (
                      <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                    ))}
                    <span className="ml-2 text-xs text-white/30 font-marketing">PymesHub — Inbox</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { ch: "WA", color: "#25D366", name: "Andrea Mora", msg: "Invoice #1042 sent ✓", time: "2m", dot: true },
                      { ch: "EM", color: "#4F6EF7", name: "Carlos Ríos", msg: "Follow-up scheduled for Friday", time: "14m", dot: false },
                      { ch: "WA", color: "#25D366", name: "Beatriz Salas", msg: "Proposal accepted — pipeline updated", time: "1h", dot: true },
                    ].map((row) => (
                      <div key={row.name} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 hover:bg-white/[0.06] transition-colors">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: row.color + "22", color: row.color }}>{row.ch}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-marketing text-xs font-semibold text-white/90">{row.name}</p>
                          <p className="truncate text-[11px] text-white/40">{row.msg}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] text-white/30">{row.time}</span>
                          {row.dot && <span className="h-1.5 w-1.5 rounded-full bg-[#CBFF47] shadow-[0_0_6px_rgba(203,255,71,0.8)]" />}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-white/[0.02] px-3 py-2">
                    <span className="text-xs text-white/30">3 active threads · avg reply 6 min</span>
                    <span className="rounded-full bg-[#CBFF47]/10 px-2 py-0.5 text-[10px] font-semibold text-[#CBFF47]">SLA 94%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Carousel */}
            <div className="md:hidden mt-16">
              <Carousel opts={{ align: "start", loop: true }}>
                <CarouselContent>
                  <CarouselItem className="basis-full">
                    <article className="glass-panel rounded-xl p-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 p-2 text-[#dfe6ff]">
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
                            className="glass-panel-soft grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-xl px-4 py-3"
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
                                  ? "bg-[#dfff4a] "
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
                  </CarouselItem>

                  <CarouselItem className="basis-full">
                    <article className="glass-panel rounded-xl px-6 py-7">
                      <div className="flex flex-col gap-6">
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

                      <div className="glass-panel-soft rounded-xl px-4 py-3 text-sm text-white/72">
                          {copy.overview.performance.timeframe}
                      </div>
                    </div>

                      <div className="mt-8 h-[18rem] w-full rounded-xl border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-3">
                        <PerformanceChart labels={copy.overview.performance.chartDays} />
                      </div>

                      <div className="mt-7 grid gap-3 sm:grid-cols-3">
                        {copy.overview.performance.stats.map(({ label, value }) => (
                          <div key={label} className="glass-panel-soft rounded-xl px-4 py-4">
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
                  </CarouselItem>

                  <CarouselItem className="basis-full">
                    <article className="glass-panel rounded-xl p-6">
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

                      <div className="glass-panel-soft mt-3 rounded-xl px-4 py-4">
                        <div className="flex items-center justify-between">
                          <span className="font-marketing text-sm font-semibold text-white/84">
                            {copy.overview.automations.statusLabel}
                          </span>
                          <span className="flex items-center gap-2 text-sm text-[#dfff4a]">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#dfff4a] shadow-[0_0_4px_rgba(223,255,74,0.8)]" />
                            {copy.overview.automations.statusValue}
                          </span>
                        </div>
                      </div>
                    </article>
                  </CarouselItem>
                </CarouselContent>
                <div className="flex justify-center gap-2 mt-4">
                  <CarouselPrevious className="relative position-static mx-0" />
                  <CarouselNext className="relative position-static mx-0" />
                </div>
              </Carousel>
            </div>

            {/* Desktop Grid */}
            <div ref={revealCards} className="reveal-up hidden md:grid mt-16 grid gap-6 xl:grid-cols-[0.95fr_1.7fr_0.95fr]">
              <article className="glass-panel rounded-xl p-6 transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_32px_80px_rgba(0,0,0,0.55)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 p-2 text-[#dfe6ff]">
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

                {(() => {
                  const channelColors: Record<string, string> = {
                    WhatsApp: "#25D366",
                    Email: "#4F6EF7",
                    Invoices: "#dfff4a",
                    Pipeline: "#8B7CF6",
                  };
                  return (
                    <div className="mt-8 space-y-3">
                      {copy.overview.inbox.signals.map((signal) => (
                        <div
                          key={signal.label}
                          className="glass-panel-soft flex items-center gap-3 rounded-2xl px-4 py-3"
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: channelColors[signal.label] ?? "#fff", boxShadow: `0 0 8px ${channelColors[signal.label] ?? "#fff"}88` }}
                          />
                          <span className="min-w-0 flex-1 font-marketing text-sm font-semibold text-white/88">
                            {signal.label}
                          </span>
                          <span className="max-w-[8.75rem] whitespace-normal text-right text-[0.68rem] uppercase leading-[1.35] tracking-[0.12em] text-[#dfff4a]/74">
                            {signal.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <div className="mt-8 grid grid-cols-7 gap-2">
                  {Array.from({ length: 28 }, (_, index) => {
                    const active = [1, 4, 8, 12, 17, 18, 23, 25, 27].includes(index);
                    return (
                      <span
                        key={index}
                        className={`h-2.5 w-2.5 rounded-full ${
                          active
                            ? "bg-[#dfff4a] "
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

              <article className="glass-panel rounded-xl px-6 py-7 md:px-8 transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_32px_80px_rgba(0,0,0,0.55)]">
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

                <div className="glass-panel-soft rounded-xl px-4 py-3 text-sm text-white/72">
                    {copy.overview.performance.timeframe}
                </div>
              </div>

                <div className="mt-8 h-[18rem] w-full rounded-xl border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-3">
                  <PerformanceChart labels={copy.overview.performance.chartDays} />
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  {copy.overview.performance.stats.map(({ label, value }) => (
                    <div key={label} className="glass-panel-soft rounded-xl px-4 py-4">
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

              <article className="glass-panel rounded-xl p-6 transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_32px_80px_rgba(0,0,0,0.55)]">
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

                <div className="mt-3 space-y-2">
                  {[
                    { step: "New lead", action: "Assign agent", color: "#4F6EF7" },
                    { step: "Proposal sent", action: "Schedule reminder", color: "#CBFF47" },
                    { step: "Invoice issued", action: "Send follow-up", color: "#25D366" },
                  ].map((chip) => (
                    <div key={chip.step} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: chip.color, boxShadow: `0 0 6px ${chip.color}99` }} />
                      <span className="font-marketing text-xs text-white/60">{chip.step}</span>
                      <span className="text-white/20 text-xs">→</span>
                      <span className="font-marketing text-xs font-semibold text-white/85">{chip.action}</span>
                    </div>
                  ))}
                </div>

                <div className="glass-panel-soft mt-3 rounded-xl px-4 py-4">
                  <div className="flex items-center justify-between">
                    <span className="font-marketing text-sm font-semibold text-white/84">
                      {copy.overview.automations.statusLabel}
                    </span>
                    <span className="flex items-center gap-2 text-sm text-[#dfff4a]">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#dfff4a] shadow-[0_0_4px_rgba(223,255,74,0.8)]" />
                      {copy.overview.automations.statusValue}
                    </span>
                  </div>
                </div>
              </article>
            </div>

            <div ref={revealTrust} className="reveal-up mt-16 border-t border-white/10 pt-10">
              <p className="text-center text-xs font-semibold uppercase tracking-[0.4em] text-[#95a0cc]/44">
                {copy.trustTitle}
              </p>
              <div className="relative mt-7 overflow-hidden">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-[linear-gradient(to_right,#05091d,transparent)]" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-[linear-gradient(to_left,#05091d,transparent)]" />
                <div className="flex animate-marquee items-center gap-12 whitespace-nowrap">
                  {[...copy.trustSignals, ...copy.trustSignals].map((signal, i) => (
                    <span key={i} className="font-marketing text-lg font-semibold tracking-[-0.02em] text-white/38 inline-flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-[#4F6EF7]/50" />
                      {signal}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>

      <Footer />
      <LandingHubby />
    </div>
  );
}
