import { Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { Footer } from "@/components/marketing/footer";

const ACCENT = "#F59E0B";

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-[#05091d] text-white">
      <header className="border-b border-white/10 bg-[#05091d] px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/"><BrandLockup compact textClassName="text-white" /></Link>
          <Link href="/legal" className="text-sm text-slate-400 hover:text-white transition">Centro Legal</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-16 md:px-8">
        <div className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: ACCENT }}>Accesibilidad</p>
          <h1 className="font-marketing text-2xl font-bold tracking-tight text-white sm:text-3xl mb-4">
            Declaración de Accesibilidad
          </h1>
          <p className="text-sm text-slate-400">Última actualización: {new Date().toLocaleDateString("es-CR", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>

        <div className="space-y-6 text-sm leading-7 text-slate-300">

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="font-marketing text-base font-semibold text-white mb-3">Nuestro compromiso</h2>
            <p className="mb-3">PymesHub se compromete a que su plataforma sea accesible para todas las personas, independientemente de su capacidad o tecnología de asistencia.</p>
            <p>Queremos que pedir de los negocios de tu barrio sea posible para todos, y trabajamos de forma continua para cumplir con las pautas WCAG 2.2 nivel AA.</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="font-marketing text-base font-semibold text-white mb-3">Medidas adoptadas</h2>
            <div className="space-y-2">
              {[
                "Navegación completa por teclado en todo el flujo de pedido",
                "Contraste de color conforme a WCAG 2.2 AA",
                "Etiquetas y roles ARIA en formularios y controles",
                "Texto escalable sin pérdida de funcionalidad",
                "Estados de foco visibles en todos los controles interactivos",
                "Respeto por la preferencia de movimiento reducido del sistema",
              ].map((item, i) => {
                const done = i >= 0;
                return (
                  <div key={item} className="flex items-start gap-2">
                    {done
                      ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-400" />
                      : <div className="h-4 w-4 flex-shrink-0 mt-0.5 rounded-full border-2 border-white/25" />
                    }
                    <span className={done ? "text-slate-200" : "text-slate-500"}>{item}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="font-marketing text-base font-semibold text-white mb-3">Tecnologías asistivas compatibles</h2>
            <p className="mb-3">Trabajamos para que PymesHub sea compatible con las siguientes tecnologías:</p>
            <ul className="space-y-1.5">
              {["Lectores de pantalla (NVDA, JAWS, VoiceOver, TalkBack)","Navegación por teclado","Ampliación de pantalla (hasta 200%)","Modo de alto contraste del sistema operativo","Control por voz"].map(t => (
                <li key={t} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: ACCENT }} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="font-marketing text-base font-semibold text-white mb-3">Marco legal — Costa Rica</h2>
            <p>Esta declaración hace referencia a las siguientes normativas:</p>
            <ul className="mt-3 space-y-2">
              {[
                { name: "Ley 7600", desc: "Ley de Igualdad de Oportunidades para las Personas con Discapacidad (Costa Rica)" },
                { name: "Reglamento Ley 7600", desc: "Principios de igualdad de acceso, accesibilidad y no discriminación" },
                { name: "WCAG 2.2", desc: "Web Content Accessibility Guidelines del W3C" },
              ].map(({ name, desc }) => (
                <li key={name} className="flex items-start gap-2">
                  <span className="font-semibold text-white flex-shrink-0">{name}:</span>
                  <span className="text-slate-400">{desc}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-[#F59E0B]/20 bg-[#F59E0B]/5 p-6">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: ACCENT }} />
              <div>
                <h2 className="font-marketing text-base font-semibold text-white mb-2">Reportar un problema de accesibilidad</h2>
                <p className="mb-3">
                  Si encontrás una barrera de accesibilidad en PymesHub, por favor informanos. Tu reporte nos ayuda a mejorar la experiencia para todos.
                </p>
                <a href="mailto:accesibilidad@pymeshub.lat"
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-[#05091d] transition hover:opacity-90"
                  style={{ background: ACCENT }}>
                  <Mail className="h-4 w-4" />
                  accesibilidad@pymeshub.lat
                </a>
                <p className="mt-3 text-xs text-slate-400">
                  Intentamos responder a reportes de accesibilidad dentro de <strong>5 días hábiles</strong>.
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
