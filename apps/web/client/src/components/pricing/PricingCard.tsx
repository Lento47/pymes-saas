import { useLocation } from 'wouter';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { formatColones, type PricingTier } from '@/data/pricing.data';

/**
 * One plan, and the terms of renewing it.
 *
 * The terms sit **under the button, in the card, above the fold** — not in the FAQ
 * and not behind a link. Ley 7472 Art. 32 gives the right to information, and the
 * practical meaning of that for a price is that the reader learns what they are
 * agreeing to without having to go looking for it. A renewal policy a merchant has
 * to find is not disclosure.
 *
 * What is stated, and why each of the four is here:
 *
 * - **The price, its unit, and that it includes IVA.** The figure the card leads
 *   with and the figure that will be invoiced are the same number, and it is the
 *   gross one — `LAUNCH_PRICE_BOOK` is what the merchant pays and we remit the IVA
 *   out of it. A reader who assumed the ₡10,000 was pre-tax has been quoted a
 *   different product.
 * - **That the period renews, and on which cadence.** A month is 30 days and a year is
 *   365, neither a calendar unit, so "cada 30 días" and "cada 365 días" are literally true
 *   where "cada mes" and "cada año" would not be. The free tier has no period at all and
 *   says so instead — it is permanent, and printing a renewal on it would be a lie.
 * - **That nothing is charged automatically.** There is no gateway in this business:
 *   `services/subscription.ts:467` records a payment an operator entered against a
 *   bank reference. Saying "no cobramos automáticamente" is not a nicety — a reader
 *   who believes a card will be charged has been told something false about the
 *   product they are buying. The wording is scoped to *these* plans deliberately:
 *   the legacy CRM at `/settings/billing` does run a PayPal subscription that
 *   recurs, so an unscoped "we never charge automatically" would be untrue of the
 *   platform even while being true of the marketplace.
 * - **What stops if they do not pay.** Grace, then degraded-but-listed, then hidden.
 *   Stated here because it is the term most likely to surprise and the one a
 *   merchant decides whether to accept.
 */
interface PricingCardProps {
  tier: PricingTier;
}

export function PricingCard({ tier }: PricingCardProps) {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  const handleCTA = () => {
    const plan = tier.plan.toLowerCase();
    if (isAuthenticated) {
      navigate(`/settings/billing?plan=${plan}`);
    } else {
      navigate(`/login?plan=${plan}`);
    }
  };

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-lg border bg-card p-5 transition-colors',
        tier.popular ? 'border-primary/35' : 'border-border hover:bg-muted/25'
      )}
    >
      {tier.popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="whitespace-nowrap rounded-md border border-primary/30 bg-card px-3 py-1.5 text-xs font-semibold text-primary">
            Más pedido
          </span>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-foreground">{tier.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{tier.description}</p>
      </div>

      <div className="mt-4 flex items-end gap-2">
        {tier.isFree ? (
          <span className="text-3xl font-semibold tracking-[-0.05em] text-foreground">
            Gratis
          </span>
        ) : (
          <>
            <span className="text-3xl font-semibold tracking-[-0.05em] text-foreground tabular-nums">
              {formatColones(tier.monthlyMinor)}
            </span>
            <span className="pb-1 text-xs font-semibold text-muted-foreground">/ mes</span>
          </>
        )}
      </div>
      {/*
        The annual figure sits **under** the monthly one rather than in a toggle. The tier is
        what the reader is choosing and the cadence is how they pay for it; a toggle would
        hide half the answer behind an interaction, and the page's own FAQ already states the
        rule — the year costs ten months.
      */}
      <p className="mt-1 text-[11px] text-muted-foreground">
        {tier.yearlyMinor === null ? (
          "Sin costo, para siempre"
        ) : (
          <>
            IVA incluido · {formatColones(tier.yearlyMinor)} al año
          </>
        )}
      </p>

      <div className="mt-5 space-y-1.5">
        {tier.features.map((feature) => (
          <div key={feature} className="flex gap-2">
            <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-success" />
            <span className="text-xs text-foreground/85">{feature}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-border pt-5">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Límites
        </div>
        <div className="space-y-1 text-[11px] text-foreground/75">
          {tier.limits.map((limit) => (
            <div key={limit.label} className="flex justify-between gap-3">
              <span>{limit.label}:</span>
              <span className="font-semibold text-foreground">{limit.value}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleCTA}
        className={cn(
          'mt-5 w-full rounded-md px-4 py-2.5 text-sm font-semibold transition',
          tier.popular
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'border border-border text-foreground hover:bg-muted/35'
        )}
      >
        {tier.cta}
      </button>

      {/*
        The renewal terms. Placed after the button and inside the card so the reader
        sees the price and its terms as one object — a price and a renewal policy in
        different parts of the page are two things, and only one of them is beside
        the decision.
      */}
      <div className="mt-4 rounded-md border border-border/60 bg-muted/25 px-3.5 py-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {tier.isFree ? (
            <>
              <span className="font-semibold text-foreground">Sin vencimiento:</span> el plan gratis no
              expira y no pedimos tarjeta para usarlo. Si algún día querés más, subís de nivel y el cambio
              aplica de inmediato.
            </>
          ) : (
            <>
              <span className="font-semibold text-foreground">Renovación:</span> cada 30 días por{' '}
              {formatColones(tier.monthlyMinor)}, o cada 365 días por{' '}
              {formatColones(tier.yearlyMinor ?? 0)} — el año cuesta diez meses. IVA incluido. Emitimos la
              factura y la pagás por transferencia bancaria: para estos planes{' '}
              <span className="font-semibold text-foreground">no guardamos tu tarjeta ni hacemos cargos
              automáticos</span>. Si un precio sube, el nuevo aplica en tu siguiente renovación, nunca en el
              período que ya pagaste.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
