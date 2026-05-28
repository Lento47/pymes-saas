import { useState, useEffect, useRef } from "react";
import { TextEffect } from "@/components/ui/text-effect";
import { InfiniteSlider } from "@/components/ui/infinite-slider";
type LucideIcon = any;
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  ChartSpline,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Globe2,
  LifeBuoy,
  LockKeyhole,
  Mail,
  Menu,
  MessageCircle,
  Receipt,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  X,
  Zap,
  Bot,
  Clock,
  TrendingUp,
  AlertTriangle,
  Building2,
  Phone,
  Send,
  Plus,
} from "lucide-react";
import { Link } from "wouter";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { Footer } from "@/components/marketing/footer";
import { LandingHubby } from "@/components/shared/landing-hubby";
import { useI18n } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";
import { applySeoMetadata, buildSoftwareSchema } from "@/lib/seo";

const ACCENT = "#6757E8";

const navItems = [
  { id: "platform",  key: "platform"  },
  { id: "workflows", key: "workflows" },
  { id: "insights",  key: "insights"  },
  { id: "security",  key: "security"  },
] as const;
type NavKey = (typeof navItems)[number]["key"];

interface MarketingMenuLink { description: string; href: string; icon: LucideIcon; title: string; }

function MarketingMenuAction({ description, featured = false, href, icon: Icon, onNavigate, title }: MarketingMenuLink & { featured?: boolean; onNavigate: (href: string) => void }) {
  return (
    <Link href={href} onClick={() => onNavigate(href)}
      className={cn("group block rounded-xl px-4 py-3 text-left transition-all duration-200",
        featured ? "bg-violet-50 hover:bg-violet-100/60 border border-violet-200/60" : "hover:bg-gray-50")}>
      <div className="flex items-start gap-3">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
          featured ? "bg-violet-100 text-violet-600" : "bg-gray-100 text-gray-500 group-hover:text-gray-700")}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="font-marketing text-sm font-semibold tracking-[-0.01em] text-gray-800 group-hover:text-gray-900">{title}</h3>
          <p className="mt-0.5 text-xs leading-5 text-gray-400">{description}</p>
        </div>
      </div>
    </Link>
  );
}

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add("visible"); obs.disconnect(); } }, { threshold: 0.08 });
    obs.observe(el); return () => obs.disconnect();
  }, []);
  return ref;
}

