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
    <div className="dark marketing-canvas relative min-h-screen text-white">
      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,9,29,0)_0%,rgba(5,9,29,0.10)_42%,#05091d_96%)]" />
        <div className="animate-drift-x absolute left-[-10rem] top-[8rem] h-80 w-80 rounded-full bg-[#5771ff]/20 blur-[110px]" />
        <div className="animate-pulse-halo absolute right-[-5rem] top-[18rem] h-96 w-96 rounded-full bg-[#d5ff63]/10 blur-[130px]" />
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
              <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                <LanguageSwitcher variant="marketing" />
                <Link href="/login" className="font-marketing whitespace-nowrap text-sm font-medium text-white/78 transition hover:text-white">
                  Ingresar
                </Link>
                <Link href="/login" className="glow-button font-marketing inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[linear-gradient(90deg,#efff53_0%,#dfff4a_55%,#7ff4d2_100%)] px-3 py-2 text-xs font-semibold text-[#071126] transition hover:translate-y-[-1px] sm:gap-2 sm:px-4 sm:py-3 sm:text-sm md:px-6">
                  Comenzar
                  <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </Link>
              </div>
            </nav>
          </div>
        </section>

        {/* Hero Section */}
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="font-marketing text-3xl font-extrabold leading-[1.1] tracking-[-0.03em] text-white sm:text-4xl md:text-5xl">
              {copy.hero?.title || 'Planes que crecen contigo'}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/70 md:text-xl">
              {copy.hero?.subtitle || 'Pagá solo por lo que usás. Cancelá cuando quieras.'}
            </p>

            {/* Billing Toggle */}
            <div className="mt-10 flex items-center justify-center gap-4">
              <span className={cn(isAnnual ? 'text-white/85' : 'text-white')}>
                Mensual
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className={cn(
                  'relative inline-flex h-8 w-14 items-center rounded-full transition-colors',
                  isAnnual
                    ? 'bg-[#dfff4a]'
                    : 'bg-white/10'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-7 w-7 transform rounded-full bg-white transition-transform',
                    isAnnual ? 'translate-x-7' : 'translate-x-0.5'
                  )}
                />
              </button>
              <span className={cn(isAnnual ? 'text-white' : 'text-white/85')}>
                Anual
              </span>
              {isAnnual && (
                <span className="ml-2 inline-block rounded-full bg-[#dfff4a]/20 px-3 py-1 text-xs font-semibold text-[#dfff4a]">
                  ~2 meses gratis
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-4 md:gap-8 lg:grid-cols-4">
              {PRICING_TIERS.map((tier) => (
                <PricingCard
                  key={tier.name}
                  tier={tier}
                  isAnnual={isAnnual}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Add-ons */}
        <section className="px-4 py-12 md:px-8 md:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <h2 className="font-marketing text-3xl font-bold tracking-[-0.04em] text-white md:text-4xl">
                  {copy.addOns?.title || 'Suma capacidad cuando la necesites'}
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-white/75">
                  {copy.addOns?.subtitle || 'Mantené tu plan base simple y agregá usuarios pagados conforme crece tu equipo.'}
                </p>
              </div>
              <p className="rounded-full border border-[#dfff4a]/25 bg-[#dfff4a]/10 px-4 py-2 text-sm font-semibold text-[#efff8a]">
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
                      'rounded-2xl border border-indigo-400/15 bg-indigo-900/20 p-5 transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-indigo-900/30',
                      isSeat && 'border-[#dfff4a]/40 bg-gradient-to-br from-[#dfff4a]/12 to-indigo-900/25 shadow-[0_18px_60px_rgba(223,255,74,0.10)]'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-marketing text-lg font-bold tracking-[-0.02em] text-white">
                        {localized?.name || addOn.name}
                      </h3>
                      {isSeat && (
                        <span className="rounded-full bg-[#dfff4a] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#071126]">
                          {copy.addOns?.seatBadge || 'Usuario'}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 min-h-[3rem] text-sm leading-6 text-white/70">
                      {localized?.description || addOn.description}
                    </p>
                    <div className="mt-5 border-t border-white/10 pt-4">
                      <div className="flex items-end gap-2">
                        <span className="font-marketing text-3xl font-extrabold tracking-[-0.05em] text-white">
                          ${addOn.monthlyUSD}
                        </span>
                        <span className="pb-1 text-xs font-semibold text-white/65">
                          / {copy.addOns?.month || 'mes'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleAddOnPurchase}
                      disabled={isLoading}
                      className={cn(
                        'mt-4 w-full rounded-full px-4 py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed',
                        isSeat
                          ? 'glow-button bg-[linear-gradient(90deg,#efff53_0%,#dfff4a_55%,#7ff4d2_100%)] text-[#051127] hover:translate-y-[-1px]'
                          : 'border border-white/20 text-white hover:border-white/40 hover:bg-white/[0.08]'
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
        <section className="px-4 py-16 md:px-8 md:py-24 bg-gradient-to-b from-indigo-900/10 to-transparent">
          <div className="mx-auto max-w-7xl">
            <div className="text-center mb-16">
              <h2 className="font-marketing text-3xl md:text-4xl font-bold tracking-[-0.04em] text-white">
                {copy.roi?.title || 'ROI claro en cada nivel'}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-white/75">
                {copy.roi?.subtitle}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Starter */}
              <div className="bg-indigo-900/20 border border-indigo-400/15 rounded-2xl p-6 transition-all hover:bg-indigo-900/30">
                <div className="text-sm font-semibold text-white/75 mb-3">{copy.roi?.starter?.label || 'PLAN STARTER'}</div>
                <div className="space-y-3">
                  {(copy.roi?.starter?.items as readonly any[] || []).map((item: any, i: number) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-[#dfff4a] font-bold mt-0.5">+</span>
                      <div className="text-sm">
                        <p className="text-white font-semibold">{item.title}</p>
                        <p className="text-white/60 text-xs mt-1">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Growth */}
              <div className="bg-gradient-to-br from-[#dfff4a]/20 to-indigo-900/20 border border-[#dfff4a]/40 rounded-2xl p-6 ring-1 ring-[#dfff4a]/20 transition-all hover:from-[#dfff4a]/30 hover:to-indigo-900/30 relative">
                  <div className="absolute -top-3 left-6 bg-[#dfff4a] text-[#051127] px-3 py-1 rounded-full text-xs font-bold">
                    {copy.roi?.growth?.badge || 'ROI más popular'}
                  </div>
                  <div className="text-sm font-semibold text-[#dfff4a] mb-3 mt-2">{copy.roi?.growth?.label || 'PLAN GROWTH'}</div>
                <div className="space-y-3">
                  {(copy.roi?.growth?.items as readonly any[] || []).map((item: any, i: number) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-[#dfff4a] font-bold mt-0.5">→</span>
                      <div className="text-sm">
                        <p className="text-white font-semibold">{item.title}</p>
                        <p className="text-white/60 text-xs mt-1">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Business+ */}
              <div className="bg-indigo-900/20 border border-indigo-400/15 rounded-2xl p-6 transition-all hover:bg-indigo-900/30">
                <div className="text-sm font-semibold text-white/75 mb-3">{copy.roi?.businessPlus?.label || 'PLAN BUSINESS+'}</div>
                <div className="space-y-3">
                  {(copy.roi?.businessPlus?.items as readonly any[] || []).map((item: any, i: number) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-[#dfff4a] font-bold mt-0.5">↑</span>
                      <div className="text-sm">
                        <p className="text-white font-semibold">{item.title}</p>
                        <p className="text-white/60 text-xs mt-1">{item.desc}</p>
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
              <h2 className="font-marketing text-4xl font-bold tracking-[-0.04em] text-white">
              {copy.comparison?.title || 'Qué incluye cada plan'}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-white/70">
              {copy.comparison?.subtitle || 'Todos los planes traen bandeja unificada, facturas y automatizaciones.'}
            </p>
            </div>

            <div className="mt-16 overflow-x-auto rounded-xl border border-indigo-400/20 bg-indigo-900/10">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-left text-sm font-semibold text-white/80">
                      Función
                    </th>
                    {PRICING_TIERS.map((tier) => (
                      <th
                        key={tier.name}
                        className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-center text-sm font-semibold text-white"
                      >
                        {tier.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {[
                    { label: 'Miembros del equipo', key: 'users' },
                    { label: 'Contactos', key: 'contacts' },
                    { label: 'Facturas/mes', key: 'invoicesPerMonth' },
                    { label: 'Automatizaciones', key: 'automations' },
                    { label: 'Almacenamiento', key: 'storageGB' },
                  ].map((row) => (
                    <tr key={row.key} className="hover:bg-indigo-900/10 transition">
                      <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-sm text-white/80">{row.label}</td>
                      {PRICING_TIERS.map((tier) => {
                        const isBusinessPlus = tier.name === 'Business+';
                        return (
                          <td key={tier.name} className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-center">
                            <div className="flex items-center justify-center">
                              {isBusinessPlus ? (
                                 <span className="font-semibold text-white/85 italic">Personalizado</span>
                              ) : (
                                <>
                                  <Check className="h-4 w-4 text-[#dfff4a]" />
                                  <span className="ml-2 font-semibold text-white">
                                    {row.key === 'users' && tier.users}
                                    {row.key === 'contacts' && tier.limits.contacts.toLocaleString()}
                                    {row.key === 'invoicesPerMonth' && tier.limits.invoicesPerMonth.toLocaleString()}
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
              <h2 className="font-marketing text-4xl font-bold tracking-[-0.04em] text-white">
                Preguntas frecuentes
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-white/70">
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
          <div className="mx-auto max-w-3xl rounded-3xl relative overflow-hidden"
            style={{
              backgroundImage: 'url(https://raw.githubusercontent.com/Lento47/pymeshub-invoice/refs/heads/master/readytolunch.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              aspectRatio: '3 / 2',
            }}>
            <div className="absolute inset-0 bg-[#05091d]/70" />
            <div className="relative z-10 flex flex-col items-center justify-center h-full p-8 text-center md:p-12">
            <h2 className="font-marketing text-3xl font-bold tracking-[-0.04em] text-white md:text-4xl">
              {copy.cta?.title || '¿Listo para empezar?'}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/70">
              {copy.cta?.subtitle ||
                'Cientos de negocios ya usan PymesHub para gestionar sus operaciones.'}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                onClick={() => navigate('/login?plan=growth')}
                className="glow-button font-marketing inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#dfff4a] to-[#7ff4d2] px-8 py-3 text-[#051127] font-semibold transition hover:translate-y-[-1px]">
                {copy.cta?.primary || 'Empezar prueba gratuita'}
                <ArrowRight className="h-4 w-4" />
              </button>
              <a
                href={earlyAccessHref}
                className="font-marketing inline-flex items-center gap-2 rounded-full border border-white/20 bg-indigo-900/20 px-8 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-indigo-900/30">
                {copy.cta?.secondary || 'Agendar demo'}
              </a>
            </div>
            {copy.cta?.note && (
              <p className="mt-6 text-sm text-white/75">
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
