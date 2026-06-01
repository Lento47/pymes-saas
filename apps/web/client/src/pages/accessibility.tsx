import { Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { Footer } from "@/components/marketing/footer";

const ACCENT = "#6757E8";

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/"><BrandLockup compact /></Link>
          <Link href="/legal" className="text-sm text-muted-foreground hover:text-foreground transition">Centro Legal</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-16 md:px-8">
        <div className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: ACCENT }}>Accesibilidad</p>
          <h1 className="font-marketing text-2xl font-bold tracking-tight text-foreground sm:text-3xl mb-4">
            Declaración de Accesibilidad
          </h1>
          <p className="text-sm text-muted-foreground">Última actualización: {new Date().toLocaleDateString("es-CR", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>

        <div className="space-y-6 text-sm leading-7 text-muted-foreground">

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-marketing text-base font-semibold text-foreground mb-3">Nuestro compromiso</h2>
            <p>
              PymesHub trabaja para que su sitio web y aplicación sean accesibles para la mayor cantidad de personas posible, independientemente de sus capacidades, tecnología asistiva utilizada o contexto de uso.
            </p>
            <p className="mt-3">
              Nuestro objetivo es alinearnos progresivamente con los estándares internacionales de accesibilidad web <strong>WCAG 2.2</strong> (Web Content Accessibility Guidelines), con meta de alcanzar conformidad <strong>nivel AA</strong>, así como con los principios de igualdad de acceso establecidos en la <strong>Ley 7600 — Ley de Igualdad de Oportunidades para las Personas con Discapacidad</strong> de Costa Rica.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-marketing text-base font-semibold text-foreground mb-4">Estado actual</h2>
            <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 mb-4">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-warning mt-0.5" />
              <p className="text-sm text-warning">
                PymesHub se encuentra en proceso activo de mejora de accesibilidad. Aún no hemos completado una auditoría formal completa bajo WCAG 2.2. Esta declaración refleja nuestro compromiso y progreso actual.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { done: true,  item: "Contraste de color suficiente en textos principales (WCAG 1.4.3)" },
                { done: true,  item: "Navegación por teclado en componentes principales" },
                { done: true,  item: "Etiquetas ARIA en formularios críticos" },
                { done: true,  item: "Textos alternativos en imágenes informativas" },
                { done: false, item: "Auditoría completa WCAG 2.2 AA (en progreso)" },
                { done: false, item: "Soporte completo para lectores de pantalla en flujos complejos" },
                { done: false, item: "Subtítulos en contenido de video (en progreso)" },
              ].map(({ done, item }) => (
                <div key={item} className="flex items-start gap-2.5">
                  {done
                    ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-success" />
                    : <div className="h-4 w-4 flex-shrink-0 mt-0.5 rounded-full border-2 border-border" />
                  }
                  <span className={done ? "text-foreground" : "text-muted-foreground"}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-marketing text-base font-semibold text-foreground mb-3">Tecnologías asistivas compatibles</h2>
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

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-marketing text-base font-semibold text-foreground mb-3">Marco legal — Costa Rica</h2>
            <p>Esta declaración hace referencia a las siguientes normativas:</p>
            <ul className="mt-3 space-y-2">
              {[
                { name: "Ley 7600", desc: "Ley de Igualdad de Oportunidades para las Personas con Discapacidad (Costa Rica)" },
                { name: "Reglamento Ley 7600", desc: "Principios de igualdad de acceso, accesibilidad y no discriminación" },
                { name: "WCAG 2.2", desc: "Web Content Accessibility Guidelines del W3C" },
              ].map(({ name, desc }) => (
                <li key={name} className="flex items-start gap-2">
                  <span className="font-semibold text-foreground flex-shrink-0">{name}:</span>
                  <span className="text-muted-foreground">{desc}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: ACCENT }} />
              <div>
                <h2 className="font-marketing text-base font-semibold text-foreground mb-2">Reportar un problema de accesibilidad</h2>
                <p className="mb-3">
                  Si encontrás una barrera de accesibilidad en PymesHub, por favor informanos. Tu reporte nos ayuda a mejorar la experiencia para todos.
                </p>
                <a href="mailto:accesibilidad@pymeshub.com"
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ background: ACCENT }}>
                  <Mail className="h-4 w-4" />
                  accesibilidad@pymeshub.com
                </a>
                <p className="mt-3 text-xs text-muted-foreground">
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
