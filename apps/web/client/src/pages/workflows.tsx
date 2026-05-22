import { Link } from "wouter";
import { ArrowLeft, Workflow, Sparkles, Zap, FileText, MessageCircle, Bot, ExternalLink } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { Footer } from "@/components/marketing/footer";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

export default function WorkflowsPage() {
  const { messages } = useI18n();
  const copy = messages.landing?.menus?.workflows || {} as any;

  return (
    <div className="dark relative min-h-screen overflow-hidden bg-background text-white">
      <div className="pointer-events-none absolute inset-0"><div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(42,60,180,0.08),transparent_36%)]" /></div>
      <main className="relative z-10">
        <nav className="flex items-center justify-between px-4 py-5 md:px-8">
          <Link href="/"><BrandLockup compact /></Link>
          <div className="flex items-center gap-2 md:gap-4">
            <LanguageSwitcher variant="marketing" />
            <Link href="/product" className="font-marketing text-sm font-medium text-white/78 hover:text-white"><ArrowLeft className="h-4 w-4 inline mr-1" />Producto</Link>
          </div>
        </nav>
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.08fr_0.92fr]">
            <article className="glass-panel rounded-[34px] p-8 md:p-10">
              <p className="font-marketing text-sm font-semibold uppercase tracking-[0.36em] text-[#F59E0B]/72">{copy.eyebrow || "Operational flows"}</p>
              <h1 className="font-marketing mt-5 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">{copy.title || "Move handoffs forward without losing context."}</h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[#c9d0f5]/70">{copy.description || "Guide teams from inbound message to invoice, onboarding, and support with one shared thread."}</p>
            </article>
            <div className="space-y-4">
              {[{ icon: MessageCircle, title: "Inbox Unificado", desc: "WhatsApp, Email, Telegram, formularios y API en un solo lugar." },
                { icon: Workflow, title: "Routing Inteligente", desc: "Keywords y menús dirigen mensajes al departamento correcto automáticamente." },
                { icon: Zap, title: "Automatizaciones", desc: "Reglas de workflow: triggers, condiciones y acciones sin código." },
                { icon: Bot, title: "HubbyAgent IA", desc: "Asistente inteligente que crea contactos, tareas, analiza datos y responde." },
                { icon: FileText, title: "Documentos y OCR", desc: "Subí archivos, extraé texto con IA y vinculalos a conversaciones." },
                { icon: Sparkles, title: "Insights Automáticos", desc: "Alertas accionables basadas en tus datos mes a mes." }].map(({ icon: Icon, title, desc }) => (
                <article key={title} className="glass-panel rounded-2xl p-5 flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/50"><Icon className="h-5 w-5" /></div>
                  <div><h3 className="font-marketing text-sm font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-[#bcc5ee]/72">{desc}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 md:px-8 md:pb-24">
          <div className="mx-auto max-w-7xl">
            <h2 className="font-marketing text-3xl font-bold tracking-[-0.04em] text-white text-center">Recursos operativos</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                { href: "/documentation/support-policy", title: "Política de Soporte", desc: "Canales, prioridades, escalamiento y cierre de solicitudes." },
                { href: "/documentation/workspace-launch-guide", title: "Guía de Lanzamiento", desc: "Roles, canales, departamentos y checklist pre-go-live." },
                { href: "/documentation/sla", title: "SLA Base", desc: "Disponibilidad objetivo, mantenimientos e incidentes críticos." },
                { href: "/documentation/platform-overview", title: "Visión General", desc: "Cómo se conectan inbox, billing, pipeline y docs." },
              ].map(({ href, title, desc }) => (
                <Link key={href} href={href} className="group flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.04]">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white group-hover:text-white/90">
                      {title}
                      <ExternalLink className="h-3.5 w-3.5 text-white/30" />
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-white/40">{desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
