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
  Layers3,
  LifeBuoy,
  LockKeyhole,
  Menu,
  MessageCircle,
  Receipt,
  Search,
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
  platform: "/platform",
  aiAgents: "/ai-agents",
  billing: "/billing-workflows",
  security: "/security",
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
        tone === "primary" && "border-indigo-200 bg-indigo-50 text-indigo-700",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
        tone === "neutral" && "border-slate-200 bg-white text-slate-600",
      )}
    >
      {children}
    </span>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 text-[11px] font-bold uppercase tracking-[0.22em] text-indigo-600">
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Shared header — used by the landing and every product page. Real <Link>
   routes, language switcher, and a mobile sheet.
   ────────────────────────────────────────────────────────────────────────── */
export function MarketingHeader({ active }: { active?: keyof typeof SITE_ROUTES }) {
  const { messages } = useI18n();
  const t = messages.site;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navItems: Array<{ label: string; href: string; key: keyof typeof SITE_ROUTES }> = [
    { label: t.nav.platform, href: SITE_ROUTES.platform, key: "platform" },
    { label: t.nav.aiAgents, href: SITE_ROUTES.aiAgents, key: "aiAgents" },
    { label: t.nav.billing, href: SITE_ROUTES.billing, key: "billing" },
    { label: t.nav.security, href: SITE_ROUTES.security, key: "security" },
    { label: t.nav.pricing, href: SITE_ROUTES.pricing, key: "pricing" },
  ];

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 border-b pt-safe transition-all",
          scrolled
            ? "border-slate-200 bg-white/90 shadow-sm backdrop-blur"
            : "border-transparent bg-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/">
            <BrandLockup compact markClassName="h-8 w-8" textClassName="text-sm text-slate-950" />
          </Link>
          <nav className="hidden items-center gap-7 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm font-medium transition",
                  active === item.key
                    ? "text-slate-950"
                    : "text-slate-600 hover:text-slate-950",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            <LanguageSwitcher variant="marketing" />
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              {t.nav.logIn}
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {t.nav.startFree}
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 lg:hidden"
            aria-label={t.nav.platform}
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
            className="ml-auto flex h-full w-[min(22rem,90vw)] flex-col bg-white p-5 pt-[max(1.25rem,env(safe-area-inset-top))] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <BrandLockup compact markClassName="h-8 w-8" textClassName="text-sm text-slate-950" />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                aria-label={t.nav.platform}
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
                  className="rounded-2xl px-4 py-3 text-base font-semibold text-slate-800 hover:bg-slate-50"
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
                className="rounded-full border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700"
              >
                {t.nav.logIn}
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white"
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
   Product mockup (landing hero visual)
   ────────────────────────────────────────────────────────────────────────── */
export function ProductMockup() {
  const rows = [
    ["María Rodríguez", "WhatsApp · Invoice request", "Needs human", "2m", true],
    ["Café Nube", "Telegram · Support", "AI active", "14m", false],
    ["Carlos Ríos", "Email · Sales", "Waiting client", "1h", false],
  ] as const;
  return (
    <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_32px_120px_rgba(15,23,42,0.16)]">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Layers3 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-900">PymesHub Command Center</p>
            <p className="text-[10px] text-slate-500">Inbox · Customer context · AI · Billing</p>
          </div>
        </div>
        <div className="hidden gap-2 sm:flex">
          <Badge>12 open</Badge>
          <Badge tone="warning">4 need human</Badge>
          <Badge tone="success">Online</Badge>
        </div>
      </div>
      <div className="grid min-h-[430px] grid-cols-1 md:grid-cols-[270px_minmax(0,1fr)_300px]">
        <aside className="border-b border-slate-200 bg-slate-50 md:border-b-0 md:border-r">
          <div className="border-b border-slate-200 p-3">
            <div className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-400">
              <Search className="h-3.5 w-3.5" />
              Search conversations
            </div>
            <div className="mt-2 flex gap-1">
              <Badge tone="primary">Mine</Badge>
              <Badge>Unread</Badge>
              <Badge>Invoices</Badge>
            </div>
          </div>
          {rows.map(([name, meta, status, time, activeRow]) => (
            <div
              key={name}
              className={cn("border-b border-slate-200 p-3", activeRow ? "bg-indigo-50" : "bg-white/50")}
            >
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                  {name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-slate-900">{name}</p>
                    <span className="text-[10px] text-slate-400">{time}</span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-slate-500">{meta}</p>
                  <p className="mt-1 text-[10px] font-medium text-indigo-600">{status}</p>
                </div>
              </div>
            </div>
          ))}
        </aside>
        <section className="flex min-h-[430px] flex-col bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                MR
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">María Rodríguez</p>
                <p className="text-xs text-slate-500">WhatsApp · Needs human · Daniel</p>
              </div>
            </div>
            <Badge tone="primary">AI ready</Badge>
          </div>
          <div className="flex-1 space-y-4 bg-[linear-gradient(to_bottom,#ffffff,#F8FAFC)] p-4">
            <div className="text-center text-[11px] text-slate-400">Today</div>
            <div className="flex gap-2">
              <div className="mt-auto h-6 w-6 rounded-full bg-slate-100" />
              <div className="max-w-[76%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 shadow-sm">
                Hola, necesito factura del servicio de instalación de ayer.
              </div>
            </div>
            <div className="mx-auto max-w-sm rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-center text-[11px] font-medium text-indigo-700">
              AI detected invoice request · 2 details missing
            </div>
            <div className="flex justify-end">
              <div className="max-w-[76%] rounded-2xl rounded-br-md border border-indigo-100 bg-indigo-50 px-3.5 py-2.5 text-sm text-slate-800">
                Con gusto. Para prepararla, ¿me confirmás el servicio y el monto?
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-900">Invoice draft prepared</p>
                <Badge tone="warning">Review required</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">The team reviews details before final actions.</p>
            </div>
          </div>
          <div className="border-t border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <button className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                +
              </button>
              <div className="flex-1 text-sm text-slate-400">Write a reply...</div>
              <button className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white">
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
        <aside className="border-t border-slate-200 bg-slate-50 p-4 md:border-l md:border-t-0">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Customer context</p>
            <p className="mt-4 text-sm font-semibold text-slate-900">María Rodríguez</p>
            <p className="mt-1 text-xs text-slate-500">New customer · WhatsApp · Billing intent</p>
            <div className="mt-4 space-y-3">
              {[
                ["Intent", "Invoice request"],
                ["Missing", "Product, amount"],
                ["Next step", "Ask for details"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-slate-100 pb-2 last:border-0">
                  <span className="text-xs text-slate-500">{k}</span>
                  <span className="text-right text-xs font-medium text-slate-800">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Actions</p>
            <div className="mt-3 grid gap-2">
              <button className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">
                Prepare invoice
              </button>
              <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                Create task
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
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
    <div className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/70">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-6 text-xl font-semibold tracking-[-0.03em] text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-500">{body}</p>
      <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{meta}</p>
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
          <div className="mb-5 text-[11px] font-bold uppercase tracking-[0.22em] text-indigo-300">
            {f.eyebrow}
          </div>
          <h2 className="text-4xl font-semibold tracking-[-0.055em] sm:text-6xl">{f.title}</h2>
          <p className="mt-6 text-lg leading-8 text-slate-300">{f.subtitle}</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-5">
          {steps.map(([Icon, title, body], i) => (
            <div key={title} className="rounded-[22px] border border-white/10 bg-white/[0.06] p-5">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-indigo-200">
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
                ? "border-indigo-200 bg-indigo-50"
                : "border-slate-200 bg-white hover:bg-slate-50",
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-2xl",
                  active === agent.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500",
                )}
              >
                <agent.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-950">{agent.name}</p>
                <p className="text-xs text-slate-500">{agent.status}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-semibold tracking-[-0.03em] text-slate-950">{selected.name}</p>
              <p className="text-sm text-slate-500">{a.controlled}</p>
            </div>
          </div>
          <Badge tone="primary">{selected.status}</Badge>
        </div>
        <p className="mt-6 text-sm leading-7 text-slate-600">{selected.body}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {checks.map((check) => (
            <div key={check} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <p className="mt-3 text-xs leading-5 text-slate-600">{check}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs leading-5 text-amber-800">{a.guardrail}</p>
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
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
      {stages.map((s, i) => (
        <div key={s} className="flex items-center gap-4 border-b border-slate-100 py-4 last:border-0">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
              i < 2
                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                : "border-slate-200 bg-slate-50 text-slate-400",
            )}
          >
            {i + 1}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">{s}</p>
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
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Zap className="h-5 w-5" />
        </div>
        <Badge tone="success">{au.active}</Badge>
      </div>
      <h3 className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{au.recipeName}</h3>
      <div className="mt-6 space-y-3">
        {rows.map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-[88px_1fr] gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
              {row.key}
            </span>
            <span className="text-sm text-slate-700">{row.value}</span>
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
        <div key={title} className="rounded-[24px] border border-slate-200 bg-slate-50 p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm">
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="mt-6 text-lg font-semibold tracking-[-0.03em] text-slate-950">{title}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
        </div>
      ))}
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200 py-5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <span className="text-base font-semibold text-slate-950">{question}</span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-slate-400 transition", open && "rotate-180")} />
      </button>
      {open && <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">{answer}</p>}
    </div>
  );
}

export function FaqSection() {
  const { messages } = useI18n();
  const f = messages.site.faq;
  const items = [f.items.whatsapp, f.items.billing, f.items.crm];
  return (
    <section className="border-y border-slate-200 bg-white px-4 py-24 sm:px-6 lg:px-8">
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
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[36px] bg-slate-950 px-6 py-16 text-center text-white shadow-2xl shadow-slate-300/60 sm:px-12">
        <h2 className="mx-auto max-w-3xl text-4xl font-semibold tracking-[-0.055em] sm:text-6xl">
          {t.finalCta.title}
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">{t.finalCta.subtitle}</p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/register"
            className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-slate-950 hover:bg-indigo-100"
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
}: {
  badge: string;
  title: string;
  titleNode?: React.ReactNode;
  subtitle: string;
}) {
  const { messages } = useI18n();
  const t = messages.site;
  return (
    <section className="relative px-4 pb-16 pt-32 sm:px-6 sm:pt-36 lg:px-8">
      <div className="absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(circle_at_50%_0%,rgba(79,70,229,0.16),transparent_58%)]" />
      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-7 flex justify-center">
          <Badge tone="primary">{badge}</Badge>
        </div>
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-6xl lg:text-7xl lg:leading-[0.95]">
          {titleNode ?? title}
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-balance text-lg leading-8 text-slate-600">{subtitle}</p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/register"
            className="group inline-flex h-12 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {t.cta.startFree} <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link
            href={SITE_ROUTES.pricing}
            className="inline-flex h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            {t.cta.viewPricing}
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Shared page shell: light theme, marketing-page class, header + footer slots. */
export function MarketingShell({
  active,
  children,
}: {
  active?: keyof typeof SITE_ROUTES;
  children: React.ReactNode;
}) {
  useMarketingPage();
  return (
    <div className="marketing-light-theme min-h-dvh overflow-hidden bg-[#F8F9FF] text-slate-950">
      <MarketingHeader active={active} />
      <main>{children}</main>
    </div>
  );
}
