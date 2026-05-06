import { useState } from 'react';
import { Link } from 'wouter';
import {
  ArrowRight,
  Building2,
  Check,
  CreditCard,
  FileBadge,
  MessageSquare,
  Users,
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
  icon: typeof Users;
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
    value: 'team',
    label: 'Equipo',
    icon: Users,
    title: 'Invitá a tu equipo',
    description:
      'Antes de operar conversaciones o emitir facturas, definí quién hace qué. PymesHub maneja roles (Owner, Admin, Agent, Viewer) y permisos por módulo.',
    why: 'Sin un Owner activo y al menos un Admin de respaldo, perdés acceso al workspace si la cuenta principal se bloquea.',
    checklist: [
      { text: 'Definí un Owner principal con email corporativo (no personal).' },
      { text: 'Asigná al menos un Admin secundario para continuidad.' },
      { text: 'Identificá agentes que responderán conversaciones.' },
      { text: 'Decidí qué información ven los Viewers (solo lectura).' },
    ],
    ctaLabel: 'Crear workspace',
    ctaHref: '/register',
    helpHref: '/documentation/workspace-launch-guide',
  },
  {
    value: 'plan',
    label: 'Plan y facturación',
    icon: CreditCard,
    title: 'Elegí tu plan',
    description:
      'PymesHub tiene planes que escalan con tu operación. El método de pago se configura una sola vez vía Paddle y soporta colones (CRC) y dólares (USD).',
    why: 'Algunas funciones (canales adicionales, automaciones, AI Assistant) sólo están disponibles desde Growth en adelante. Conviene ver los límites antes de empezar a importar datos.',
    checklist: [
      { text: 'Revisá los planes y elegí el que cubra tus volúmenes mensuales.' },
      { text: 'Tené a mano una tarjeta corporativa o débito empresarial.' },
      { text: 'Decidí si querés facturación mensual o anual (descuento ~17%).' },
      { text: 'Confirmá los add-ons que necesitás (extra users, AI, inventario).' },
    ],
    ctaLabel: 'Ver planes',
    ctaHref: '/pricing',
  },
  {
    value: 'hacienda',
    label: 'Datos fiscales',
    icon: FileBadge,
    title: 'Conectá Hacienda',
    description:
      'Para emitir factura electrónica en Costa Rica necesitás credenciales del portal ATV de Hacienda y el certificado digital (.p12) de la persona o empresa firmante.',
    why: 'Sin esto las facturas se emiten en modo borrador y no llegan a Hacienda. La configuración toma 10–15 minutos si ya tenés tus credenciales en mano.',
    checklist: [
      { text: 'Cédula jurídica o física registrada en el ATV.' },
      { text: 'Usuario y clave del ATV (production o sandbox).' },
      { text: 'Certificado digital .p12 y su PIN.' },
      { text: 'Actividades económicas registradas en el ATV.' },
    ],
    ctaLabel: 'Empezar configuración',
    ctaHref: '/register',
    helpHref: '/documentation/workspace-launch-guide',
  },
  {
    value: 'channels',
    label: 'Canales',
    icon: MessageSquare,
    title: 'Conectá tus canales de mensajería',
    description:
      'PymesHub centraliza WhatsApp, email y Telegram en un solo inbox. Cada canal tiene un proceso de verificación con su proveedor.',
    why: 'Algunos canales (especialmente WhatsApp Business via Meta) requieren verificación de empresa que puede tomar 1–3 días. Conviene iniciarlo en paralelo con el resto del setup.',
    checklist: [
      { text: 'WhatsApp: Meta Business verificado + número dedicado al canal.' },
      { text: 'Email: dominio propio + DNS (SPF/DKIM) o usar onboarding@resend.dev.' },
      { text: 'Telegram: bot creado vía @BotFather y token guardado.' },
      { text: 'Decidí qué canal es la primera fuente de conversaciones.' },
    ],
    ctaLabel: 'Crear workspace',
    ctaHref: '/register',
    helpHref: '/documentation/platform-overview',
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
              <Building2 className="h-3.5 w-3.5" />
              Pre-requisitos
            </p>
            <h1 className="font-marketing mt-6 text-3xl font-extrabold leading-[1.1] tracking-[-0.03em] text-white sm:text-4xl md:text-5xl">
              Antes de empezar con PymesHub
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/70 md:text-xl">
              Tenés todo listo para arrancar tu workspace en menos de 30 minutos
              si traés estas piezas preparadas.
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
                ¿Tenés todo listo?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-base text-white/70 md:text-lg">
                Creá tu workspace gratis. Te guiamos paso a paso por la configuración.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/register"
                  className="glow-button font-marketing inline-flex items-center gap-2 rounded-full bg-[linear-gradient(90deg,#F59E0B_0%,#D97706_55%,#B45309_100%)] px-6 py-3 text-sm font-semibold text-[#071126] transition hover:translate-y-[-1px]"
                >
                  Comenzar gratis
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
