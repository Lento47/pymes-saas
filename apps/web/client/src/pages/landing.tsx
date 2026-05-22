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
import { Link, useLocation } from "wouter";
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
    "group block rounded-md px-4 py-3 text-left transition-colors duration-150",
    featured
      ? "border border-border bg-muted/35 hover:bg-muted/55"
      : "hover:bg-muted/35"
  );

  const content = (
    <>
      <div className="flex items-start gap-3">
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
          featured
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground group-hover:text-foreground"
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="font-marketing text-sm font-semibold tracking-[-0.01em] text-foreground">
            {title}
          </h3>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
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
  const [, navigate] = useLocation();
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
      navigate("/product");
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
      <div className="relative overflow-hidden bg-background text-foreground">

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
                  "flex items-center justify-between rounded-lg px-5 py-4 md:px-7 transition-colors",
                  scrolled
                    ? "border border-border bg-card"
                    : "border border-border bg-card"
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
                      className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
                    >
                      {copy.nav[item.key]}
                      <ChevronDown
                        className={cn(
                          "ml-1 inline h-4 w-4 text-muted-foreground transition",
                          activeMenu === item.key && "rotate-180 text-foreground"
                        )}
                      />
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 md:gap-4 flex-shrink-0">
                  <div className="hidden md:flex items-center gap-4">
                    <Link href="/pricing" className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
                        {copy.nav.pricing}
                    </Link>
                    <Link href="/documentation" className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
                        {copy.nav.documentation}
                    </Link>
                    <Link href="/product" className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
                        {copy.nav.platform}
                    </Link>
                  </div>
                  <Link href="/login" className="hidden text-sm font-medium text-muted-foreground transition hover:text-foreground sm:block">
                    {copy.nav.logIn}
                  </Link>
                  <Link href="/register" className="hidden items-center gap-1 whitespace-nowrap rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 sm:inline-flex sm:gap-2 sm:px-4 sm:py-3 sm:text-sm md:px-6">
                      {copy.nav.getStarted}
                      <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="flex-shrink-0 text-muted-foreground transition hover:text-foreground md:hidden"
                  >
                    {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </button>
                </div>
              </nav>

              {mobileMenuOpen && (
                <div className="mt-2 rounded-lg border border-border bg-card p-4 md:hidden" data-mobile-menu>
                  <div className="space-y-2">
                    <Link href="/product" className="block w-full rounded-lg px-4 py-3 text-left text-sm font-medium text-muted-foreground transition hover:bg-muted/35 hover:text-foreground">
                        {copy.nav.platform}
                    </Link>
                    <Link href="/product" className="block w-full rounded-lg px-4 py-3 text-left text-sm font-medium text-muted-foreground transition hover:bg-muted/35 hover:text-foreground">
                        {copy.nav.workflows}
                    </Link>
                    <Link href="/product" className="block w-full rounded-lg px-4 py-3 text-left text-sm font-medium text-muted-foreground transition hover:bg-muted/35 hover:text-foreground">
                        {copy.nav.insights}
                    </Link>
                    <Link href="/product" className="block w-full rounded-lg px-4 py-3 text-left text-sm font-medium text-muted-foreground transition hover:bg-muted/35 hover:text-foreground">
                        {copy.nav.security}
                    </Link>
                    <div className="border-t border-border pt-2" />
                    <Link href="/pricing" className="block w-full rounded-lg px-4 py-3 text-left text-sm font-medium text-muted-foreground transition hover:bg-muted/35 hover:text-foreground">
                        {copy.nav.pricing}
                    </Link>
                    <Link href="/documentation" className="block w-full rounded-lg px-4 py-3 text-left text-sm font-medium text-muted-foreground transition hover:bg-muted/35 hover:text-foreground">
                        {copy.nav.documentation}
                    </Link>
                    <Link href="/login" className="block w-full rounded-lg px-4 py-3 text-left text-sm font-medium text-muted-foreground transition hover:bg-muted/35 hover:text-foreground">
                        {copy.nav.logIn}
                    </Link>
                    <Link href="/register" className="block w-full items-center gap-1 rounded-md bg-primary px-3 py-2 text-center text-xs font-semibold text-primary-foreground transition hover:bg-primary/90">
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
                  <div className="rounded-lg border border-border bg-card">
                    {/* Header row */}
                    <div className="flex items-center justify-between px-6 pt-5 pb-2">
                      <div>
                        <p className="font-marketing text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {dropdownMenus[activeMenu].eyebrow}
                        </p>
                        <h2 className="font-marketing mt-1 text-xl font-semibold tracking-[-0.02em] text-foreground">
                          {dropdownMenus[activeMenu].title}
                        </h2>
                      </div>
                    </div>

                    <div className="grid gap-3 p-4 pt-2 lg:grid-cols-[1fr_1.5fr]">
                      {/* Left: featured */}
                      <div>
                        <p className="font-marketing px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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
              <div className="inline-flex items-center gap-3 rounded-md border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-success" />
                {copy.intro}
              </div>

              <h1 className="font-marketing mt-6 text-[2rem] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-[2.5rem] md:mt-8 md:text-[3.25rem] lg:text-[4rem]">
                {copy.title[0]}
                <br />
                {copy.title[1]}
              </h1>

              <p
                className="mt-3 text-[1.25rem] font-medium leading-[1.1] tracking-[-0.03em] text-primary sm:text-[1.75rem] md:mt-4 md:text-[2.5rem]"
                style={{
                  fontFamily:
                    'SF Pro Display, SF Pro Text, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
              >
                {copy.subtitle}
              </p>

              <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-muted-foreground md:mt-8 md:text-lg md:leading-8 lg:text-xl">
                {copy.description}
              </p>

              <div className="mt-8 md:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                <Link href="/register" className="font-marketing inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 md:px-8 md:py-4 md:text-base">
                    {copy.primaryCta}
                    <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
                </Link>
                <Link href="/product" className="font-marketing inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-3.5 text-sm font-semibold text-foreground transition hover:bg-muted/40 md:px-6 md:py-4">
                    {copy.secondaryCta}
                </Link>
              </div>

              <p className="mt-5 text-sm text-muted-foreground">
                {copy.note}
              </p>

              <div className="mt-8 flex items-center justify-center gap-3">
                <div className="flex -space-x-2">
                  {["bg-primary/20","bg-success/20","bg-warning/20","bg-destructive/20"].map((c, i) => (
                    <span key={i} className={cn("h-7 w-7 rounded-full border-2 border-background", c)} />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  {copy.trustedByPrefix}<span className="font-semibold text-foreground">{copy.trustedByCount}</span>{copy.trustedBySuffix}
                </p>
              </div>

              {/* Mini hero dashboard mockup */}
              <div ref={revealMockup} className="mx-auto mt-14 max-w-2xl reveal-up" style={{ transitionDelay: "120ms" }}>
                <div className="app-panel rounded-lg p-4 text-left">
                  <div className="mb-3 flex items-center gap-2 px-1">
                    {["bg-destructive/55","bg-warning/55","bg-success/55"].map((c, i) => (
                      <span key={i} className={cn("h-2.5 w-2.5 rounded-full", c)} />
                    ))}
                    <span className="ml-2 text-xs text-muted-foreground font-marketing">PymesHub - Inbox</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { ch: "WA", color: "#25D366", name: "Andrea Mora", msg: "Invoice #1042 sent ✓", time: "2m", dot: true },
                      { ch: "EM", color: "#4F6EF7", name: "Carlos Ríos", msg: "Follow-up scheduled for Friday", time: "14m", dot: false },
                      { ch: "WA", color: "#25D366", name: "Beatriz Salas", msg: "Proposal accepted — pipeline updated", time: "1h", dot: true },
                    ].map((row) => (
                      <div key={row.name} className="flex items-center gap-3 rounded-md border border-border-subtle bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/35">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: row.color + "22", color: row.color }}>{row.ch}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-marketing text-xs font-semibold text-foreground">{row.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{row.msg}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] text-muted-foreground">{row.time}</span>
                          {row.dot && <span className="h-1.5 w-1.5 rounded-full bg-warning" />}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-md border border-border-subtle bg-muted/20 px-3 py-2">
                    <span className="text-xs text-muted-foreground">3 active threads - avg reply 6 min</span>
                    <span className="rounded-md bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">SLA 94%</span>
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
            <div ref={revealCards} className="reveal-up hidden md:grid mt-16 grid gap-6 xl:grid-cols-[0.95fr_1.7fr_0.95fr]">
              <InboxCard copy={copy} variant="desktop" />
              <PerformanceCard copy={copy} variant="desktop" />
              <AutomationsCard copy={copy} variant="desktop" />
            </div>

            <div ref={revealTrust} className="reveal-up mt-16 border-t border-border pt-10">
              <p className="text-center text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
                {copy.trustTitle}
              </p>
              <div className="relative mt-7 overflow-hidden">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent" />
                <div className="flex animate-marquee items-center gap-12 whitespace-nowrap">
                  {[...copy.trustSignals, ...copy.trustSignals].map((signal, i) => (
                    <span key={i} className="font-marketing inline-flex items-center gap-2 text-lg font-semibold tracking-[-0.02em] text-muted-foreground">
                      <span className="h-1 w-1 rounded-full bg-primary/45" />
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
        <section className="border-t border-border px-4 py-16 md:px-8">
          <div className="mx-auto max-w-7xl text-center">
            <p className="font-marketing text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              {copy.seoHub.eyebrow}
            </p>
            <h2 className="font-marketing mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
              {copy.seoHub.title}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
              {copy.seoHub.description}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {copy.seoHub.links.map((link: { href: string; label: string }) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition hover:bg-muted/35 hover:text-foreground"
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
