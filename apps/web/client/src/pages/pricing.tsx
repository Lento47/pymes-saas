import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { PRICING_TIERS, ADD_ONS, FAQS } from '@/data/pricing.data';
import { PricingCard } from '@/components/pricing/PricingCard';
import { FAQSection } from '@/components/pricing/FAQSection';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/marketing/footer';
import { useI18n } from '@/components/providers/i18n-provider';
import { BrandLockup } from '@/components/marketing/brand-lockup';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { usePaddle } from '@/hooks/use-paddle';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

export default function PricingPage() {
  const [, navigate] = useLocation();
  const [isAnnual, setIsAnnual] = useState(false);
  const { messages } = useI18n();
  const copy = messages.pricing || {};
  const paddle = usePaddle();
  const { user, isAuthenticated } = useAuth();
  const [addOnLoading, setAddOnLoading] = useState<string | null>(null);
  const earlyAccessHref = 'mailto:legal@pymeshub.lat?subject=Quiero%20acceso%20anticipado';

  return (
    <div className="marketing-light-theme relative min-h-screen">

      <main className="relative z-10">
        {/* Navigation */}
        <section className="px-4 pb-8 pt-6 md:px-8">
          <div className="mx-auto max-w-7xl">
            <nav className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-md px-5 py-4 md:px-7">
              <Link href="/">
                <BrandLockup compact />
              </Link>
              <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                <LanguageSwitcher variant="marketing" />
                <Link href="/login" className="whitespace-nowrap text-sm font-medium text-gray-600 transition hover:text-gray-900">
                  Ingresar
                </Link>
                <Link href="/login" className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 sm:gap-2 sm:px-5 sm:py-2.5" style={{ background: "linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)" }}>
                  Comenzar
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </nav>
          </div>
        </section>

        {/* Hero Section */}
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="font-marketing text-3xl font-bold leading-[1.1] tracking-[-0.04em] text-gray-900 sm:text-4xl md:text-5xl">
              {copy.hero?.title || 'Planes que crecen contigo'}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-500 md:text-xl">
              {copy.hero?.subtitle || 'Pagá solo por lo que usás. Cancelá cuando quieras.'}
            </p>

            {/* Billing Toggle */}
            <div className="mt-10 flex items-center justify-center gap-4">
              <span className={cn(isAnnual ? 'text-muted-foreground' : 'text-foreground')}>
                Mensual
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className={cn(
                  'relative inline-flex h-8 w-14 items-center rounded-full transition-colors',
                  isAnnual
                    ? 'bg-primary'
                    : 'bg-muted'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-7 w-7 transform rounded-full bg-white transition-transform',
                    isAnnual ? 'translate-x-7' : 'translate-x-0.5'
                  )}
                />
              </button>
              <span className={cn(isAnnual ? 'text-foreground' : 'text-muted-foreground')}>
                Anual
              </span>
              {isAnnual && (
                <span className="ml-2 inline-block rounded-md border border-primary/25 px-3 py-1 text-xs font-semibold text-primary">
                  ~2 meses gratis
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {PRICING_TIERS.map((tier) => (
                <PricingCard
                  key={tier.name}
                  tier={tier}
                  isAnnual={isAnnual}
                />
              ))}
            </div>

            {/* Channel billing disclaimer */}
            <div className="mt-8 rounded-md border border-border/60 bg-muted/30 px-5 py-3.5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">WhatsApp Business:</span>{" "}
                PymesHub se conecta con tu propia cuenta de WhatsApp Business (WABA).
                Los cargos por mensajes de plantilla que aplique Meta se cobran directamente a tu cuenta de Meta — no están incluidos en tu suscripción de PymesHub.{" "}
                <span className="font-medium text-foreground">Telegram:</span>{" "}
                El uso normal de Telegram no genera cargos adicionales de la plataforma.
              </p>
            </div>
          </div>
        </section>

        {/* Add-ons */}
        <section className="px-4 py-12 md:px-8 md:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground md:text-4xl">
                  {copy.addOns?.title || 'Suma capacidad cuando la necesites'}
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
                  {copy.addOns?.subtitle || 'Mantené tu plan base simple y agregá usuarios pagados conforme crece tu equipo.'}
                </p>
              </div>
              <p className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground">
                  {copy.addOns?.note || 'Usuarios extra disponibles para planes pagados'}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {ADD_ONS.map((addOn) => {
                const localized = (
                  copy.addOns?.items as Record<string, { name: string; description: string }> | undefined
                )?.[addOn.key];
                const isSeat = addOn.key === 'extra_user';
                const priceId = addOn.paddlePriceIdMonthly;
                const isLoading = addOnLoading === addOn.key;

                const handleAddOnPurchase = async () => {
                  if (!priceId || !paddle) {
                    navigate('/login?plan=growth');
                    return;
                  }
                  if (isAuthenticated) {
                    navigate(`/settings/billing?addon=${addOn.key}`);
                    return;
                  }
                  setAddOnLoading(addOn.key);
                  try {
                    await paddle.Checkout.open({
                      items: [{ priceId, quantity: 1 }],
                      customData: {
                        workspaceSlug: user?.workspace?.slug ?? null,
                        addon: addOn.key,
                      },
                      settings: {
                        displayMode: 'overlay',
                        theme: 'dark',
                        locale: 'en',
                        successUrl: `${window.location.origin}/login?addon=${addOn.key}`,
                      },
                    });
                  } finally {
                    setAddOnLoading(null);
                  }
                };

                return (
                  <article
                    key={addOn.key}
                    className={cn(
                      'rounded-lg border border-border bg-card p-5 transition-colors hover:bg-muted/25',
                      isSeat && 'border-primary/35'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                        {localized?.name || addOn.name}
                      </h3>
                      {isSeat && (
                        <span className="rounded-md border border-primary/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
                          {copy.addOns?.seatBadge || 'Usuario'}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 min-h-[3rem] text-sm leading-6 text-muted-foreground">
                      {localized?.description || addOn.description}
                    </p>
                    <div className="mt-5 border-t border-border pt-4">
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-semibold tracking-[-0.05em] text-foreground tabular-nums">
                          ${addOn.monthlyUSD}
                        </span>
                        <span className="pb-1 text-xs font-semibold text-muted-foreground">
                          / {copy.addOns?.month || 'mes'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleAddOnPurchase}
                      disabled={isLoading}
                      className={cn(
                        'mt-4 flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
                        isSeat
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : 'border border-border text-foreground hover:bg-muted/35'
                      )}>
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          {isSeat ? 'Agregar' : 'Comprar'}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </>
                      )}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ROI Messaging Section */}
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground md:text-4xl">
                {copy.roi?.title || 'ROI claro en cada nivel'}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                {copy.roi?.subtitle}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Starter */}
              <div className="rounded-lg border border-border bg-card p-6 transition-colors hover:bg-muted/25">
                <div className="mb-3 text-sm font-semibold text-muted-foreground">{copy.roi?.starter?.label || 'PLAN STARTER'}</div>
                <div className="space-y-3">
                  {(copy.roi?.starter?.items as readonly any[] || []).map((item: Record<string, any>, i: number) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 font-bold text-success">+</span>
                      <div className="text-sm">
                        <p className="font-semibold text-foreground">{item.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Growth */}
              <div className="relative rounded-lg border border-primary/35 bg-card p-6 transition-colors hover:bg-muted/25">
                  <div className="absolute -top-3 left-6 rounded-md border border-primary/30 bg-card px-3 py-1 text-xs font-semibold text-primary">
                    {copy.roi?.growth?.badge || 'ROI más popular'}
                  </div>
                  <div className="mb-3 mt-2 text-sm font-semibold text-primary">{copy.roi?.growth?.label || 'PLAN GROWTH'}</div>
                <div className="space-y-3">
                  {(copy.roi?.growth?.items as readonly any[] || []).map((item: Record<string, any>, i: number) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 font-bold text-primary">→</span>
                      <div className="text-sm">
                        <p className="font-semibold text-foreground">{item.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Business+ */}
              <div className="rounded-lg border border-border bg-card p-6 transition-colors hover:bg-muted/25">
                <div className="mb-3 text-sm font-semibold text-muted-foreground">{copy.roi?.businessPlus?.label || 'PLAN BUSINESS+'}</div>
                <div className="space-y-3">
                  {(copy.roi?.businessPlus?.items as readonly any[] || []).map((item: Record<string, any>, i: number) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 font-bold text-success">↑</span>
                      <div className="text-sm">
                        <p className="font-semibold text-foreground">{item.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="text-center">
              <h2 className="text-4xl font-semibold tracking-[-0.04em] text-foreground">
              {copy.comparison?.title || 'Qué incluye cada plan'}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              {copy.comparison?.subtitle || 'Todos los planes traen bandeja unificada, facturas y automatizaciones.'}
            </p>
            </div>

            <div className="mt-16 overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-sm font-semibold text-muted-foreground sm:px-4 sm:py-3 md:px-6 md:py-4">
                      Función
                    </th>
                    {PRICING_TIERS.map((tier) => (
                      <th
                        key={tier.name}
                        className="px-3 py-2 text-center text-sm font-semibold text-foreground sm:px-4 sm:py-3 md:px-6 md:py-4"
                      >
                        {tier.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { label: 'Miembros del equipo', key: 'users' },
                    { label: 'Comprobantes/mes', key: 'invoicesPerMonth' },
                    { label: 'Automatizaciones', key: 'automations' },
                    { label: 'Almacenamiento', key: 'storageGB' },
                  ].map((row) => (
                    <tr key={row.key} className="transition hover:bg-muted/25">
                      <td className="px-3 py-2 text-sm text-muted-foreground sm:px-4 sm:py-3 md:px-6 md:py-4">{row.label}</td>
                      {PRICING_TIERS.map((tier) => {
                        const isBusinessPlus = tier.name === 'Business+';
                        return (
                          <td key={tier.name} className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-center">
                            <div className="flex items-center justify-center">
                              {isBusinessPlus ? (
                                 <span className="font-semibold italic text-muted-foreground">Personalizado</span>
                              ) : (
                                <>
                                  <Check className="h-4 w-4 text-success" />
                                  <span className="ml-2 font-semibold text-foreground">
                                    {row.key === 'users' && tier.users}
                                    {row.key === 'invoicesPerMonth' && tier.limits.invoicesPerMonth.toLocaleString('es')}
                                    {row.key === 'automations' && tier.limits.automations}
                                    {row.key === 'storageGB' && `${tier.limits.storageGB} GB`}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <h2 className="text-4xl font-semibold tracking-[-0.04em] text-foreground">
                Preguntas frecuentes
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                ¿Tenés dudas? Acá están las respuestas.
              </p>
            </div>

            <div className="mt-16">
              <FAQSection faqs={FAQS} />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-lg border border-border bg-card"
            style={{
              backgroundImage: 'url(https://raw.githubusercontent.com/Lento47/PymesHub-invoice/refs/heads/master/readytolunch.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              aspectRatio: '3 / 2',
            }}>
            <div className="absolute inset-0 bg-background/75" />
            <div className="relative z-10 flex flex-col items-center justify-center h-full p-8 text-center md:p-12">
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground md:text-4xl">
              {copy.cta?.title || '¿Listo para empezar?'}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              {copy.cta?.subtitle ||
                'Cientos de negocios ya usan PymesHub para gestionar sus operaciones.'}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                onClick={() => navigate('/login?plan=growth')}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-8 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90">
                {copy.cta?.primary || 'Empezar prueba gratuita'}
                <ArrowRight className="h-4 w-4" />
              </button>
              <a
                href={earlyAccessHref}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-8 py-3 text-sm font-semibold text-foreground transition hover:bg-muted/35">
                {copy.cta?.secondary || 'Agendar demo'}
              </a>
            </div>
            {copy.cta?.note && (
              <p className="mt-6 text-sm text-muted-foreground">
                {copy.cta.note}
              </p>
            )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
