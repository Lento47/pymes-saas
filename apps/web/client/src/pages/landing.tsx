import { useState, useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  ChartSpline,
  CheckCircle2,
  ChevronDown,
  FileText,
  Globe2,
  LifeBuoy,
  LockKeyhole,
  Menu,
  MessageCircle,
  Receipt,
  ShieldCheck,
  Workflow,
  X,
  Zap,
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

const VIOLET  = "#8B5CF6";
const INDIGO  = "#6366F1";
const BG_DEEP = "#030712";

const navItems = [
  { id: "platform",  key: "platform"  },
  { id: "workflows", key: "workflows" },
  { id: "insights",  key: "insights"  },
  { id: "security",  key: "security"  },
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
}: MarketingMenuLink & { featured?: boolean; onNavigate: (href: string) => void }) {
  return (
    <Link
      href={href}
      onClick={() => onNavigate(href)}
      className={cn(
        "group block rounded-xl px-4 py-3 text-left transition-all duration-200",
        featured
          ? "bg-violet-500/[0.07] hover:bg-violet-500/[0.12] border border-violet-400/[0.12]"
          : "hover:bg-white/[0.04]"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
          featured
            ? "bg-violet-500/15 text-violet-300"
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

// Subtle dot grid SVG background
const DOT_GRID_SVG = `data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='1' fill='rgba(139%2C92%2C246%2C0.18)'/%3E%3C/svg%3E`;

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

  const revealCards  = useReveal();
  const revealTrust  = useReveal();
  const revealStats  = useReveal();
  const revealHow    = useReveal();
  const revealCta    = useReveal();

  const dropdownMenus: Record<NavKey, {
    description: string; eyebrow: string;
    featured: MarketingMenuLink; links: MarketingMenuLink[]; title: string;
  }> = {
    platform: {
      eyebrow: copy.menus.platform.eyebrow,
      title: copy.menus.platform.title,
      description: copy.menus.platform.description,
      featured: { title: copy.menus.platform.featuredTitle, description: copy.menus.platform.featuredDescription, href: "/product", icon: ShieldCheck },
      links: [
        { title: copy.menus.platform.links[0].title, description: copy.menus.platform.links[0].description, href: "/security", icon: LockKeyhole },
        { title: copy.menus.platform.links[1].title, description: copy.menus.platform.links[1].description, href: "/documentation/trust-center-overview", icon: ShieldCheck },
        { title: copy.menus.platform.links[2].title, description: copy.menus.platform.links[2].description, href: "/documentation", icon: BookOpen },
      ],
    },
    workflows: {
      eyebrow: copy.menus.workflows.eyebrow,
      title: copy.menus.workflows.title,
      description: copy.menus.workflows.description,
      featured: { title: copy.menus.workflows.featuredTitle, description: copy.menus.workflows.featuredDescription, href: "/workflows", icon: Workflow },
      links: [
        { title: copy.menus.workflows.links[0].title, description: copy.menus.workflows.links[0].description, href: "/workflows", icon: Workflow },
        { title: copy.menus.workflows.links[1].title, description: copy.menus.workflows.links[1].description, href: "/documentation/workspace-launch-guide", icon: FileText },
        { title: copy.menus.workflows.links[2].title, description: copy.menus.workflows.links[2].description, href: "/documentation/support-policy", icon: LifeBuoy },
      ],
    },
    insights: {
      eyebrow: copy.menus.insights.eyebrow,
      title: copy.menus.insights.title,
      description: copy.menus.insights.description,
      featured: { title: copy.menus.insights.featuredTitle, description: copy.menus.insights.featuredDescription, href: "/insights", icon: ChartSpline },
      links: [
        { title: copy.menus.insights.links[0].title, description: copy.menus.insights.links[0].description, href: "/insights", icon: ChartSpline },
        { title: copy.menus.insights.links[1].title, description: copy.menus.insights.links[1].description, href: "/documentation/sla", icon: BookOpen },
        { title: copy.menus.insights.links[2].title, description: copy.menus.insights.links[2].description, href: "/documentation/support-policy", icon: LifeBuoy },
      ],
    },
    security: {
      eyebrow: copy.menus.security.eyebrow,
      title: copy.menus.security.title,
      description: copy.menus.security.description,
      featured: { title: copy.menus.security.featuredTitle, description: copy.menus.security.featuredDescription, href: "/security", icon: ShieldCheck },
      links: [
        { title: copy.menus.security.links[0].title, description: copy.menus.security.links[0].description, href: "/security", icon: LockKeyhole },
        { title: copy.menus.security.links[1].title, description: copy.menus.security.links[1].description, href: "/legal", icon: FileText },
        { title: copy.menus.security.links[2].title, description: copy.menus.security.links[2].description, href: "/documentation/trust-center-overview", icon: BookOpen },
      ],
    },
  };

  const handleNavClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-nav-dropdown]') || t.closest('[data-nav-button]') || t.closest('[data-mobile-menu]')) return;
    if (activeMenu) setActiveMenu(null);
    if (mobileMenuOpen) setMobileMenuOpen(false);
  };

  const handleNavTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-nav-dropdown]') || t.closest('[data-nav-button]') || t.closest('[data-mobile-menu]')) return;
    if (activeMenu) setActiveMenu(null);
    if (mobileMenuOpen) setMobileMenuOpen(false);
  };

  const STATS = [
    { value: "200+",   label: "SMBs en LATAM" },
    { value: "2.4M",   label: "Conversaciones" },
    { value: "94%",    label: "SLA promedio" },
    { value: "< 6 min", label: "Resp. promedio" },
  ];

  const PROBLEMS = [
    { icon: MessageCircle, color: "#25D366", title: "WhatsApp sin control", body: "Conversaciones perdidas en el celular personal. Sin historial, sin asignación, sin trazabilidad." },
    { icon: FileText, color: "#6366F1", title: "Facturas en PDF y Excel", body: "Cobros manuales, errores de cálculo, seguimiento imposible. El flujo de caja es un misterio." },
    { icon: Globe2, color: "#F59E0B", title: "Cinco apps, cero contexto", body: "WhatsApp aquí, email allá, CRM en otro sistema. Tu equipo repite trabajo que ya hizo otra persona." },
  ];

  const HOW_STEPS = [
    { n: "01", title: "Conecta tus canales", body: "Vincula WhatsApp, email y formularios en minutos. Sin código, sin integraciones complejas." },
    { n: "02", title: "Tu equipo opera desde un solo lugar", body: "Inbox unificado, tareas, facturas y pipeline — todo visible, todo asignado, todo trazado." },
    { n: "03", title: "Automatiza y escala", body: "Define reglas: asignar leads, enviar recordatorios de cobro, hacer seguimiento de propuestas — sin intervención manual." },
  ];

  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", "name": "PymesHub", "url": "https://pymeshub.lat", "description": "CRM, facturación electrónica y automatización para PYMEs", "sameAs": ["https://pymeshub.lat"] },
            { "@type": "SoftwareApplication", "name": "PymesHub", "applicationCategory": "BusinessApplication", "operatingSystem": "Web", "offers": { "@type": "AggregateOffer", "priceCurrency": "USD", "lowPrice": "0", "highPrice": "79", "offerCount": "4" }, "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.5", "reviewCount": "12" } },
            { "@type": "WebSite", "url": "https://pymeshub.lat", "potentialAction": { "@type": "SearchAction", "target": "https://pymeshub.lat/documentation?q={search_term_string}", "query-input": "required name=search_term_string" } }
          ]
        })}
      </script>

      {/* ── Root wrapper ── */}
      <div
        className="relative overflow-hidden text-white"
        style={{ background: BG_DEEP }}
      >

        {/* ── Global ambient glow ── */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ zIndex: 0 }}
        >
          {/* Dot grid */}
          <div
            className="absolute inset-0 opacity-100"
            style={{ backgroundImage: `url("${DOT_GRID_SVG}")`, backgroundSize: "32px 32px" }}
          />
          {/* Top violet radial glow */}
          <div
            className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full blur-[120px]"
            style={{ background: "radial-gradient(ellipse, rgba(124,58,237,0.22) 0%, transparent 70%)" }}
          />
          {/* Bottom-right indigo glow */}
          <div
            className="absolute bottom-0 right-0 h-[400px] w-[600px] blur-[100px]"
            style={{ background: "radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)" }}
          />
        </div>

        <main className="relative" style={{ zIndex: 1 }}>

          {/* ══════════════════════════════════════════════════
              HERO + NAV
          ══════════════════════════════════════════════════ */}
          <section className="px-4 pb-24 pt-8 md:px-8">
            <div className="mx-auto max-w-7xl">

              {/* ── Nav ── */}
              <div
                className="relative"
                onClick={handleNavClick}
                onTouchEnd={handleNavTouchEnd}
              >
                <nav
                  className={cn(
                    "flex items-center justify-between rounded-2xl px-5 py-4 md:px-7 transition-all duration-500",
                    scrolled
                      ? "bg-black/70 backdrop-blur-2xl border border-violet-400/[0.1] shadow-[0_0_0_1px_rgba(139,92,246,0.08)]"
                      : "bg-white/[0.03] backdrop-blur-xl border border-white/[0.04]"
                  )}
                >
                  <BrandLockup compact />

                  <div className="hidden items-center gap-8 lg:flex">
                    {navItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        data-nav-button
                        onClick={() => setActiveMenu((c) => (c === item.key ? null : item.key))}
                        className="font-marketing text-sm font-medium text-white/70 transition hover:text-white"
                      >
                        {copy.nav[item.key]}
                        <ChevronDown className={cn("ml-1 inline h-3.5 w-3.5 text-white/40 transition", activeMenu === item.key && "rotate-180 text-white")} />
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 md:gap-4 flex-shrink-0">
                    <div className="hidden md:flex items-center gap-4">
                      <Link href="/pricing" className="font-marketing text-sm font-medium text-white/70 transition hover:text-white">{copy.nav.pricing}</Link>
                      <Link href="/documentation" className="font-marketing text-sm font-medium text-white/70 transition hover:text-white">{copy.nav.documentation}</Link>
                    </div>
                    <Link href="/login" className="font-marketing hidden sm:block text-sm font-medium text-white/70 transition hover:text-white">{copy.nav.logIn}</Link>
                    <Link
                      href="/register"
                      className="font-marketing hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 sm:gap-2 sm:px-5 sm:py-2.5"
                      style={{ background: "linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)", boxShadow: "0 0 20px rgba(124,58,237,0.4)" }}
                    >
                      {copy.nav.getStarted}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                      className="md:hidden text-white/70 transition hover:text-white flex-shrink-0"
                    >
                      {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                  </div>
                </nav>

                {/* Mobile menu */}
                {mobileMenuOpen && (
                  <div className="md:hidden mt-2 rounded-xl border border-white/[0.06] bg-black/80 backdrop-blur-xl p-4" data-mobile-menu>
                    <div className="space-y-1">
                      {[
                        { href: "/product",  label: copy.nav.platform },
                        { href: "/product",  label: copy.nav.workflows },
                        { href: "/insights", label: copy.nav.insights },
                        { href: "/security", label: copy.nav.security },
                      ].map(({ href, label }) => (
                        <Link key={label} href={href} className="block w-full text-left px-4 py-2.5 font-marketing text-sm font-medium text-white/70 transition hover:text-white hover:bg-white/[0.04] rounded-lg">
                          {label}
                        </Link>
                      ))}
                      <div className="border-t border-white/[0.06] my-2" />
                      <Link href="/pricing"       className="block w-full text-left px-4 py-2.5 font-marketing text-sm font-medium text-white/70 transition hover:text-white hover:bg-white/[0.04] rounded-lg">{copy.nav.pricing}</Link>
                      <Link href="/documentation" className="block w-full text-left px-4 py-2.5 font-marketing text-sm font-medium text-white/70 transition hover:text-white hover:bg-white/[0.04] rounded-lg">{copy.nav.documentation}</Link>
                      <Link href="/login"         className="block w-full text-left px-4 py-2.5 font-marketing text-sm font-medium text-white/70 transition hover:text-white hover:bg-white/[0.04] rounded-lg">{copy.nav.logIn}</Link>
                      <Link
                        href="/register"
                        className="font-marketing mt-1 block w-full text-center rounded-full px-4 py-2.5 text-sm font-semibold text-white"
                        style={{ background: "linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)" }}
                      >
                        {copy.nav.getStarted}
                      </Link>
                    </div>
                  </div>
                )}

                {/* Dropdown */}
                {activeMenu && (
                  <div className="absolute inset-x-0 top-full z-20 pt-3 pointer-events-auto" data-nav-dropdown>
                    <div className="bg-[#0a0b1a]/96 backdrop-blur-xl border border-violet-400/[0.08] rounded-2xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]">
                      <div className="px-6 pt-5 pb-2">
                        <p className="font-marketing text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/50">{dropdownMenus[activeMenu].eyebrow}</p>
                        <h2 className="font-marketing mt-1 text-xl font-semibold tracking-[-0.02em] text-white">{dropdownMenus[activeMenu].title}</h2>
                      </div>
                      <div className="grid gap-3 p-4 pt-2 lg:grid-cols-[1fr_1.5fr]">
                        <div>
                          <p className="font-marketing text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25 px-1 pb-2">{copy.menus[activeMenu].featuredLabel}</p>
                          <MarketingMenuAction {...dropdownMenus[activeMenu].featured} featured onNavigate={() => setActiveMenu(null)} />
                        </div>
                        <div className="space-y-1">
                          {dropdownMenus[activeMenu].links.map((item) => (
                            <MarketingMenuAction key={item.title} {...item} onNavigate={() => setActiveMenu(null)} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Hero content ── */}
              <div className="mx-auto max-w-4xl pt-20 text-center md:pt-28">

                {/* Badge */}
                <div
                  className="inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-sm font-medium"
                  style={{
                    background: "rgba(124,58,237,0.1)",
                    border: "1px solid rgba(139,92,246,0.25)",
                    color: "#c4b5fd",
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: VIOLET, boxShadow: `0 0 10px ${VIOLET}` }}
                  />
                  {copy.intro}
                </div>

                {/* Main headline — gradient */}
                <h1
                  className="font-marketing mt-6 md:mt-8 text-[2.25rem] leading-[1.04] tracking-[-0.04em] font-bold sm:text-[3rem] md:text-[3.75rem] lg:text-[4.5rem]"
                  style={{
                    background: "linear-gradient(135deg, #ffffff 30%, #c4b5fd 65%, #818cf8 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {copy.title[0]}
                  <br />
                  {copy.title[1]}
                </h1>

                {/* Subheadline */}
                <p
                  className="font-marketing mt-3 md:mt-4 text-xl font-semibold leading-[1.15] tracking-[-0.03em] sm:text-2xl md:text-[1.75rem]"
                  style={{ color: "#a78bfa" }}
                >
                  {copy.subtitle}
                </p>

                {/* Description */}
                <p className="mx-auto mt-6 md:mt-7 max-w-2xl text-base leading-7 text-white/55 md:text-lg md:leading-8">
                  {copy.description}
                </p>

                {/* CTAs */}
                <div className="mt-8 md:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                  <Link
                    href="/register"
                    className="font-marketing inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-white transition hover:opacity-90 md:px-8 md:py-4 md:text-base"
                    style={{
                      background: "linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)",
                      boxShadow: "0 0 32px rgba(124,58,237,0.45), 0 1px 3px rgba(0,0,0,0.4)",
                    }}
                  >
                    {copy.primaryCta}
                    <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
                  </Link>
                  <Link
                    href="/product"
                    className="font-marketing inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white/80 transition hover:border-violet-400/30 hover:bg-white/[0.07] md:px-7 md:py-4"
                  >
                    {copy.secondaryCta}
                  </Link>
                </div>

                {/* Note */}
                <p className="mt-5 text-sm text-white/35">{copy.note}</p>

                {/* Social proof avatars */}
                <div className="mt-8 flex items-center justify-center gap-3">
                  <div className="flex -space-x-2">
                    {["#7C3AED","#6366F1","#4F46E5","#8B5CF6"].map((c, i) => (
                      <span key={i} className="h-7 w-7 rounded-full border-2 flex items-center justify-center text-[9px] font-bold text-white" style={{ background: c, borderColor: BG_DEEP }}>{["AR","BM","CS","DL"][i]}</span>
                    ))}
                  </div>
                  <p className="text-sm text-white/50">
                    {copy.trustedByPrefix}<span className="font-semibold text-white/75">{copy.trustedByCount}</span>{copy.trustedBySuffix}
                  </p>
                </div>

                {/* ── Dashboard mockup ── */}
                <div className="mx-auto mt-14 max-w-2xl reveal-up" style={{ transitionDelay: "100ms" }}>
                  <div
                    className="rounded-2xl p-px"
                    style={{
                      background: "linear-gradient(135deg, rgba(139,92,246,0.4) 0%, rgba(99,102,241,0.15) 50%, transparent 100%)",
                    }}
                  >
                    <div
                      className="rounded-2xl p-5"
                      style={{ background: "rgba(8,9,28,0.95)", backdropFilter: "blur(20px)" }}
                    >
                      {/* Window chrome */}
                      <div className="mb-4 flex items-center gap-2 px-1">
                        {["#ff5f57","#febc2e","#28c840"].map((c, i) => (
                          <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                        ))}
                        <span className="ml-3 text-xs text-white/25 font-marketing">PymesHub — Inbox</span>
                        <div className="ml-auto flex items-center gap-1.5">
                          <span className="rounded-md border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-300">SLA 94%</span>
                        </div>
                      </div>

                      {/* Conversation rows */}
                      <div className="space-y-2">
                        {[
                          { ch: "WA", color: "#25D366", name: "Andrea Mora",  msg: "Factura #1042 enviada ✓",          time: "2m",  badge: "Pagado" },
                          { ch: "EM", color: "#6366F1", name: "Carlos Ríos",  msg: "Seguimiento agendado para el viernes", time: "14m", badge: null },
                          { ch: "WA", color: "#25D366", name: "Beatriz Salas", msg: "Propuesta aceptada — pipeline actualizado", time: "1h",  badge: "Pipeline" },
                        ].map((row) => (
                          <div key={row.name} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]" style={{ background: "rgba(255,255,255,0.025)" }}>
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: row.color + "18", color: row.color }}>{row.ch}</span>
                            <div className="min-w-0 flex-1">
                              <p className="font-marketing text-xs font-semibold text-white/90">{row.name}</p>
                              <p className="truncate text-[11px] text-white/38">{row.msg}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="text-[10px] text-white/25">{row.time}</span>
                              {row.badge && (
                                <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: "rgba(124,58,237,0.15)", color: "#c4b5fd" }}>{row.badge}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Footer bar */}
                      <div className="mt-3 flex items-center justify-between rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.015)" }}>
                        <span className="text-xs text-white/28">3 hilos activos · resp. promedio 6 min</span>
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#4ade80]" />
                          <span className="text-[10px] text-white/40">En línea</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </section>

          {/* ══════════════════════════════════════════════════
              STATS STRIP
          ══════════════════════════════════════════════════ */}
          <div ref={revealStats} className="reveal-up border-y px-4 py-10 md:px-8" style={{ borderColor: "rgba(139,92,246,0.12)", background: "rgba(124,58,237,0.04)" }}>
            <div className="mx-auto max-w-5xl grid grid-cols-2 gap-8 md:grid-cols-4">
              {STATS.map(({ value, label }) => (
                <div key={label} className="text-center">
                  <div
                    className="font-marketing text-3xl font-bold tracking-[-0.04em] md:text-4xl"
                    style={{
                      background: "linear-gradient(135deg, #e9d5ff 20%, #818cf8 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {value}
                  </div>
                  <div className="mt-1 text-sm text-white/40">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              THE PROBLEM
          ══════════════════════════════════════════════════ */}
          <section className="px-4 py-24 md:px-8">
            <div className="mx-auto max-w-7xl">
              <div className="text-center mb-16">
                <p className="font-marketing text-xs font-semibold uppercase tracking-[0.28em] mb-3" style={{ color: "#a78bfa" }}>El problema</p>
                <h2
                  className="font-marketing text-3xl font-bold tracking-[-0.04em] sm:text-4xl md:text-5xl"
                  style={{
                    background: "linear-gradient(135deg, #fff 40%, #c4b5fd 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Tu equipo ya hace el trabajo.<br />El problema es la visibilidad.
                </h2>
                <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/45 md:text-lg">
                  Las PYMEs pierden horas — y clientes — cada semana porque la información está dispersa en cinco herramientas sin conexión.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {PROBLEMS.map(({ icon: Icon, color, title, body }) => (
                  <div
                    key={title}
                    className="rounded-2xl p-px"
                    style={{ background: `linear-gradient(135deg, ${color}22 0%, transparent 60%)` }}
                  >
                    <div
                      className="h-full rounded-2xl p-6 space-y-4"
                      style={{ background: "rgba(8,9,28,0.9)" }}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: color + "15" }}>
                        <Icon className="h-5 w-5" style={{ color }} />
                      </div>
                      <h3 className="font-marketing text-base font-semibold text-white">{title}</h3>
                      <p className="text-sm leading-6 text-white/45">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════
              FEATURE CARDS
          ══════════════════════════════════════════════════ */}
          <section className="px-4 py-8 md:px-8 md:py-16">
            <div className="mx-auto max-w-7xl">
              <div className="text-center mb-14">
                <p className="font-marketing text-xs font-semibold uppercase tracking-[0.28em] mb-3" style={{ color: "#a78bfa" }}>La plataforma</p>
                <h2
                  className="font-marketing text-3xl font-bold tracking-[-0.04em] sm:text-4xl"
                  style={{
                    background: "linear-gradient(135deg, #fff 40%, #c4b5fd 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Todo lo que tu equipo necesita,<br className="hidden sm:block" /> en un solo lugar
                </h2>
              </div>

              {/* Mobile carousel */}
              <div className="md:hidden">
                <Carousel opts={{ align: "start", loop: true }}>
                  <CarouselContent>
                    <CarouselItem className="basis-full"><InboxCard copy={copy} variant="carousel" /></CarouselItem>
                    <CarouselItem className="basis-full"><PerformanceCard copy={copy} variant="carousel" /></CarouselItem>
                    <CarouselItem className="basis-full"><AutomationsCard copy={copy} variant="carousel" /></CarouselItem>
                  </CarouselContent>
                  <div className="flex justify-center gap-2 mt-4">
                    <CarouselPrevious className="relative position-static mx-0" />
                    <CarouselNext className="relative position-static mx-0" />
                  </div>
                </Carousel>
              </div>

              {/* Desktop grid */}
              <div ref={revealCards} className="reveal-up hidden md:grid grid-cols-1 gap-5 xl:grid-cols-3">
                <InboxCard copy={copy} variant="desktop" />
                <PerformanceCard copy={copy} variant="desktop" />
                <AutomationsCard copy={copy} variant="desktop" />
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════
              HOW IT WORKS
          ══════════════════════════════════════════════════ */}
          <section className="px-4 py-24 md:px-8">
            <div ref={revealHow} className="reveal-up mx-auto max-w-5xl">
              <div className="text-center mb-16">
                <p className="font-marketing text-xs font-semibold uppercase tracking-[0.28em] mb-3" style={{ color: "#a78bfa" }}>Cómo funciona</p>
                <h2
                  className="font-marketing text-3xl font-bold tracking-[-0.04em] sm:text-4xl"
                  style={{
                    background: "linear-gradient(135deg, #fff 40%, #c4b5fd 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  De 5 apps a 1 workspace.<br className="hidden sm:block" /> En menos de una hora.
                </h2>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {HOW_STEPS.map(({ n, title, body }, idx) => (
                  <div key={n} className="relative">
                    {/* Connector line between steps */}
                    {idx < HOW_STEPS.length - 1 && (
                      <div
                        className="absolute top-6 left-full z-10 hidden h-px w-full md:block"
                        style={{ background: "linear-gradient(to right, rgba(139,92,246,0.35), transparent)", width: "calc(100% - 3rem)", left: "calc(100% - 1.5rem)" }}
                      />
                    )}
                    <div
                      className="rounded-2xl p-px"
                      style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.2) 0%, transparent 60%)" }}
                    >
                      <div
                        className="h-full rounded-2xl p-6 space-y-4"
                        style={{ background: "rgba(8,9,28,0.9)" }}
                      >
                        <div
                          className="font-mono text-2xl font-bold"
                          style={{ color: "rgba(139,92,246,0.5)" }}
                        >
                          {n}
                        </div>
                        <h3 className="font-marketing text-base font-semibold text-white">{title}</h3>
                        <p className="text-sm leading-6 text-white/45">{body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════
              TRUST MARQUEE
          ══════════════════════════════════════════════════ */}
          <div className="border-t border-white/[0.05] py-14">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.32em] text-white/25 mb-8">
              {copy.trustTitle}
            </p>
            <div className="relative overflow-hidden">
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-[#030712] to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-[#030712] to-transparent" />
              <div className="flex animate-marquee items-center gap-12 whitespace-nowrap">
                {[...copy.trustSignals, ...copy.trustSignals].map((signal: string, i: number) => (
                  <span key={i} className="font-marketing inline-flex items-center gap-2 text-lg font-semibold tracking-[-0.02em] text-white/25">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: VIOLET + "80" }} />
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              FINAL CTA
          ══════════════════════════════════════════════════ */}
          <section className="px-4 py-24 md:px-8">
            <div ref={revealCta} className="reveal-up mx-auto max-w-4xl">
              <div
                className="relative overflow-hidden rounded-3xl p-px"
                style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.6) 0%, rgba(99,102,241,0.3) 50%, rgba(139,92,246,0.1) 100%)" }}
              >
                <div
                  className="relative rounded-3xl px-8 py-16 text-center md:px-16"
                  style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.15) 0%, rgba(3,7,18,0.98) 60%)" }}
                >
                  {/* Glow blob */}
                  <div
                    aria-hidden
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full blur-[80px] pointer-events-none"
                    style={{ background: "rgba(124,58,237,0.25)" }}
                  />

                  <div className="relative">
                    <div
                      className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium mb-6"
                      style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(139,92,246,0.25)", color: "#c4b5fd" }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Beta cerrada · Primeras 50 empresas
                    </div>

                    <h2
                      className="font-marketing text-3xl font-bold tracking-[-0.04em] sm:text-4xl md:text-5xl mb-5"
                      style={{
                        background: "linear-gradient(135deg, #ffffff 40%, #c4b5fd 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                      }}
                    >
                      Empieza gratis hoy.
                    </h2>
                    <p className="mx-auto max-w-lg text-base leading-7 text-white/50 mb-8 md:text-lg">
                      Sin tarjeta de crédito. Sin compromiso. Solo acceso temprano a la plataforma que tu equipo necesitaba desde hace meses.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                      <Link
                        href="/register"
                        className="font-marketing inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white transition hover:opacity-90"
                        style={{ background: "linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)", boxShadow: "0 0 40px rgba(124,58,237,0.5)" }}
                      >
                        Quiero acceso temprano
                        <ArrowRight className="h-5 w-5" />
                      </Link>
                      <Link
                        href="/product"
                        className="font-marketing inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-7 py-4 text-base font-semibold text-white/70 transition hover:border-violet-400/30 hover:bg-white/[0.07]"
                      >
                        Ver la plataforma
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

        </main>

        {/* ── SEO Hub ── */}
        {copy.seoHub && (
          <section className="border-t px-4 py-20 md:px-8" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <div className="mx-auto max-w-7xl text-center">
              <p className="font-marketing text-xs font-semibold uppercase tracking-[0.28em] mb-3" style={{ color: "#a78bfa" }}>
                {copy.seoHub.eyebrow}
              </p>
              <h2 className="font-marketing text-2xl font-semibold tracking-[-0.03em] text-white md:text-3xl">
                {copy.seoHub.title}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/40">
                {copy.seoHub.description}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-2.5">
                {copy.seoHub.links.map((link: { href: string; label: string }) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-full border border-white/8 px-4 py-2 text-sm text-white/55 transition hover:border-violet-400/30 hover:text-white/90"
                    style={{ background: "rgba(255,255,255,0.025)" }}
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
