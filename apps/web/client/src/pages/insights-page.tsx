import { Link } from "wouter";
import { ArrowLeft, ChartSpline, BrainCircuit, TrendingUp, AlertTriangle, CheckCircle2, BarChart2 } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

export default function InsightsPage() {
  const { messages } = useI18n();
  const copy = messages.landing?.menus?.insights || {} as any;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05091d] text-white">
      <div className="pointer-events-none absolute inset-0"><div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(42,60,180,0.08),transparent_36%)]" /></div>
      <main className="relative z-10">
        <nav className="flex items-center justify-between px-4 py-5 md:px-8">
          <Link href="/"><a><BrandLockup compact /></a></Link>
          <div className="flex items-center gap-2 md:gap-4">
            <LanguageSwitcher variant="marketing" />
            <Link href="/product"><a className="font-marketing text-sm font-medium text-white/78 hover:text-white"><ArrowLeft className="h-4 w-4 inline mr-1" />Producto</a></Link>
          </div>
        </nav>
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="font-marketing text-sm font-semibold uppercase tracking-[0.36em] text-[#dfff4a]/72">{copy.eyebrow || "Data that speaks"}</p>
              <h1 className="font-marketing mt-5 text-5xl font-extrabold leading-[0.96] tracking-[-0.05em] sm:text-6xl md:text-[5rem]">{copy.title || "Insights that tell you what to fix before you ask."}</h1>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[#c9d0f5]/70 md:text-lg">{copy.description || "Stop guessing. Get severity-ranked alerts with suggested actions based on real operational data."}</p>
            </div>
            <div className="mt-16 grid gap-6 md:grid-cols-3">
              {[{ icon: AlertTriangle, color: "#ef4444", title: "Peligro", desc: "Alertas críticas que requieren acción inmediata.", example: "42% de tareas vencidas" },
                { icon: TrendingUp, color: "#f59e0b", title: "Alerta", desc: "Situaciones que necesitan atención pronto.", example: "7 conversaciones sin agente asignado" },
                { icon: CheckCircle2, color: "#22c55e", title: "Positivo", desc: "Métricas que mejoraron respecto al período anterior.", example: "22% más tareas completadas" },
                { icon: BarChart2, color: "#3b82f6", title: "Info", desc: "Datos contextuales para planificar.", example: "Volumen de mensajes subió 28%" },
                { icon: BrainCircuit, color: "#8b5cf6", title: "IA + Humanos", desc: "La IA sugiere, vos decidís. Revisión humana en decisiones clave.", example: "Recomendación de staffing" },
                { icon: ChartSpline, color: "#ec4899", title: "Tendencias", desc: "Comparación mes a mes para ver evolución real.", example: "Ingresos, contactos, conversaciones" }].map(({ icon: Icon, color, title, desc, example }) => (
                <article key={title} className="glass-panel rounded-[28px] p-7">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl p-2" style={{ background: `${color}20` }}><Icon className="h-6 w-6" style={{ color }} /></div>
                  <h3 className="font-marketing mt-6 text-xl font-semibold tracking-[-0.03em]">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#bcc5ee]/72">{desc}</p>
                  <p className="mt-4 text-xs font-mono px-2 py-1 rounded-lg inline-block" style={{ background: `${color}10`, color }}>{example}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
