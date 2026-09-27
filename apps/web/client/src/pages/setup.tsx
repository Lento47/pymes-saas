import { useState } from 'react';
import { Link } from 'wouter';
import {
  ArrowRight,
  Store,
  Check,
  CreditCard,
  FileBadge,
  MapPin,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Footer } from '@/components/marketing/footer';
import { BrandLockup } from '@/components/marketing/brand-lockup';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { cn } from '@/lib/utils';

interface PrerequisiteCheckItem {
  text: string;
}

interface PrerequisiteTab {
  value: string;
  label: string;
  icon: typeof Store;
  title: string;
  description: string;
  why: string;
  checklist: PrerequisiteCheckItem[];
  ctaLabel: string;
  ctaHref: string;
  helpHref?: string;
}

const TABS: PrerequisiteTab[] = [
  {
    value: 'business',
    label: 'Tu negocio',
    icon: Store,
    title: 'Registrá tu comercio',
    description:
      'Para vender en PymesHub necesitamos los datos básicos de tu negocio: nombre, categoría, teléfono y una descripción corta de lo que vendés. Es lo que ven tus clientes antes de pedir.',
    why: 'Un perfil completo genera más confianza: los comercios con foto y descripción reciben más pedidos que los que aparecen vacíos.',
    checklist: [
      { text: 'Nombre del comercio tal como lo conocen tus clientes.' },
      { text: 'Categoría: soda, restaurante, pulpería, farmacia, ferretería u otra.' },
      { text: 'Teléfono de contacto y horario de atención.' },
      { text: 'Descripción corta de lo que vendés (2 o 3 líneas bastan).' },
    ],
    ctaLabel: 'Registrar mi comercio',
    ctaHref: '/register',
  },
  {
    value: 'catalog',
    label: 'Catálogo',
    icon: FileBadge,
    title: 'Armá tu catálogo',
    description:
      'Tu catálogo es tu vitrina: productos con nombre, precio y descripción. Podés editarlo cuando quieras; los cambios se ven al instante para tus clientes.',
    why: 'Un catálogo claro evita las preguntas de "¿cuánto cuesta?" por WhatsApp y los pedidos que llegan incompletos.',
    checklist: [
      { text: 'Lista de productos o platos con sus precios en colones.' },
      { text: 'Descripción corta por producto (ingredientes, tamaño, etc.).' },
      { text: 'Fotos de tus productos estrella, si las tenés.' },
      { text: 'Disponibilidad: qué vendés todos los días y qué solo a veces.' },
    ],
    ctaLabel: 'Empezar gratis',
    ctaHref: '/register',
  },
  {
    value: 'plan',
    label: 'Plan',
    icon: CreditCard,
    title: 'Elegí tu plan',
    description:
      'PymesHub cobra una cuota mensual plana según el volumen de pedidos — sin comisión por venta. El pago se configura una sola vez y soporta colones (CRC) y dólares (USD).',
    why: 'Sin comisión por pedido: lo que vendés es tuyo. El plan cubre el uso de la plataforma, no un porcentaje de tus ventas.',
    checklist: [
      { text: 'Estimá tus pedidos por mes para elegir el plan correcto.' },
      { text: 'Definí si preferís facturación mensual o anual (descuento ~17%).' },
      { text: 'Revisá los add-ons: avisos por WhatsApp, inventario, reportes.' },
      { text: 'Tené a mano una tarjeta para el pago recurrente.' },
    ],
    ctaLabel: 'Ver planes',
    ctaHref: '/pricing',
  },
  {
    value: 'delivery',
    label: 'Entrega',
    icon: MapPin,
    title: 'Definí tu zona de entrega',
    description:
      'Vos decidís hasta dónde entregás y en qué horarios aceptás pedidos. Los clientes fuera de tu radio pueden usar retiro en tienda.',
    why: 'Una zona de entrega clara evita rechazos: los pedidos que llegan ya están dentro de tu cobertura.',
    checklist: [
      { text: 'Radio de entrega en kilómetros, o los barrios que cubrís.' },
      { text: 'Costo de entrega (fijo o por distancia).' },
      { text: 'Horario en el que aceptás pedidos.' },
      { text: 'Tiempo aproximado de preparación por pedido.' },
    ],
    ctaLabel: 'Empezar gratis',
    ctaHref: '/register',
  },
];

