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
  Workflow,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { Footer } from "@/components/marketing/footer";
import { InboxCard, PerformanceCard, AutomationsCard } from "@/components/marketing/overview-cards";
import { LandingHubby } from "@/components/shared/landing-hubby";
import { useI18n } from "@/components/providers/i18n-provider";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { cn } from "@/lib/utils";
import { applySeoMetadata, buildSoftwareSchema } from "@/lib/seo";
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
            ? "bg-[#F59E0B]/10 text-[#F59E0B]"
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

  return (
    <Link href={href} onClick={() => onNavigate(href)} className={classes}>
      {content}
    </Link>
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

  useEffect(() => {
    const description =
      "PymesHub centralizes WhatsApp, email, clients, tasks, invoicing, pipeline visibility, and workflow automation for growing SMB teams.";
    applySeoMetadata({
      canonicalPath: "/",
      description,
      title: "PymesHub | CRM, WhatsApp inbox, invoicing and workflows for SMBs",
      jsonLd: buildSoftwareSchema("/", "PymesHub", description),
    });
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
        href: "/product",
        icon: ShieldCheck,
      },
      links: [
        {
          title: copy.menus.platform.links[0].title,
          description: copy.menus.platform.links[0].description,
          href: "/security",
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
          href: "/workflows",
        icon: Workflow,
      },
      links: [
        {
          title: copy.menus.workflows.links[0].title,
          description: copy.menus.workflows.links[0].description,
          href: "/workflows",
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
          href: "/insights",
        icon: ChartSpline,
      },
      links: [
        {
          title: copy.menus.insights.links[0].title,
          description: copy.menus.insights.links[0].description,
          href: "/insights",
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
        href: "/security",
        icon: ShieldCheck,
      },
      links: [
        {
          title: copy.menus.security.links[0].title,
          description: copy.menus.security.links[0].description,
          href: "/security",
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

  const handleMenuNavigate = (_href: string) => {
    setActiveMenu(null);
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
    <>
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "name": "PymesHub",
              "url": "https://pymeshub.lat",
              "description": "CRM, facturación electrónica y automatización para PYMEs",
              "sameAs": ["https://pymeshub.lat"]
            },
            {
              "@type": "SoftwareApplication",
              "name": "PymesHub",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "AggregateOffer",
                "priceCurrency": "USD",
                "lowPrice": "0", "highPrice": "79",
                "offerCount": "4"
              },
              "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.5", "reviewCount": "12" }
            },
            {
              "@type": "WebSite",
              "url": "https://pymeshub.lat",
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://pymeshub.lat/documentation?q={search_term_string}",
                "query-input": "required name=search_term_string"
              }
            }
          ]
        })}
      </script>
      <div className="relative overflow-hidden bg-[#05091d] text-white">

      <main className="relative z-10">
        <section className="px-4 pb-20 pt-24 md:px-8 md:pb-28 md:pt-32">
          <div className="mx-auto max-w-7xl">
            <div
              className="relative"
              onClick={handleNavClick}
              onTouchEnd={handleNavTouchEnd}
            >
              <nav
                className={cn(
                  "flex items-center justify-between rounded-2xl px-5 py-4 md:px-7 transition-all duration-500",
                  scrolled
                    ? "bg-[#05091d]/92 backdrop-blur-2xl border border-white/[0.08]"
                    : "bg-[#05091d]/70 backdrop-blur-xl border border-white/[0.04]"
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
                    <Link href="/pricing" className="font-marketing text-sm font-medium text-white/78 transition hover:text-white">
                        {copy.nav.pricing}
                    </Link>
                    <Link href="/documentation" className="font-marketing text-sm font-medium text-white/78 transition hover:text-white">
                        {copy.nav.documentation}
                    </Link>
                    <Link href="/product" className="font-marketing text-sm font-medium text-white/78 transition hover:text-white">
                        {copy.nav.platform}
                    </Link>
                  </div>
                  <Link href="/login" className="font-marketing hidden sm:block text-sm font-medium text-white/78 transition hover:text-white">
                    {copy.nav.logIn}
                  </Link>
                  <Link href="/register" className="font-marketing hidden sm:inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[linear-gradient(90deg,#F59E0B_0%,#D97706_55%,#B45309_100%)] px-3 py-2 text-xs font-semibold text-white transition hover:translate-y-[-1px] sm:gap-2 sm:px-4 sm:py-3 sm:text-sm md:px-6">
                      {copy.nav.getStarted}
                      <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
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
                    <Link href="/product" className="block w-full text-left px-4 py-3 font-marketing text-sm font-medium text-white/78 transition hover:text-white hover:bg-white/5 rounded-lg">
                        {copy.nav.platform}
                    </Link>
                    <Link href="/product" className="block w-full text-left px-4 py-3 font-marketing text-sm font-medium text-white/78 transition hover:text-white hover:bg-white/5 rounded-lg">
                        {copy.nav.workflows}
                    </Link>
                    <Link href="/product" className="block w-full text-left px-4 py-3 font-marketing text-sm font-medium text-white/78 transition hover:text-white hover:bg-white/5 rounded-lg">
                        {copy.nav.insights}
                    </Link>
                    <Link href="/product" className="block w-full text-left px-4 py-3 font-marketing text-sm font-medium text-white/78 transition hover:text-white hover:bg-white/5 rounded-lg">
                        {copy.nav.security}
                    </Link>
                    <div className="border-t border-white/[0.06] pt-2" />
                    <Link href="/pricing" className="block w-full text-left px-4 py-3 font-marketing text-sm font-medium text-white/78 transition hover:text-white hover:bg-white/5 rounded-lg">
                        {copy.nav.pricing}
                    </Link>
                    <Link href="/documentation" className="block w-full text-left px-4 py-3 font-marketing text-sm font-medium text-white/78 transition hover:text-white hover:bg-white/5 rounded-lg">
                        {copy.nav.documentation}
                    </Link>
                    <Link href="/login" className="block w-full text-left px-4 py-3 font-marketing text-sm font-medium text-white/78 transition hover:text-white hover:bg-white/5 rounded-lg">
                        {copy.nav.logIn}
                    </Link>
                    <Link href="/register" className="font-marketing block w-full text-center items-center gap-1 rounded-full bg-[linear-gradient(90deg,#F59E0B_0%,#D97706_55%,#B45309_100%)] px-3 py-2 text-xs font-semibold text-white transition hover:translate-y-[-1px]">
                        {copy.nav.getStarted}
                        <ArrowRight className="h-3 w-3 inline" />
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
                <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B] shadow-[0_0_14px_rgba(245,158,11,0.85)]" />
                {copy.intro}
              </div>

              <h1 className="font-marketing mt-6 md:mt-8 text-[2rem] leading-[1.05] tracking-[-0.04em] font-bold text-white sm:text-[2.5rem] md:text-[3.25rem] lg:text-[4rem]">
                {copy.title[0]}
                <br />
                {copy.title[1]}
              </h1>

              <p className="mt-3 md:mt-4 text-[1.25rem] font-semibold leading-[1.1] tracking-[-0.04em] text-[#FBBF24] sm:text-[1.75rem] md:text-[2.5rem]">
                {copy.subtitle}
              </p>

              <p className="mx-auto mt-6 md:mt-8 max-w-3xl text-base leading-7 text-[#c9d0f5]/78 md:text-lg md:leading-8 lg:text-xl">
                {copy.description}
              </p>

              <div className="mt-8 md:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                <Link href="/register" className="font-marketing inline-flex items-center gap-2 rounded-full bg-[linear-gradient(90deg,#F59E0B_0%,#D97706_55%,#B45309_100%)] px-6 py-3.5 text-sm font-semibold text-white transition hover:translate-y-[-1px] md:px-8 md:py-4 md:text-base">
                    {copy.primaryCta}
                    <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
                </Link>
                <Link href="/product" className="font-marketing inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-5 py-3.5 text-sm font-semibold text-white/84 transition hover:border-white/20 hover:bg-white/[0.08] md:px-6 md:py-4">
                    {copy.secondaryCta}
                </Link>
              </div>

              <p className="mt-5 text-sm text-[#c9d0f5]/52">
                {copy.note}
              </p>

              <div className="mt-8 flex items-center justify-center gap-3">
                <div className="flex -space-x-2">
                  {["#4F6EF7","#F59E0B","#7FC8F8","#F87171"].map((c, i) => (
                    <span key={i} className="h-7 w-7 rounded-full border-2 border-[#05091d]" style={{ background: c, opacity: 0.88 }} />
                  ))}
                </div>
                <p className="text-sm text-[#c9d0f5]/60">
                  {copy.trustedByPrefix}<span className="font-semibold text-white/80">{copy.trustedByCount}</span>{copy.trustedBySuffix}
                </p>
              </div>

              {/* Mini hero dashboard mockup */}
              <div ref={revealMockup} className="mx-auto mt-14 max-w-2xl reveal-up" style={{ transitionDelay: "120ms" }}>
                <div className="glass-panel rounded-xl p-4">
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
                          {row.dot && <span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B] shadow-[0_0_6px_rgba(245,158,11,0.8)]" />}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-white/[0.02] px-3 py-2">
                    <span className="text-xs text-white/30">3 active threads · avg reply 6 min</span>
                    <span className="rounded-full bg-[#F59E0B]/10 px-2 py-0.5 text-[10px] font-semibold text-[#F59E0B]">SLA 94%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Carousel */}
            <div className="md:hidden mt-16">
              <Carousel opts={{ align: "start", loop: true }}>
                <CarouselContent>
                  <CarouselItem className="basis-full">
                    <InboxCard copy={copy} variant="carousel" />
                  </CarouselItem>
                  <CarouselItem className="basis-full">
                    <PerformanceCard copy={copy} variant="carousel" />
                  </CarouselItem>
                  <CarouselItem className="basis-full">
                    <AutomationsCard copy={copy} variant="carousel" />
                  </CarouselItem>
                </CarouselContent>
                <div className="flex justify-center gap-2 mt-4">
                  <CarouselPrevious className="relative position-static mx-0" />
                  <CarouselNext className="relative position-static mx-0" />
                </div>
              </Carousel>
            </div>

            {/* Desktop Grid */}
            <div ref={revealCards} className="reveal-up hidden md:grid mt-20 grid gap-6 xl:grid-cols-3">
              <InboxCard copy={copy} variant="desktop" />
              <PerformanceCard copy={copy} variant="desktop" />
              <AutomationsCard copy={copy} variant="desktop" />
            </div>

            <div ref={revealTrust} className="reveal-up mt-20 border-t border-white/[0.06] pt-12">
              <p className="text-center text-xs font-semibold uppercase tracking-[0.32em] text-white/30">
                {copy.trustTitle}
              </p>
              <div className="relative mt-7 overflow-hidden">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#05091d] to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#05091d] to-transparent" />
                <div className="flex animate-marquee items-center gap-12 whitespace-nowrap">
                  {[...copy.trustSignals, ...copy.trustSignals].map((signal, i) => (
                    <span key={i} className="font-marketing inline-flex items-center gap-2 text-lg font-semibold tracking-[-0.02em] text-white/30">
                      <span className="h-1 w-1 rounded-full bg-[#F59E0B]/50" />
                      {signal}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>

      {copy.seoHub && (
        <section className="border-t border-white/[0.06] px-4 py-20 md:px-8">
          <div className="mx-auto max-w-7xl text-center">
            <p className="font-marketing text-xs font-semibold uppercase tracking-[0.28em] text-[#F59E0B]/68">
              {copy.seoHub.eyebrow}
            </p>
            <h2 className="font-marketing mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
              {copy.seoHub.title}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#95a0cc]/70">
              {copy.seoHub.description}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {copy.seoHub.links.map((link: { href: string; label: string }) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-[#F59E0B]/40 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
      <LandingHubby />
    </div>
    </>
  );
}