// ── Inbox hero mockup ─────────────────────────────────────────────────────────
function InboxMockup() {
  const convos = [
    { initials: "MG", ch: "WA", chColor: "#25D366", name: "María González", msg: "Quisiera cotizar instalación 3 locales", time: "2m", active: true, badge: "🔥 Venta" },
    { initials: "CR", ch: "TG", chColor: "#229ED9", name: "Carlos Ríos",    msg: "¿Cuánto cuesta el plan Business?",       time: "14m", active: false, badge: null },
    { initials: "BS", ch: "EM", chColor: "#6366F1", name: "Beatriz Salas",  msg: "Re: Factura #1042 — pagada",             time: "1h",  active: false, badge: "Pagado" },
    { initials: "JP", ch: "WA", chColor: "#25D366", name: "Juan Pérez",     msg: "Necesito soporte con el módulo...",       time: "3h",  active: false, badge: null },
  ];

  return (
    <div className="w-full rounded-2xl border border-[#E2E4EE] bg-white overflow-hidden" style={{ boxShadow: "0 24px 64px -12px rgba(0,0,0,0.10), 0 4px 16px -4px rgba(103,87,232,0.08)" }}>
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-[#E6E8EF] bg-[#F7F8FC] px-4 py-3">
        <div className="flex gap-1.5">
          {["#FF5F57","#FEBC2E","#28C840"].map(c => <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />)}
        </div>
        <span className="ml-3 text-[11px] font-medium text-gray-400 font-marketing">PymesHub — Inbox Omnicanal</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="rounded-full border border-violet-100 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-600">SLA 94%</span>
          <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">● En línea</span>
        </div>
      </div>

      {/* 3-col grid */}
      <div className="grid" style={{ gridTemplateColumns: "224px 1fr 196px", minHeight: 340 }}>

        {/* Col 1 — conversation list */}
        <div className="border-r border-[#E6E8EF] flex flex-col">
          <div className="flex gap-1 px-3 py-2.5 border-b border-[#E6E8EF]">
            {["Todos","Sin resp.","Humano"].map((t, i) => (
              <span key={t} className={cn("text-[10px] rounded-full px-2 py-0.5 font-medium", i === 0 ? "bg-violet-100 text-violet-700" : "text-gray-400 hover:text-gray-600")}>{t}</span>
            ))}
          </div>
          {convos.map(c => (
            <div key={c.name} className={cn("flex items-start gap-2.5 px-3 py-2.5 cursor-pointer border-b border-[#F3F4F8]",
              c.active ? "bg-violet-50/60 border-l-2 border-l-[#6757E8]" : "hover:bg-[#F7F8FC]")}>
              <div className="h-7 w-7 flex-shrink-0 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: c.chColor }}>{c.ch}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className={cn("text-[11px] font-semibold truncate", c.active ? "text-[#6757E8]" : "text-gray-800")}>{c.name}</span>
                  <span className="text-[9px] text-gray-400 flex-shrink-0">{c.time}</span>
                </div>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <p className="text-[10px] text-gray-400 truncate">{c.msg}</p>
                  {c.badge && <span className="flex-shrink-0 text-[9px] font-semibold text-violet-500">{c.badge}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Col 2 — chat */}
        <div className="flex flex-col bg-white">
          <div className="flex items-center gap-2.5 border-b border-[#E6E8EF] px-4 py-2.5">
            <div className="h-7 w-7 flex-shrink-0 rounded-full bg-violet-100 flex items-center justify-center text-[10px] font-bold text-violet-600">MG</div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-gray-800">María González</div>
              <div className="text-[9px] text-[#25D366] font-medium">● WhatsApp · Ventana abierta</div>
            </div>
            <span className="text-[10px] rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 font-semibold text-amber-600">IA activa</span>
          </div>
          <div className="flex-1 overflow-hidden p-3 space-y-2.5">
            <div className="text-center text-[9px] text-gray-400">Hoy · 10:34 am</div>
            <div className="flex gap-1.5">
              <div className="h-5 w-5 flex-shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-[8px] font-bold text-gray-500">M</div>
              <div className="max-w-[72%] rounded-xl rounded-tl-sm bg-[#F3F4F8] px-3 py-2 text-[11px] text-gray-700">
                Hola! Quisiera cotizar instalación para 3 locales la próxima semana 🙏
              </div>
            </div>
            <div className="flex justify-end">
              <div className="max-w-[72%] rounded-xl rounded-tr-sm px-3 py-2 text-[11px] text-white" style={{ background: ACCENT }}>
                ¡Hola María! Con gusto. ¿Para cuándo necesitarías que inicie la instalación?
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-violet-100 bg-violet-50/80 px-2.5 py-1.5">
              <Sparkles className="h-3 w-3 flex-shrink-0 text-violet-500" />
              <span className="text-[10px] text-violet-700 font-medium">Sugerencia IA: Crear cotización — instalación 3 locales</span>
            </div>
          </div>
          <div className="border-t border-[#E6E8EF] bg-[#F7F8FC] p-2">
            <div className="flex items-center gap-2 rounded-lg border border-[#E6E8EF] bg-white px-3 py-2">
              <span className="flex-1 text-[11px] text-gray-400">Redactar respuesta...</span>
              <div className="flex items-center gap-1">
                <span className="rounded text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5">IA</span>
                <div className="h-5 w-5 rounded-full flex items-center justify-center text-white text-[10px]" style={{ background: ACCENT }}>↑</div>
              </div>
            </div>
          </div>
        </div>

        {/* Col 3 — customer intelligence */}
        <div className="flex flex-col border-l border-[#E6E8EF] bg-[#FAFBFE]">
          <div className="border-b border-[#E6E8EF] px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Customer Intelligence</div>
          </div>
          <div className="flex-1 overflow-hidden p-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 flex-shrink-0 rounded-full bg-violet-100 flex items-center justify-center text-[10px] font-bold text-violet-700">MG</div>
              <div>
                <div className="text-[11px] font-semibold text-gray-800">María González</div>
                <div className="text-[9px] text-gray-400">Cliente activo · WhatsApp</div>
              </div>
            </div>
            <div className="rounded-lg border border-[#E6E8EF] bg-white p-2">
              <div className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Resumen IA</div>
              <p className="text-[10px] leading-relaxed text-gray-600">Quiere cotizar instalación 3 locales. Preguntó por precio y disponibilidad próx. semana.</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500">Intención</span>
              <span className="text-[10px] rounded-full border border-orange-100 bg-orange-50 px-2 py-0.5 font-semibold text-orange-600">🔥 Venta caliente</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500">Urgencia</span>
              <span className="text-[10px] font-semibold text-red-500">Alta</span>
            </div>
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Próxima acción</div>
              <button className="w-full rounded-lg py-1.5 text-[10px] font-semibold text-white transition hover:opacity-90" style={{ background: ACCENT }}>
                + Crear cotización
              </button>
              <button className="mt-1 w-full rounded-lg border border-[#E6E8EF] bg-white py-1.5 text-[10px] font-medium text-gray-600 hover:bg-gray-50">
                + Crear tarea
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Agent config mockup ───────────────────────────────────────────────────────
function AgentMockup({ type }: { type: "sales" | "support" | "billing" }) {
  const configs = {
    sales:   { name: "Agente de Ventas",     color: "#6757E8", bg: "bg-violet-50",  icon: TrendingUp, rules: ["Responde consultas de precios","Califica leads entrantes","Crea cotizaciones automáticas","Escala si pide descuento > 20%"] },
    support: { name: "Agente de Soporte",    color: "#0891B2", bg: "bg-cyan-50",    icon: LifeBuoy,   rules: ["Responde FAQs del negocio","Busca en base de conocimiento","Escala si no encuentra respuesta","Requiere aprobación para reembolsos"] },
    billing: { name: "Agente de Facturación",color: "#059669", bg: "bg-emerald-50", icon: Receipt,     rules: ["Envía facturas pendientes","Responde consultas de pagos","Crea recordatorios automáticos","Nunca modifica montos sin aprobación"] },
  };
  const cfg = configs[type];
  const Icon = cfg.icon;
  return (
    <div className="rounded-xl border border-[#E6E8EF] bg-white overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-[#E6E8EF] px-4 py-3">
        <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: cfg.color + "18" }}>
          <Icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
        </div>
        <span className="text-sm font-semibold text-gray-800">{cfg.name}</span>
        <span className="ml-auto rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">Activo</span>
      </div>
      <div className="p-4 space-y-2">
        {cfg.rules.map(r => (
          <div key={r} className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: cfg.color }} />
            <span className="text-xs text-gray-600">{r}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── FAQ item ──────────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#E6E8EF] last:border-0">
      <button type="button" onClick={() => setOpen(!open)}
        className="flex w-full items-start justify-between gap-4 py-5 text-left">
        <span className="font-marketing text-base font-semibold text-gray-900">{q}</span>
        <ChevronDown className={cn("h-5 w-5 flex-shrink-0 text-gray-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && <p className="pb-5 text-sm leading-7 text-gray-500">{a}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Landing() {
  const { messages } = useI18n();
  const copy = messages.landing;
  const [activeMenu, setActiveMenu] = useState<NavKey | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [agentTab, setAgentTab] = useState<"sales"|"support"|"billing">("sales");

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    const description = "PymesHub centraliza WhatsApp, Telegram, email, clientes, tareas, agentes IA y facturación para que tu negocio responda más rápido sin perder el control humano.";
    applySeoMetadata({
      canonicalPath: "/",
      description,
      title: "PymesHub | Inbox omnicanal, agentes IA y CRM para PyMEs",
      jsonLd: buildSoftwareSchema("/", "PymesHub", description),
    });
  }, []);

  const revealHero   = useReveal();
  const revealInbox  = useReveal();
  const revealAgent  = useReveal();
  const revealIntel  = useReveal();
  const revealSec    = useReveal();
  const revealInt    = useReveal();
  const revealFaq    = useReveal();
  const revealCta    = useReveal();

  const dropdownMenus: Record<NavKey, any> = {
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

  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-nav-dropdown]') || t.closest('[data-nav-button]') || t.closest('[data-mobile-menu]')) return;
    if (activeMenu) setActiveMenu(null);
    if (mobileMenuOpen) setMobileMenuOpen(false);
  };

  const PROBLEMS = [
    { icon: MessageCircle, color: "#25D366", title: "Conversaciones dispersas", body: "WhatsApp en un celular, email en otro, Telegram sin asignar. Nadie sabe quién respondió qué ni cuándo." },
    { icon: Users, color: "#6757E8", title: "Ventas que se pierden", body: "Un lead llegó mientras el equipo estaba ocupado. Nadie lo siguió. No hay historial. La venta se fue." },
    { icon: AlertTriangle, color: "#F59E0B", title: "IA sin control humano", body: "Automatizar sin límites claros puede generar respuestas incorrectas, compromisos no autorizados o datos expuestos." },
  ];

  const FLOW_STEPS = [
    { icon: MessageCircle, label: "Mensaje entra", sub: "WhatsApp, Telegram o Email" },
    { icon: BrainCircuit,  label: "IA detecta intención", sub: "Venta, soporte, facturación" },
    { icon: Users,         label: "Crea cliente", sub: "Con historial completo" },
    { icon: Zap,           label: "Sugiere acción", sub: "Cotizar, tareas, escalar" },
    { icon: Receipt,       label: "Genera documento", sub: "Factura, cotización, tarea" },
    { icon: CheckCircle2,  label: "Cierra o escala", sub: "Control humano siempre" },
  ];

  const SECURITY_ITEMS = [
    { icon: LockKeyhole,  title: "Permisos por rol", body: "Cada usuario ve y hace solo lo que su rol permite. Dueño, admin, agente." },
    { icon: ShieldCheck,  title: "Aislamiento por workspace", body: "Cada negocio tiene sus datos completamente separados. Nada se comparte entre clientes." },
    { icon: FileText,     title: "Auditoría de acciones", body: "Registro completo de quién cambió qué y cuándo. Trazabilidad total." },
    { icon: AlertTriangle,title: "Confirmación para acciones sensibles", body: "Facturas, cambios de precio o acciones irreversibles requieren aprobación explícita." },
    { icon: Bot,          title: "IA con límites declarados", body: "Configura qué puede y qué no puede hacer cada agente. Sin autonomía no autorizada." },
    { icon: Globe2,       title: "Datos en infraestructura propia", body: "Sin third-party data sharing. Tu información comercial no alimenta modelos externos." },
  ];

  const INTEGRATIONS = [
    { name: "WhatsApp Business", color: "#25D366", initial: "WA", note: "Requiere Meta Business" },
    { name: "Telegram",          color: "#229ED9", initial: "TG", note: "Bot API" },
    { name: "Email",             color: "#6366F1", initial: "EM", note: "SMTP / IMAP" },
    { name: "Gmail",             color: "#EA4335", initial: "GM", note: "OAuth 2.0" },
    { name: "PayPal",            color: "#003087", initial: "PP", note: "Pagos y cobros" },
    { name: "Paddle",            color: "#0A9B4B", initial: "PD", note: "Billing SaaS" },
  ];

  const USE_CASES = [
    { key: "ventas",       label: "Ventas",       steps: ["Cliente escribe por WhatsApp consultando precio","IA detecta intención de compra y califica el lead","Agente recibe contexto: historial, interés, presupuesto estimado","Crea cotización y tarea de seguimiento en un clic","Cliente responde y cierra: IA actualiza el pipeline automáticamente"] },
    { key: "soporte",      label: "Soporte",       steps: ["Cliente reporta problema via Telegram","IA busca en base de conocimiento y sugiere respuesta","Si no hay respuesta → escala a humano con contexto completo","Agente responde con historial visible","Resolución marcada y métricas actualizadas"] },
    { key: "facturacion",  label: "Facturación",  steps: ["Servicio completado → IA sugiere crear factura","Factura generada en un clic desde la conversación","Envío automático al cliente con seguimiento de apertura","Recordatorio automático si no se paga en X días","Pago registrado → pipeline y CRM actualizados"] },
    { key: "citas",        label: "Citas",         steps: ["Cliente pide cita por WhatsApp","IA verifica disponibilidad del equipo","Confirma horario y envía recordatorio automático","24h antes → recordatorio al cliente","Post-cita → seguimiento automático de satisfacción"] },
  ];
  const [activeCase, setActiveCase] = useState("ventas");
  const currentCase = USE_CASES.find(c => c.key === activeCase)!;

  const FAQS = [
    { q: "¿PymesHub reemplaza a WhatsApp Business?", a: "No. PymesHub se conecta a tu cuenta de WhatsApp Business existente vía Meta Cloud API y centraliza las conversaciones en un inbox compartido para tu equipo. Necesitas una cuenta Meta Business verificada para usar el canal de WhatsApp." },
    { q: "¿Qué pasa si el agente IA comete un error?", a: "Cada agente tiene límites declarados que vos configurás: qué puede responder, qué debe escalar y qué acciones requieren aprobación humana. El sistema nunca es 100% autónomo — el control final siempre está en manos de tu equipo." },
    { q: "¿Mis datos están seguros? ¿Se usan para entrenar IA?", a: "Tus datos están aislados en tu workspace. No se comparten con otros clientes ni se usan para entrenar modelos externos. El contenido de tus conversaciones es tuyo." },
    { q: "¿Puedo usar PymesHub sin WhatsApp?", a: "Sí. PymesHub funciona con email y Telegram desde el inicio. WhatsApp es opcional y requiere configuración adicional con Meta Business." },
    { q: "¿Cómo funciona la prueba gratuita?", a: "Empezás con el plan Free sin tarjeta de crédito. Tenés acceso al inbox, CRM básico y automatizaciones. Cuando tu operación crezca, upgradeas al plan que necesites." },
    { q: "¿Qué diferencia hay entre los planes?", a: "Los planes se diferencian por número de canales, usuarios, automatizaciones y capacidades de agentes IA. El plan Enterprise incluye agentes con pipeline completo y acceso a Developer API." },
  ];

  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", "name": "PymesHub", "url": "https://pymeshub.lat" },
            { "@type": "SoftwareApplication", "name": "PymesHub", "applicationCategory": "BusinessApplication", "operatingSystem": "Web",
              "offers": { "@type": "AggregateOffer", "priceCurrency": "USD", "lowPrice": "0", "highPrice": "79" },
              "description": "Inbox omnicanal, CRM, agentes IA y facturación para PyMEs de LATAM" },
          ]
        })}
      </script>

      <div className="marketing-light-theme relative overflow-hidden bg-[#F7F8FC]">

        {/* Subtle gradient top */}
        <div aria-hidden className="pointer-events-none absolute top-0 inset-x-0 h-[600px] overflow-hidden" style={{ zIndex: 0 }}>
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[480px] w-[900px] rounded-full blur-[140px]"
            style={{ background: "radial-gradient(ellipse, rgba(103,87,232,0.09) 0%, transparent 70%)" }} />
          <div className="absolute -top-20 -right-40 h-[360px] w-[560px] rounded-full blur-[120px]"
            style={{ background: "radial-gradient(ellipse, rgba(99,102,241,0.07) 0%, transparent 70%)" }} />
        </div>

        <main className="relative" style={{ zIndex: 1 }}>

          {/* ════════════════════════════════════════
              NAV
          ════════════════════════════════════════ */}
          <section className="px-4 pt-6 md:px-8">
            <div className="mx-auto max-w-7xl">
              <div className="relative" onClick={handleOutsideClick} onTouchEnd={handleOutsideClick as any}>
                <nav className={cn(
                  "flex items-center justify-between rounded-2xl px-5 py-3.5 md:px-7 transition-all duration-500",
                  scrolled
                    ? "bg-white/95 backdrop-blur-2xl border border-[#E6E8EF] shadow-sm"
                    : "bg-white/80 backdrop-blur-md border border-[#EBEBF0]"
                )}>
                  <BrandLockup compact />
                  <div className="hidden items-center gap-7 lg:flex">
                    {navItems.map(item => (
                      <button key={item.id} type="button" data-nav-button
                        onClick={() => setActiveMenu(c => c === item.key ? null : item.key)}
                        className="font-marketing text-sm font-medium text-gray-500 transition hover:text-gray-900">
                        {copy.nav[item.key]}
                        <ChevronDown className={cn("ml-1 inline h-3.5 w-3.5 text-gray-400 transition", activeMenu === item.key && "rotate-180")} />
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 md:gap-3 flex-shrink-0">
                    <div className="hidden md:flex items-center gap-4">
                      <Link href="/pricing" className="font-marketing text-sm font-medium text-gray-500 transition hover:text-gray-900">{copy.nav.pricing}</Link>
                      <Link href="/documentation" className="font-marketing text-sm font-medium text-gray-500 transition hover:text-gray-900">{copy.nav.documentation}</Link>
                    </div>
                    <Link href="/login" className="font-marketing hidden sm:block text-sm font-medium text-gray-500 transition hover:text-gray-900 px-3">{copy.nav.logIn}</Link>
                    <Link href="/register"
                      className="font-marketing hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                      style={{ background: ACCENT }}>
                      {copy.nav.getStarted}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <button type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                      className="md:hidden text-gray-500 transition hover:text-gray-900">
                      {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                  </div>
                </nav>

                {mobileMenuOpen && (
                  <div className="md:hidden mt-2 rounded-xl border border-[#E6E8EF] bg-white p-3" data-mobile-menu>
                    <div className="space-y-0.5">
                      {[{href:"/product",label:copy.nav.platform},{href:"/insights",label:copy.nav.insights},{href:"/security",label:copy.nav.security}].map(({href,label}) => (
                        <Link key={label} href={href} className="block rounded-lg px-4 py-2.5 font-marketing text-sm font-medium text-gray-600 hover:bg-gray-50">{label}</Link>
                      ))}
                      <div className="my-1.5 border-t border-gray-100" />
                      <Link href="/pricing" className="block rounded-lg px-4 py-2.5 font-marketing text-sm font-medium text-gray-600 hover:bg-gray-50">{copy.nav.pricing}</Link>
                      <Link href="/login" className="block rounded-lg px-4 py-2.5 font-marketing text-sm font-medium text-gray-600 hover:bg-gray-50">{copy.nav.logIn}</Link>
                      <Link href="/register" className="mt-1 block w-full rounded-full px-4 py-2.5 text-center font-marketing text-sm font-semibold text-white" style={{ background: ACCENT }}>
                        {copy.nav.getStarted}
                      </Link>
                    </div>
                  </div>
                )}

                {activeMenu && (
                  <div className="absolute inset-x-0 top-full z-20 pt-2 pointer-events-auto" data-nav-dropdown>
                    <div className="rounded-2xl border border-[#E6E8EF] bg-white/98 backdrop-blur-xl shadow-xl">
                      <div className="px-6 pt-4 pb-1">
                        <p className="font-marketing text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-500">{dropdownMenus[activeMenu].eyebrow}</p>
                        <h2 className="font-marketing mt-0.5 text-xl font-semibold tracking-[-0.02em] text-gray-900">{dropdownMenus[activeMenu].title}</h2>
                      </div>
                      <div className="grid gap-2 p-4 pt-2 lg:grid-cols-[1fr_1.5fr]">
                        <div>
                          <p className="font-marketing text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 px-1 pb-2">{copy.menus[activeMenu].featuredLabel}</p>
                          <MarketingMenuAction {...dropdownMenus[activeMenu].featured} featured onNavigate={() => setActiveMenu(null)} />
                        </div>
                        <div className="space-y-0.5">
                          {dropdownMenus[activeMenu].links.map((item: any) => (
                            <MarketingMenuAction key={item.title} {...item} onNavigate={() => setActiveMenu(null)} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════
              HERO
          ════════════════════════════════════════ */}
          <section className="px-4 pt-16 pb-16 md:px-8 md:pt-24">
            <div className="mx-auto max-w-7xl">
              <div className="mx-auto max-w-3xl text-center">
                <div className="landing-badge inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium mb-6">
                  <span className="h-2 w-2 rounded-full" style={{ background: ACCENT }} />
                  Sistema operativo de atención y ventas para PyMEs
                </div>

                <h1 className="font-marketing text-[2.1rem] leading-[1.08] tracking-[-0.04em] font-bold sm:text-[2.9rem] md:text-[3.6rem] text-gray-900">
                  Atiende clientes, organiza ventas y{" "}
                  <span style={{ color: ACCENT }}>automatiza seguimientos</span>{" "}
                  desde un solo lugar
                </h1>

                <p className="mx-auto mt-5 max-w-2xl text-lg leading-7 text-gray-500 md:text-xl md:leading-8">
                  <TextEffect words="Centraliza WhatsApp, Telegram, email, clientes, tareas y agentes IA para que tu negocio responda más rápido sin perder el control humano." />
                </p>

                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link href="/register"
                    className="font-marketing inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold text-white transition hover:opacity-90"
                    style={{ background: ACCENT, boxShadow: "0 4px 20px rgba(103,87,232,0.30)" }}>
                    Empezar gratis
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="/product"
                    className="font-marketing inline-flex items-center gap-2 rounded-full border border-[#E6E8EF] bg-white px-6 py-3.5 text-base font-semibold text-gray-700 transition hover:border-violet-200">
                    Ver la plataforma
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </Link>
                </div>

                <p className="mt-4 text-sm text-gray-400">Sin tarjeta de crédito · Gratis para comenzar · Cancela cuando quieras</p>

                <div className="mt-7 flex items-center justify-center gap-3">
                  <div className="flex -space-x-2">
                    {[ACCENT,"#6366F1","#4F46E5","#8B5CF6"].map((c, i) => (
                      <span key={i} className="h-7 w-7 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white" style={{ background: c }}>
                        {["AR","BM","CS","DL"][i]}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500">
                    {copy.trustedByPrefix}<span className="font-semibold text-gray-700">{copy.trustedByCount}</span>{copy.trustedBySuffix}
                  </p>
                </div>
              </div>

              {/* Product mockup */}
              <div ref={revealHero} className="reveal-up mx-auto mt-14 max-w-6xl">
                <div className="hidden md:block">
                  <InboxMockup />
                </div>
                {/* Mobile simplified mockup */}
                <div className="md:hidden rounded-xl border border-[#E6E8EF] bg-white overflow-hidden shadow-lg">
                  <div className="flex items-center gap-2 border-b border-[#E6E8EF] bg-[#F7F8FC] px-4 py-2.5">
                    <div className="flex gap-1.5">{["#FF5F57","#FEBC2E","#28C840"].map(c => <span key={c} className="h-2 w-2 rounded-full" style={{ background: c }} />)}</div>
                    <span className="ml-2 text-[11px] text-gray-400">PymesHub — Inbox</span>
                  </div>
                  <div className="p-4 space-y-2.5">
                    {[{ch:"WA",c:"#25D366",n:"María González",m:"Quisiera cotizar 3 locales",badge:"🔥"},{ch:"TG",c:"#229ED9",n:"Carlos Ríos",m:"¿Cuánto cuesta el plan?",badge:null},{ch:"EM",c:"#6366F1",n:"Beatriz Salas",m:"Factura #1042 — pagada",badge:"✓"}].map(row => (
                      <div key={row.n} className="flex items-center gap-3 rounded-xl border border-[#F0F0F5] bg-[#FAFBFE] px-3 py-2.5">
                        <div className="h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: row.c }}>{row.ch}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-gray-800">{row.n}</p>
                          <p className="truncate text-[11px] text-gray-400">{row.m}</p>
                        </div>
                        {row.badge && <span className="text-sm">{row.badge}</span>}
                      </div>
                    ))}
                    <div className="flex items-center gap-2 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2">
                      <Sparkles className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
                      <span className="text-xs text-violet-700 font-medium">Sugerencia IA: Crear cotización para María</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════
              CHANNEL STRIP
          ════════════════════════════════════════ */}
          <section className="py-10 border-y border-[#E6E8EF] bg-white">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 mb-6">
              Conecta tus canales
            </p>
            <InfiniteSlider duration={30} gap={20}>
              {[
                { name: "WhatsApp", color: "#25D366" },
                { name: "Telegram", color: "#2AABEE" },
                { name: "Email", color: "#6757E8" },
                { name: "Instagram", color: "#E1306C" },
                { name: "Web Chat", color: "#FF6B35" },
                { name: "Voz", color: "#10B981" },
                { name: "SMS", color: "#8B5CF6" },
              ].map(({ name, color }) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-2 rounded-full border border-[#E6E8EF] bg-white px-4 py-2 text-sm font-medium text-gray-700 whitespace-nowrap"
                >
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  {name}
                </span>
              ))}
            </InfiniteSlider>
          </section>

          {/* ════════════════════════════════════════
              PROBLEM
          ════════════════════════════════════════ */}
          <section className="px-4 py-20 md:px-8">
            <div className="mx-auto max-w-7xl">
              <div className="mb-14 text-center">
                <p className="landing-eyebrow font-marketing mb-3">El problema</p>
                <h2 className="font-marketing text-3xl font-bold tracking-[-0.04em] text-gray-900 sm:text-4xl">
                  Tu equipo ya trabaja duro.<br className="hidden sm:block" /> El problema es la visibilidad.
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-gray-500">
                  Las PyMEs pierden ventas, tiempo y clientes cada semana porque la operación está fragmentada.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {PROBLEMS.map(({ icon: Icon, color, title, body }) => (
                  <div key={title} className="landing-card rounded-2xl p-6 space-y-4 bg-white border border-[#E6E8EF]">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: color + "12" }}>
                      <Icon className="h-5 w-5" style={{ color }} />
                    </div>
                    <h3 className="font-marketing text-base font-semibold text-gray-900">{title}</h3>
                    <p className="text-sm leading-6 text-gray-500">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════
              SOLUTION FLOW
          ════════════════════════════════════════ */}
          <section className="px-4 py-20 md:px-8 bg-white border-y border-[#E6E8EF]">
            <div className="mx-auto max-w-7xl">
              <div className="mb-14 text-center">
                <p className="landing-eyebrow font-marketing mb-3">La solución</p>
                <h2 className="font-marketing text-3xl font-bold tracking-[-0.04em] text-gray-900 sm:text-4xl">
                  Cada mensaje se convierte<br className="hidden sm:block" /> en trabajo organizado
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-gray-500">
                  PymesHub transforma conversaciones en clientes, tareas, ventas, facturas y seguimientos — con o sin IA.
                </p>
              </div>
              <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:gap-0">
                {FLOW_STEPS.map(({ icon: Icon, label, sub }, i) => (
                  <div key={label} className="relative flex-1 flex flex-col items-center text-center px-2">
                    {i < FLOW_STEPS.length - 1 && (
                      <div className="hidden md:block absolute top-5 left-1/2 w-full h-px" style={{ background: "linear-gradient(to right, rgba(103,87,232,0.2), rgba(103,87,232,0.05))" }} />
                    )}
                    <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-xl mb-3 bg-violet-50 border border-violet-100">
                      <Icon className="h-5 w-5" style={{ color: ACCENT }} />
                    </div>
                    <p className="text-sm font-semibold text-gray-800">{label}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════
              INBOX OMNICANAL
          ════════════════════════════════════════ */}
          <section className="px-4 py-24 md:px-8">
            <div ref={revealInbox} className="reveal-up mx-auto max-w-7xl">
              <div className="grid items-center gap-12 lg:grid-cols-2">
                <div>
                  <p className="landing-eyebrow font-marketing mb-3">Inbox omnicanal</p>
                  <h2 className="font-marketing text-3xl font-bold tracking-[-0.04em] text-gray-900 sm:text-4xl">
                    Un inbox para todos tus canales
                  </h2>
                  <p className="mt-4 text-base leading-7 text-gray-500">
                    Centraliza conversaciones de WhatsApp, Telegram y email en un solo lugar. Filtra por estado, canal, prioridad o intención detectada.
                  </p>
                  <div className="mt-8 space-y-3.5">
                    {[
                      { icon: MessageCircle, label: "Asignación de conversaciones a agentes" },
                      { icon: Users,         label: "Notas internas visibles solo para tu equipo" },
                      { icon: Clock,         label: "Estados de atención en tiempo real" },
                      { icon: BrainCircuit,  label: "Historial completo y datos del cliente" },
                      { icon: FileText,      label: "Plantillas de respuesta rápida" },
                      { icon: ArrowRight,    label: "Escalamiento a humano con un clic" },
                    ].map(({ icon: Icon, label }) => (
                      <div key={label} className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 flex-shrink-0">
                          <Icon className="h-3.5 w-3.5" style={{ color: ACCENT }} />
                        </div>
                        <span className="text-sm font-medium text-gray-700">{label}</span>
                      </div>
                    ))}
                  </div>
                  <Link href="/register" className="mt-8 inline-flex items-center gap-2 font-marketing text-sm font-semibold transition hover:opacity-80" style={{ color: ACCENT }}>
                    Probar el inbox gratis
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="rounded-2xl bg-[#F7F8FC] border border-[#E6E8EF] p-4 overflow-hidden">
                  {/* Filter pills */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {["Todos","Sin responder","Requiere humano","Ventas","Soporte","Facturación"].map((f, i) => (
                      <span key={f} className={cn("rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer",
                        i === 0 ? "text-white" : "border border-[#E6E8EF] bg-white text-gray-500 hover:border-violet-200")}
                        style={i === 0 ? { background: ACCENT } : undefined}>{f}</span>
                    ))}
                  </div>
                  {/* Conversation cards */}
                  <div className="space-y-2">
                    {[
                      { ch: "WA", c: "#25D366", n: "María González",  m: "Quisiera cotizar instalación 3 locales", time: "2m",   state: "Sin responder", urgent: true },
                      { ch: "TG", c: "#229ED9", n: "Carlos Ríos",     m: "¿El plan Business incluye API?",           time: "14m",  state: "En progreso",   urgent: false },
                      { ch: "EM", c: "#6366F1", n: "Beatriz Salas",   m: "Adjunto comprobante de pago",              time: "1h",   state: "Requiere humano",urgent: true },
                      { ch: "WA", c: "#25D366", n: "Juan Pérez",      m: "Buenos días, ¿tienen soporte técnico?",    time: "3h",   state: "Asignado",      urgent: false },
                    ].map(row => (
                      <div key={row.n} className="flex items-start gap-3 rounded-xl border border-[#E6E8EF] bg-white px-3.5 py-3">
                        <div className="h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: row.c }}>{row.ch}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-gray-800 truncate">{row.n}</span>
                            <span className="text-[10px] text-gray-400 flex-shrink-0">{row.time}</span>
                          </div>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{row.m}</p>
                        </div>
                        <span className={cn("flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          row.urgent ? "bg-red-50 text-red-500 border border-red-100" : "bg-gray-50 text-gray-400 border border-gray-100"
                        )}>{row.state}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════
              CUSTOMER INTELLIGENCE
          ════════════════════════════════════════ */}
          <section className="px-4 py-24 md:px-8 bg-white border-y border-[#E6E8EF]">
            <div ref={revealIntel} className="reveal-up mx-auto max-w-7xl">
              <div className="grid items-center gap-12 lg:grid-cols-2">
                {/* Panel mockup */}
                <div className="order-2 lg:order-1">
                  <div className="rounded-2xl border border-[#E6E8EF] bg-[#FAFBFE] overflow-hidden max-w-sm mx-auto">
                    <div className="border-b border-[#E6E8EF] bg-white px-4 py-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Customer Intelligence</span>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* Profile */}
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white text-sm" style={{ background: ACCENT }}>MG</div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">María González</p>
                          <p className="text-xs text-gray-400">Cliente activo · WhatsApp · Buenos Aires</p>
                        </div>
                      </div>
                      {/* Summary */}
                      <div className="rounded-xl border border-[#E6E8EF] bg-white p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Resumen IA</p>
                        <p className="text-sm leading-relaxed text-gray-600">Quiere cotizar instalación para 3 locales la próxima semana. Preguntó por precio, disponibilidad y garantía de los productos.</p>
                      </div>
                      {/* Intent + Urgency */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-orange-100 bg-orange-50/70 p-2.5 text-center">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Intención</p>
                          <p className="text-xs font-bold text-orange-600">🔥 Venta caliente</p>
                        </div>
                        <div className="rounded-xl border border-red-100 bg-red-50/70 p-2.5 text-center">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Urgencia</p>
                          <p className="text-xs font-bold text-red-500">Alta</p>
                        </div>
                      </div>
                      {/* Next action */}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Próxima acción</p>
                        <button className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90" style={{ background: ACCENT }}>
                          + Crear cotización
                        </button>
                        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                          <button className="rounded-xl border border-[#E6E8EF] bg-white py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">+ Crear tarea</button>
                          <button className="rounded-xl border border-[#E6E8EF] bg-white py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">Asignar humano</button>
                        </div>
                      </div>
                      {/* AI status */}
                      <div className="flex items-center justify-between rounded-xl border border-[#E6E8EF] bg-white px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-amber-500" />
                          <span className="text-xs font-medium text-gray-700">IA activa</span>
                        </div>
                        <button className="text-[11px] font-semibold text-gray-500 underline underline-offset-2 hover:text-gray-800">Pausar</button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="order-1 lg:order-2">
                  <p className="landing-eyebrow font-marketing mb-3">Customer Intelligence</p>
                  <h2 className="font-marketing text-3xl font-bold tracking-[-0.04em] text-gray-900 sm:text-4xl">
                    Cada conversación<br />viene con contexto
                  </h2>
                  <p className="mt-4 text-base leading-7 text-gray-500">
                    PymesHub resume la conversación, detecta la intención del cliente, muestra su historial y sugiere la próxima acción. Todo en tiempo real.
                  </p>
                  <div className="mt-8 space-y-3.5">
                    {[
                      "Resumen automático generado por IA después de cada conversación",
                      "Detección de intención: venta, soporte, facturación o cita",
                      "Nivel de urgencia y riesgo calculado en contexto",
                      "Próxima acción recomendada con botones de ejecución",
                      "Historial de compras, facturas, tareas y conversaciones anteriores",
                      "Control de IA: activa, pausada o requiere aprobación",
                    ].map(item => (
                      <div key={item} className="flex items-start gap-3">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: ACCENT }} />
                        <span className="text-sm text-gray-600">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════
              AGENTS
          ════════════════════════════════════════ */}
          <section className="px-4 py-24 md:px-8">
            <div ref={revealAgent} className="reveal-up mx-auto max-w-7xl">
              <div className="mb-14 text-center">
                <p className="landing-eyebrow font-marketing mb-3">Agentes IA</p>
                <h2 className="font-marketing text-3xl font-bold tracking-[-0.04em] text-gray-900 sm:text-4xl">
                  Agentes que ayudan,<br className="hidden sm:block" /> no que toman el control
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-500">
                  Configura agentes para ventas, soporte y facturación. Define qué pueden responder, cuándo deben escalar y qué acciones requieren aprobación humana.
                </p>
              </div>

              <div className="flex justify-center gap-2 mb-8 flex-wrap">
                {[{k:"sales",l:"Ventas"},{k:"support",l:"Soporte"},{k:"billing",l:"Facturación"}].map(({k,l}) => (
                  <button key={k} type="button" onClick={() => setAgentTab(k as any)}
                    className={cn("rounded-full px-4 py-2 text-sm font-semibold transition",
                      agentTab === k ? "text-white" : "border border-[#E6E8EF] bg-white text-gray-600 hover:border-violet-200")}
                    style={agentTab === k ? { background: ACCENT } : undefined}>
                    {l}
                  </button>
                ))}
              </div>

              <div className="mx-auto max-w-md">
                <AgentMockup type={agentTab} />
              </div>

              <div className="mt-12 grid gap-4 md:grid-cols-3">
                {[
                  { icon: Workflow, title: "Reglas de comportamiento", body: "Define qué puede responder, a qué hora opera y qué temas son exclusivos para humanos." },
                  { icon: AlertTriangle, title: "Límites declarados", body: "El agente nunca da descuentos no autorizados, modifica pagos ni accede a datos fuera de su alcance." },
                  { icon: CheckCircle2, title: "Aprobación para lo crítico", body: "Acciones como crear facturas, modificar precios o escalar casos siempre pasan por tu equipo." },
                ].map(({ icon: Icon, title, body }) => (
                  <div key={title} className="rounded-2xl border border-[#E6E8EF] bg-white p-5 space-y-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50">
                      <Icon className="h-4.5 w-4.5" style={{ color: ACCENT }} />
                    </div>
                    <h3 className="font-marketing text-sm font-semibold text-gray-900">{title}</h3>
                    <p className="text-sm leading-6 text-gray-500">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════
              USE CASES
          ════════════════════════════════════════ */}
          <section className="px-4 py-24 md:px-8 bg-white border-y border-[#E6E8EF]">
            <div className="mx-auto max-w-7xl">
              <div className="mb-14 text-center">
                <p className="landing-eyebrow font-marketing mb-3">Casos de uso</p>
                <h2 className="font-marketing text-3xl font-bold tracking-[-0.04em] text-gray-900 sm:text-4xl">
                  Lo que tu negocio hace<br className="hidden sm:block" /> todos los días, optimizado
                </h2>
              </div>

              <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
                <div className="flex flex-row gap-2 lg:flex-col lg:gap-1">
                  {USE_CASES.map(c => (
                    <button key={c.key} type="button" onClick={() => setActiveCase(c.key)}
                      className={cn("flex-1 lg:flex-none rounded-xl px-4 py-3 text-left text-sm font-semibold transition",
                        activeCase === c.key ? "text-white" : "text-gray-600 hover:bg-[#F7F8FC]")}
                      style={activeCase === c.key ? { background: ACCENT } : undefined}>
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="rounded-2xl border border-[#E6E8EF] bg-[#FAFBFE] p-6 lg:p-8">
                  <h3 className="font-marketing text-lg font-semibold text-gray-900 mb-6">{currentCase.label}</h3>
                  <ol className="space-y-4">
                    {currentCase.steps.map((step, i) => (
                      <li key={step} className="flex items-start gap-4">
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: ACCENT }}>
                          {i + 1}
                        </span>
                        <span className="text-sm leading-6 text-gray-700 pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════
              SECURITY
          ════════════════════════════════════════ */}
          <section className="px-4 py-24 md:px-8">
            <div ref={revealSec} className="reveal-up mx-auto max-w-7xl">
              <div className="mb-14 text-center">
                <p className="landing-eyebrow font-marketing mb-3">Seguridad y control</p>
                <h2 className="font-marketing text-3xl font-bold tracking-[-0.04em] text-gray-900 sm:text-4xl">
                  Automatización con límites claros
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-500">
                  Tus agentes IA pueden sugerir. Vos decidís qué acciones críticas se ejecutan. Diseñado para negocios que manejan clientes reales, pagos e información sensible.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {SECURITY_ITEMS.map(({ icon: Icon, title, body }) => (
                  <div key={title} className="rounded-2xl border border-[#E6E8EF] bg-white p-5 space-y-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F7F8FC] border border-[#E6E8EF]">
                      <Icon className="h-4.5 w-4.5 text-gray-600" />
                    </div>
                    <h3 className="font-marketing text-sm font-semibold text-gray-900">{title}</h3>
                    <p className="text-sm leading-6 text-gray-500">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════
              INTEGRATIONS
          ════════════════════════════════════════ */}
          <section className="px-4 py-20 md:px-8 bg-white border-y border-[#E6E8EF]">
            <div ref={revealInt} className="reveal-up mx-auto max-w-7xl">
              <div className="mb-12 text-center">
                <p className="landing-eyebrow font-marketing mb-3">Integraciones</p>
                <h2 className="font-marketing text-2xl font-bold tracking-[-0.03em] text-gray-900 sm:text-3xl">
                  Conecta los canales que tu negocio ya usa
                </h2>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {INTEGRATIONS.map(({ name, color, initial, note }) => (
                  <div key={name} className="flex items-center gap-3 rounded-2xl border border-[#E6E8EF] bg-white px-4 py-3 hover:border-violet-200 transition-colors cursor-default">
                    <div className="h-9 w-9 flex-shrink-0 rounded-xl flex items-center justify-center text-xs font-bold text-white" style={{ background: color }}>{initial}</div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{name}</p>
                      <p className="text-[11px] text-gray-400">{note}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-center text-xs text-gray-400">
                WhatsApp Business requiere cuenta Meta Business verificada y configuración del número oficial.
              </p>
            </div>
          </section>

          {/* ════════════════════════════════════════
              FAQ
          ════════════════════════════════════════ */}
          <section className="px-4 py-24 md:px-8">
            <div ref={revealFaq} className="reveal-up mx-auto max-w-3xl">
              <div className="mb-12 text-center">
                <p className="landing-eyebrow font-marketing mb-3">FAQ</p>
                <h2 className="font-marketing text-3xl font-bold tracking-[-0.04em] text-gray-900">
                  Preguntas frecuentes
                </h2>
              </div>
              <div className="rounded-2xl border border-[#E6E8EF] bg-white px-6 divide-y divide-[#F0F0F5]">
                {FAQS.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════
              CTA FINAL
          ════════════════════════════════════════ */}
          <section className="px-4 py-24 md:px-8">
            <div ref={revealCta} className="reveal-up mx-auto max-w-4xl">
              <div className="rounded-3xl border border-violet-100 bg-white p-1" style={{ boxShadow: "0 8px 40px rgba(103,87,232,0.08)" }}>
                <div className="rounded-[calc(1.5rem-4px)] px-8 py-16 text-center md:px-16" style={{ background: "linear-gradient(145deg, rgba(103,87,232,0.04) 0%, #FFFFFF 60%)" }}>
                  <div className="landing-badge inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
                    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: ACCENT }} />
                    Sin tarjeta de crédito · Plan gratuito siempre disponible
                  </div>
                  <h2 className="font-marketing text-3xl font-bold tracking-[-0.04em] text-gray-900 sm:text-4xl md:text-5xl mb-4">
                    Empieza con lo esencial.<br className="hidden sm:block" /> Escala cuando crezcas.
                  </h2>
                  <p className="mx-auto max-w-lg text-base leading-7 text-gray-500 mb-8">
                    PymesHub funciona desde el día uno. Sin setup complejo, sin contratos anuales, sin promesas de "10x productividad".
                  </p>
                  <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Link href="/register"
                      className="font-marketing inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white transition hover:opacity-90"
                      style={{ background: ACCENT, boxShadow: "0 4px 20px rgba(103,87,232,0.28)" }}>
                      Empezar gratis
                      <ArrowRight className="h-5 w-5" />
                    </Link>
                    <Link href="/pricing"
                      className="font-marketing inline-flex items-center gap-2 rounded-full border border-[#E6E8EF] bg-white px-7 py-4 text-base font-semibold text-gray-700 transition hover:border-violet-200">
                      Ver planes
                    </Link>
                  </div>
                  <p className="mt-6 text-sm text-gray-400">
                    Diseñado para PyMEs que atienden, venden y dan seguimiento todos los días.
                  </p>
                </div>
              </div>
            </div>
          </section>

        </main>

        {/* SEO Hub */}
        {copy.seoHub && (
          <section className="border-t border-[#E6E8EF] px-4 py-16 md:px-8 bg-white">
            <div className="mx-auto max-w-7xl text-center">
              <p className="landing-eyebrow font-marketing mb-3">{copy.seoHub.eyebrow}</p>
              <h2 className="font-marketing text-2xl font-semibold tracking-[-0.03em] text-gray-900">{copy.seoHub.title}</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-gray-400">{copy.seoHub.description}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {copy.seoHub.links.map((link: { href: string; label: string }) => (
                  <Link key={link.href} href={link.href}
                    className="rounded-full border border-[#E6E8EF] bg-white px-4 py-2 text-sm text-gray-500 transition hover:border-violet-200 hover:text-gray-800">
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
