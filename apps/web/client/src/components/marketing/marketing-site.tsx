import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  FileText,
  Inbox,
  LifeBuoy,
  LockKeyhole,
  Menu,
  MessageCircle,
  Receipt,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { useI18n } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────────
   Routes for the public marketing site. Real paths (no in-page # anchors),
   each rendered by its own page component.
   ────────────────────────────────────────────────────────────────────────── */
export const SITE_ROUTES = {
  categories: "/categories",
  search: "/search",
  orders: "/orders",
  favorites: "/favorites",
  pricing: "/pricing",
} as const;

/** Adds the marketing-page class to <html> so the body background stays light
 *  on iOS safe-area zones and the page reads as the public site. */
export function useMarketingPage() {
  useEffect(() => {
    document.documentElement.classList.add("marketing-page");
    return () => document.documentElement.classList.remove("marketing-page");
  }, []);
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "primary" | "success" | "warning";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none",
        tone === "primary" && "border-amber-500/30 bg-amber-500/10 text-amber-400",
        tone === "success" && "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
        tone === "warning" && "border-amber-500/25 bg-amber-500/[0.14] text-amber-300",
        tone === "neutral" && "border-white/10 bg-white/[0.04] text-slate-300",
      )}
    >
      {children}
    </span>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 text-[11px] font-bold uppercase tracking-[0.22em] text-[#F59E0B]">
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Shared header — used by the landing and every product page. Real <Link>
   routes, language switcher, and a mobile sheet.
   ────────────────────────────────────────────────────────────────────────── */
export function MarketingHeader() {
  const { messages } = useI18n();
  const t = messages.site;
  const f = messages.footer;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Marketplace-first nav: the sections customers actually use.
  const navItems: Array<{ label: string; href: string; key: string }> = [
    { label: f.categories, href: SITE_ROUTES.categories, key: "categories" },
    { label: f.search, href: SITE_ROUTES.search, key: "search" },
    { label: f.orders, href: SITE_ROUTES.orders, key: "orders" },
    { label: f.favorites, href: SITE_ROUTES.favorites, key: "favorites" },
    { label: f.pricing, href: SITE_ROUTES.pricing, key: "pricing" },
  ];

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 border-b pt-safe transition-all",
          scrolled
            ? "border-white/10 bg-[#05091d]/90 shadow-lg shadow-black/30 backdrop-blur"
            : "border-transparent bg-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/">
            <BrandLockup compact markClassName="h-8 w-8" textClassName="text-sm text-white" />
          </Link>
          <nav className="hidden items-center gap-7 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-slate-400 transition hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            <LanguageSwitcher variant="marketing" />
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10"
            >
              {t.nav.logIn}
            </Link>
            <Link
              href={SITE_ROUTES.categories}
              className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-[#05091d] hover:bg-amber-400"
            >
              {t.nav.startFree}
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white lg:hidden"
            aria-label={t.nav.startFree}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="ml-auto flex h-full w-[min(22rem,90vw)] flex-col border-l border-white/10 bg-[#05091d] p-5 pt-[max(1.25rem,env(safe-area-inset-top))] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <BrandLockup compact markClassName="h-8 w-8" textClassName="text-sm text-white" />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-slate-300"
                aria-label={t.nav.startFree}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-8 grid gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-2xl px-4 py-3 text-base font-semibold text-slate-200 hover:bg-white/[0.06]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-6 flex justify-center">
              <LanguageSwitcher variant="marketing" />
            </div>
            <div className="mt-auto grid gap-2 pb-safe">
              <Link
                href="/login"
                className="rounded-full border border-white/15 px-4 py-3 text-center text-sm font-semibold text-slate-200"
              >
                {t.nav.logIn}
              </Link>
              <Link
                href={SITE_ROUTES.categories}
                className="rounded-full bg-amber-500 px-4 py-3 text-center text-sm font-semibold text-[#05091d]"
              >
                {t.nav.startFree}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


/* ──────────────────────────────────────────────────────────────────────────
   Reusable content sections (shared by landing + product pages)
   ────────────────────────────────────────────────────────────────────────── */
function PlatformCard({
  icon: Icon,
  title,
  body,
  meta,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  meta: string;
}) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-6 transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05]">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-6 text-xl font-semibold tracking-[-0.03em] text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
      <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">{meta}</p>
    </div>
  );
}

