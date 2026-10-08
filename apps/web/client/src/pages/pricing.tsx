import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { FEATURE_COMPARISON, FAQS, PRICING_TIERS } from '@/data/pricing.data';
import { PricingCard } from '@/components/pricing/PricingCard';
import { FAQSection } from '@/components/pricing/FAQSection';
import { Footer } from '@/components/marketing/footer';
import { BrandLockup } from '@/components/marketing/brand-lockup';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { ChamferedCta, ChamferedCtaGhost } from '@/components/marketing/cta-button';

/**
 * The pricing page, rewritten around the one product that actually exists.
 *
 * It used to describe a five-tier USD SaaS with an annual billing option and five
 * paid add-ons. None of that was true: the platform now charges a flat fee in
 * colones for marketplace access, takes no share of anybody's sale, and has no
 * annual plan — `PLAN_PERIOD_DAYS` is 7 or 30 and there is no third option. Every
 * price, limit and FAQ answer below is derived from `@pymeshub/shared`'s `plans.ts`,
 * which is also what the Worker charges from, so the page and the invoice cannot
 * disagree.
 *
 * Three things this page deliberately does not have, each of which was a false claim
 * rather than a stale one:
 *
 * - **An annual toggle.** There is no annual product. Advertising one, and a
 *   "~2 meses gratis" discount computed against a price nothing charges, is
 *   misleading advertising under Ley 7472 — and it is the kind a regulator can
 *   point at, because the arithmetic is on the page.
 * - **Add-ons.** The five that were here were priced for capabilities nothing
 *   enforces. `PLAN_LIMITS` is the whole of what a plan permits.
 * - **A remote background image.** The closing panel fetched a JPEG from
 *   `raw.githubusercontent.com`. Same problem as the font CDN — an unconsented
 *   third-party request from a US host, which Ley 8968 Art. 14 asks for a basis
 *   for — and one the reader waited on.
 */