export default function SetupPage() {
  const [active, setActive] = useState<string>(TABS[0].value);

  return (
    <div className="dark marketing-canvas relative min-h-screen text-white">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,9,29,0)_0%,rgba(5,9,29,0.10)_42%,#05091d_96%)]" />
        <div className="animate-drift-x absolute left-[-10rem] top-[8rem] h-80 w-80 rounded-full bg-[#5771ff]/20 blur-[110px]" />
        <div className="animate-pulse-halo absolute right-[-5rem] top-[18rem] h-96 w-96 rounded-full bg-[#F59E0B]/10 blur-[130px]" />
        <div className="marketing-grid absolute inset-x-0 top-[18rem] h-[46rem] opacity-45" />
      </div>

      <main className="relative z-10">
        {/* Navigation */}
        <section className="px-4 pb-8 pt-6 md:px-8">
          <div className="mx-auto max-w-7xl">
            <nav className="glass-panel luminous-border flex flex-wrap items-center justify-between gap-2 rounded-full px-5 py-4 md:px-7">
              <Link href="/">
                <BrandLockup compact />
              </Link>
              <div className="flex flex-shrink-0 items-center gap-2 sm:gap-4">
                <LanguageSwitcher variant="marketing" />
                <Link
                  href="/login"
                  className="font-marketing whitespace-nowrap text-sm font-medium text-white/78 transition hover:text-white"
                >
                  Ingresar
                </Link>
                <Link
                  href="/register"
                  className="glow-button font-marketing inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[linear-gradient(90deg,#F59E0B_0%,#D97706_55%,#B45309_100%)] px-3 py-2 text-xs font-semibold text-[#071126] transition hover:translate-y-[-1px] sm:gap-2 sm:px-4 sm:py-3 sm:text-sm md:px-6"
                >
                  Comenzar
                  <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </Link>
              </div>
            </nav>
          </div>
        </section>

        {/* Hero */}
        <section className="px-4 pb-10 pt-6 md:px-8 md:pb-16 md:pt-12">
          <div className="mx-auto max-w-4xl text-center">
            <p className="font-marketing inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-white/70">
              <Store className="h-3.5 w-3.5" />
              Para comercios
            </p>
            <h1 className="font-marketing mt-6 text-3xl font-extrabold leading-[1.1] tracking-[-0.03em] text-white sm:text-4xl md:text-5xl">
              Antes de vender en PymesHub
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/70 md:text-xl">
              Con estas cuatro piezas listas, tu comercio puede recibir su
              primer pedido el mismo día.
            </p>
          </div>
        </section>

        {/* Tabs */}
        <section className="px-4 pb-20 md:px-8">
          <div className="mx-auto max-w-5xl">
            <Tabs value={active} onValueChange={setActive} className="w-full">
              <TabsList className="mb-8 grid h-auto w-full grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2 md:grid-cols-4">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <TabsTrigger
                      key={t.value}
                      value={t.value}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium text-white/70 transition',
                        'data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-none',
                        'hover:text-white',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{t.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <TabsContent key={t.value} value={t.value} className="mt-0 focus-visible:ring-0">
                    <div className="glass-panel rounded-3xl border border-white/10 p-6 md:p-10">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F59E0B]/10 text-[#F59E0B]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <h2 className="font-marketing text-2xl font-bold tracking-[-0.02em] text-white md:text-3xl">
                          {t.title}
                        </h2>
                      </div>

                      <p className="mt-4 text-base leading-relaxed text-white/75 md:text-lg">
                        {t.description}
                      </p>

                      <div className="mt-6 rounded-2xl border border-[#F59E0B]/20 bg-[#F59E0B]/[0.06] p-4 text-sm leading-relaxed text-white/80 md:p-5">
                        <strong className="font-semibold text-[#F59E0B]">Por qué importa:</strong>{' '}
                        {t.why}
                      </div>

                      <div className="mt-8">
                        <h3 className="font-marketing text-sm font-semibold uppercase tracking-[0.2em] text-white/60">
                          Lo que necesitás tener listo
                        </h3>
                        <ul className="mt-4 space-y-3">
                          {t.checklist.map((item) => (
                            <li key={item.text} className="flex items-start gap-3">
                              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F59E0B]/15 text-[#F59E0B]">
                                <Check className="h-3 w-3" />
                              </span>
                              <span className="text-sm leading-relaxed text-white/85 md:text-base">
                                {item.text}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-white/10 pt-6">
                        <Link
                          href={t.ctaHref}
                          className="glow-button font-marketing inline-flex items-center gap-2 rounded-full bg-[linear-gradient(90deg,#F59E0B_0%,#D97706_55%,#B45309_100%)] px-5 py-3 text-sm font-semibold text-[#071126] transition hover:translate-y-[-1px]"
                        >
                          {t.ctaLabel}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                        {t.helpHref && (
                          <Link
                            href={t.helpHref}
                            className="font-marketing inline-flex items-center gap-2 text-sm font-medium text-white/70 transition hover:text-white"
                          >
                            Ver guía detallada
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>

            {/* Bottom CTA */}
            <div className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center md:p-10">
              <h2 className="font-marketing text-2xl font-bold tracking-[-0.02em] text-white md:text-3xl">
                ¿Listo para vender?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-base text-white/70 md:text-lg">
                Registrá tu comercio gratis. Sin comisión por pedido: cobrás como siempre, en efectivo o en línea.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/register"
                  className="glow-button font-marketing inline-flex items-center gap-2 rounded-full bg-[linear-gradient(90deg,#F59E0B_0%,#D97706_55%,#B45309_100%)] px-6 py-3 text-sm font-semibold text-[#071126] transition hover:translate-y-[-1px]"
                >
                  Registrar mi comercio
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/pricing"
                  className="font-marketing inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white/85 transition hover:bg-white/[0.05]"
                >
                  Ver planes
                </Link>
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