export function PlatformPillars() {
  const { messages } = useI18n();
  const p = messages.site.platform.pillars;
  const items: Array<{ icon: LucideIcon; title: string; body: string; meta: string }> = [
    { icon: Inbox, ...p.inbox },
    { icon: Users, ...p.context },
    { icon: Bot, ...p.agents },
    { icon: Receipt, ...p.billing },
    { icon: Workflow, ...p.automation },
    { icon: ShieldCheck, ...p.control },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((p) => (
        <PlatformCard key={p.title} {...p} />
      ))}
    </div>
  );
}

export function MessageFlow() {
  const { messages } = useI18n();
  const f = messages.site.flow;
  const steps: Array<[LucideIcon, string, string]> = [
    [MessageCircle, f.steps.message.title, f.steps.message.body],
    [BrainCircuit, f.steps.intent.title, f.steps.intent.body],
    [Users, f.steps.context.title, f.steps.context.body],
    [Receipt, f.steps.draft.title, f.steps.draft.body],
    [ShieldCheck, f.steps.review.title, f.steps.review.body],
  ];
  return (
    <section className="bg-slate-950 px-4 py-24 text-white sm:px-6 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 max-w-3xl">
          <div className="mb-5 text-[11px] font-bold uppercase tracking-[0.22em] text-[#F59E0B]">
            {f.eyebrow}
          </div>
          <h2 className="text-4xl font-semibold tracking-[-0.055em] sm:text-6xl">{f.title}</h2>
          <p className="mt-6 text-lg leading-8 text-slate-400">{f.subtitle}</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-5">
          {steps.map(([Icon, title, body], i) => (
            <div key={title} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.07] text-amber-300">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold text-white/30">0{i + 1}</span>
              </div>
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-slate-400">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AgentConsole() {
  const { messages } = useI18n();
  const a = messages.site.agents;
  const agents = [
    { id: "reception", icon: MessageCircle, ...a.list.reception },
    { id: "sales", icon: Sparkles, ...a.list.sales },
    { id: "support", icon: LifeBuoy, ...a.list.support },
    { id: "billing", icon: Receipt, ...a.list.billing },
  ];
  const [active, setActive] = useState(agents[0].id);
  const selected = agents.find((ag) => ag.id === active) ?? agents[0];
  const Icon = selected.icon;
  const checks = Object.values(selected.checks);
  return (
    <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-2">
        {agents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => setActive(agent.id)}
            className={cn(
              "w-full rounded-2xl border p-4 text-left transition",
              active === agent.id
                ? "border-amber-500/40 bg-amber-500/10"
                : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-2xl",
                  active === agent.id ? "bg-amber-500 text-[#05091d]" : "bg-white/[0.07] text-slate-400",
                )}
              >
                <agent.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{agent.name}</p>
                <p className="text-xs text-slate-400">{agent.status}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-[#05091d]">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-semibold tracking-[-0.03em] text-white">{selected.name}</p>
              <p className="text-sm text-slate-400">{a.controlled}</p>
            </div>
          </div>
          <Badge tone="primary">{selected.status}</Badge>
        </div>
        <p className="mt-6 text-sm leading-7 text-slate-400">{selected.body}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {checks.map((check) => (
            <div key={check} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <p className="mt-3 text-xs leading-5 text-slate-400">{check}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-xs leading-5 text-amber-300/90">{a.guardrail}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BillingFlow() {
  const { messages } = useI18n();
  const b = messages.site.billing;
  const stages = [b.stages.draft, b.stages.review, b.stages.ready, b.stages.delivered];
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
      {stages.map((s, i) => (
        <div key={s} className="flex items-center gap-4 border-b border-slate-100 py-4 last:border-0">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
              i < 2
                ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                : "border-white/10 bg-white/[0.04] text-slate-500",
            )}
          >
            {i + 1}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{s}</p>
            <p className="text-xs text-slate-500">{b.tracked}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AutomationRecipe() {
  const { messages } = useI18n();
  const au = messages.site.automation;
  const rows = [au.rows.when, au.rows.if, au.rows.then, au.rows.and];
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
          <Zap className="h-5 w-5" />
        </div>
        <Badge tone="success">{au.active}</Badge>
      </div>
      <h3 className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-white">{au.recipeName}</h3>
      <div className="mt-6 space-y-3">
        {rows.map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-[88px_1fr] gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-400">
              {row.key}
            </span>
            <span className="text-sm text-slate-300">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SecurityGrid() {
  const { messages } = useI18n();
  const s = messages.site.security.cards;
  const cards: Array<[LucideIcon, string, string]> = [
    [LockKeyhole, s.isolation.title, s.isolation.body],
    [UserRound, s.rbac.title, s.rbac.body],
    [FileText, s.audit.title, s.audit.body],
    [ShieldCheck, s.guardrails.title, s.guardrails.body],
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map(([Icon, title, body]) => (
        <div key={title} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="mt-6 text-lg font-semibold tracking-[-0.03em] text-white">{title}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
        </div>
      ))}
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10 py-5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <span className="text-base font-semibold text-white">{question}</span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-slate-500 transition", open && "rotate-180")} />
      </button>
      {open && <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">{answer}</p>}
    </div>
  );
}

export function FaqSection() {
  const { messages } = useI18n();
  const f = messages.site.faq;
  const items = [f.items.whatsapp, f.items.billing, f.items.crm];
  return (
    <section className="border-y border-white/10 bg-white/[0.02] px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <SectionLabel>{f.eyebrow}</SectionLabel>
        <h2 className="text-4xl font-semibold tracking-[-0.055em] text-slate-950 sm:text-5xl">{f.title}</h2>
        <div className="mt-10">
          {items.map((it) => (
            <FaqItem key={it.q} question={it.q} answer={it.a} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  const { messages } = useI18n();
  const t = messages.site;
  return (
    <section className="px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[36px] border border-white/10 bg-[#070c24] px-6 py-16 text-center text-white sm:px-12">
        <h2 className="mx-auto max-w-3xl text-4xl font-semibold tracking-[-0.055em] sm:text-6xl">
          {t.finalCta.title}
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-400">{t.finalCta.subtitle}</p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={SITE_ROUTES.categories}
            className="inline-flex h-12 items-center justify-center rounded-full bg-amber-500 px-6 text-sm font-semibold text-[#05091d] hover:bg-amber-400"
          >
            {t.cta.startFree} <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link
            href={SITE_ROUTES.pricing}
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-semibold text-white hover:bg-white/10"
          >
            {t.cta.viewPricing}
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Product page hero (shared by the 4 product pages)
   ────────────────────────────────────────────────────────────────────────── */
export function ProductPageHero({
  badge,
  title,
  titleNode,
  subtitle,
  subtitleNode,
}: {
  badge: string;
  title: string;
  titleNode?: React.ReactNode;
  subtitle: string;
  subtitleNode?: React.ReactNode;
}) {
  const { messages } = useI18n();
  const t = messages.site;
  return (
    <section className="relative px-4 pb-16 pt-32 sm:px-6 sm:pt-36 lg:px-8">
      <div className="absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.10),transparent_58%)]" />
      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-7 flex justify-center">
          <Badge tone="primary">{badge}</Badge>
        </div>
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl lg:leading-[0.95]">
          {titleNode ?? title}
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-balance text-lg leading-8 text-slate-400">{subtitleNode ?? subtitle}</p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={SITE_ROUTES.categories}
            className="group inline-flex h-12 items-center justify-center rounded-full bg-amber-500 px-6 text-sm font-semibold text-[#05091d] hover:bg-amber-400"
          >
            {t.cta.startFree} <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link
            href={SITE_ROUTES.pricing}
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-semibold text-white hover:bg-white/10"
          >
            {t.cta.viewPricing}
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Shared page shell: dark navy theme, marketing-page class, header + footer slots. */
export function MarketingShell({
  children,
}: {
  children: React.ReactNode;
}) {
  useMarketingPage();
  return (
    <div className="min-h-dvh overflow-hidden bg-[#05091d] text-white">
      <MarketingHeader />
      <main>{children}</main>
    </div>
  );
}