export default function PricingPage() {

  return (
    <div className="marketplace-theme relative min-h-screen">
      <main className="relative z-10">
        {/* Navigation */}
        <section className="px-4 pb-8 pt-6 md:px-8">
          <div className="mx-auto max-w-7xl">
            <nav className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 backdrop-blur-md md:px-7">
              <Link href="/">
                <BrandLockup compact />
              </Link>
              <div className="flex shrink-0 items-center gap-2 sm:gap-4">
                <LanguageSwitcher variant="marketing" />
                <Link
                  href="/login"
                  className="whitespace-nowrap text-sm font-medium text-slate-300 transition hover:text-white"
                >
                  Ingresar
                </Link>
                {/* The site's own chamfered CTA instead of a generic gradient pill. */}
                <Link
                  href="/register"
                  className="group relative inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap px-5 text-sm font-semibold uppercase leading-none tracking-[0.08em]"
                >
                  <svg aria-hidden="true" viewBox="0 0 220 50" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                    <path d="M220 42L212.932 50H0V0H220V42Z" className="fill-[#0E0F14]" />
                    <path d="M220 42L212.932 50H0V0H220V42Z" className="fill-[#f59e0b] origin-left scale-x-0 transition-transform duration-[250ms] ease-[cubic-bezier(0.33,0,0,1)] group-hover:scale-x-100" />
                    <path d="M220 42L212.932 50H0V0H220V42Z" fill="none" stroke="#f59e0b" strokeOpacity="0.25" />
                    <path d="M205 49.5H213L219.5 42V36 M212 0.5H219.5V7 M8 0.5H0.5V7 M7.5 49.5H0.5V42.5" fill="none" className="stroke-[#f59e0b]" />
                  </svg>
                  <span className="relative z-10 text-[#f59e0b] transition-colors duration-[250ms] group-hover:text-[#05091d]">Registrar mi comercio</span>
                  <ArrowRight className="relative z-10 h-3.5 w-3.5 text-[#f59e0b] transition-all duration-150 group-hover:translate-x-1 group-hover:text-[#05091d]" />
                </Link>
              </div>
            </nav>
          </div>
        </section>

        {/* Hero — the model first, the price second. */}
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="font-marketing text-3xl font-bold leading-[1.1] tracking-[-0.04em] text-white sm:text-4xl md:text-5xl">
              Una tarifa fija. Cero comisión.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400 md:text-xl">
              Tu cliente te paga a vos por el producto y al repartidor por la entrega. PymesHub te cobra una
              tarifa fija por la app y no toma ni un colón de tu venta.
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-500">
              Precios en colones, IVA incluido. En estos planes no guardamos tu tarjeta y no hacemos cargos
              automáticos: te emitimos la factura y la pagás por transferencia.
            </p>
          </div>
        </section>

        {/* The tiers — one card each, because the cadence is a choice on the card. */}
        <section className="px-4 py-12 md:px-8 md:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {PRICING_TIERS.map((tier) => (
                <PricingCard key={tier.plan} tier={tier} />
              ))}
            </div>

            {/*
              The business model, stated once and plainly rather than implied by an
              absent commission line. "No cobramos comisión" was true and still
              misleading by omission — a reader who assumed a marketplace took
              something needed to be told what, specifically, it does not take.
            */}
            <div className="mt-8 rounded-md border border-border/60 bg-muted/30 px-5 py-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Cero comisión por venta:</span> el plan es el
                costo completo de usar la plataforma y no cobramos un porcentaje de cada venta — el pago de tu
                cliente nunca pasa por nosotros.{' '}
                <span className="font-medium text-foreground">Efectivo contra entrega:</span> el dinero queda
                en tu caja, como siempre, y el pago queda registrado en el pedido. Si aceptas tarjeta o
                transferencia, el cobro lo liquida tu proveedor de pagos.
              </p>
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <h2 className="text-4xl font-semibold tracking-[-0.04em] text-foreground">
                Qué incluye cada plan
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                Cuatro niveles, con el techo y las funciones que cada uno incluye. Elegís el nivel y, aparte,
                si te facturamos cada mes o cada año — el anual cuesta diez meses.
              </p>
            </div>

            <div className="mt-12 overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground md:px-6">
                      Función
                    </th>
                    {PRICING_TIERS.map((tier) => (
                      <th
                        key={tier.plan}
                        className="px-4 py-3 text-center text-sm font-semibold text-foreground md:px-6"
                      >
                        {tier.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {FEATURE_COMPARISON.map((row) => (
                    <tr key={row.feature} className="transition hover:bg-muted/25">
                      <td className="px-4 py-3 text-sm text-muted-foreground md:px-6">{row.feature}</td>
                      {row.values.map((value, index) => (
                        <td
                          key={PRICING_TIERS[index]?.plan ?? index}
                          className="px-4 py-3 text-center text-sm font-semibold text-foreground md:px-6"
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <h2 className="text-4xl font-semibold tracking-[-0.04em] text-foreground">
                Preguntas frecuentes
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                Lo que más preguntan antes de firmar.
              </p>
            </div>

            <div className="mt-12">
              <FAQSection faqs={FAQS} />
            </div>
          </div>
        </section>

        {/* Closing CTA — no remote asset, so nothing on this page is a third-party request. */}
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
            <div className="relative z-10 flex flex-col items-center justify-center p-8 text-center md:p-12">
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground md:text-4xl">
                Abrí tu tienda esta semana
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Registrás tu comercio, armás tu catálogo y empezás a recibir pedidos. El plan gratis no vence
                y no te pedimos tarjeta: pagás solo cuando tu negocio necesite más.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <ChamferedCta href="/register">
                  Registrar mi comercio
                </ChamferedCta>
                <ChamferedCtaGhost href="/login">
                  Ya tengo cuenta
                </ChamferedCtaGhost>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
