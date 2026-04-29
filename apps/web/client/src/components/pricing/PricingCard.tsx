import { useLocation } from 'wouter';
import { PricingTier } from '@/data/pricing.data';
import { Check, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePaddle } from '@/hooks/use-paddle';
import { useAuth } from '@/hooks/use-auth';
import { useState } from 'react';

interface PricingCardProps {
  tier: PricingTier;
  isAnnual: boolean;
}

export function PricingCard({ tier, isAnnual }: PricingCardProps) {
  const [, navigate] = useLocation();
  const paddle = usePaddle();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);

  const price = isAnnual ? tier.annualUSD : tier.monthlyUSD;
  const priceCRC = isAnnual ? tier.annualCRC : tier.monthlyCRC;
  const isEnterprise = tier.name === 'Business+';

  const priceId = isAnnual ? tier.paddlePriceIdAnnual : tier.paddlePriceIdMonthly;

  const handleCTA = async () => {
    // Authenticated users should manage via Billing, not create duplicates
    if (isAuthenticated && !isEnterprise) {
      navigate('/settings/billing');
      return;
    }

    if (priceId && paddle) {
      const origin = window.location.origin;
      const successUrl = isAuthenticated
        ? `${origin}/billing?paddle=success`
        : `${origin}/login?plan=${tier.name.toLowerCase().replace('+', 'plus')}`;

      setLoading(true);
      try {
        await paddle.Checkout.open({
          items: [{ priceId, quantity: 1 }],
          customData: {
            workspaceSlug: user?.workspace?.slug ?? null,
            plan: tier.name.toLowerCase().replace('+', 'plus'),
          },
          settings: {
            displayMode: 'overlay',
            theme: 'dark',
            locale: 'en',
            successUrl,
          },
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    // Enterprise with no price ID → contact sales
    if (isEnterprise) {
      window.location.href = 'mailto:legal@pymeshub.lat?subject=Business%2B%20pricing';
      return;
    }

    // Fallback: price ID not configured yet
    navigate(`/login?plan=${tier.name.toLowerCase().replace('+', 'plus')}`);
  };

  return (
    <div className={cn(
      'relative rounded-3xl border transition-all backdrop-blur-md p-8',
      tier.popular
        ? 'border-[#dfff4a]/40 bg-indigo-900/30 shadow-[0_8px_40px_rgba(223,255,74,0.15)] md:scale-105'
        : 'border-border bg-indigo-900/10 hover:bg-indigo-900/15 hover:border-white/20'
    )}>
      {/* Popular Badge */}
      {tier.popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-[#dfff4a] px-4 py-1.5 text-xs font-bold text-[#051127] shadow-[0_4px_16px_rgba(223,255,74,0.4)]">
            🌟 RECOMENDADO
          </span>
        </div>
      )}

      {/* Header */}
      <div>
        <h3 className="text-2xl font-bold text-white">{tier.name}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
      </div>

      {/* Pricing */}
      <div className="mt-6">
        {isEnterprise ? (
          <div className="text-3xl font-bold text-white">Precio personalizado</div>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-white">${price}</span>
              <span className="text-muted-foreground">/{isAnnual ? 'año' : 'mes'}</span>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              ₡{priceCRC.toLocaleString()} / {isAnnual ? 'año' : 'mes'}
            </div>
          </>
        )}
      </div>

      {/* CTA Button */}
      <button
        onClick={handleCTA}
        disabled={loading}
        className={cn(
          'mt-8 w-full rounded-full px-4 py-3 font-semibold transition flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed',
          tier.popular
            ? 'glow-button bg-[linear-gradient(90deg,#efff53_0%,#dfff4a_55%,#7ff4d2_100%)] text-[#051127] hover:translate-y-[-1px]'
            : 'border border-white/20 text-white hover:border-white/40 hover:bg-white/[0.08]'
        )}>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {tier.cta}
            {tier.popular && <ArrowRight className="h-4 w-4" />}
          </>
        )}
      </button>

      {/* Features List */}
      <div className="mt-8 border-t border-border pt-8">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Incluye
        </div>
        <div className="space-y-3">
          {tier.features.map((feature, index) => (
            <div key={index} className="flex gap-3">
              <Check className="h-4 w-4 flex-shrink-0 text-[#dfff4a]" />
              <span className="text-sm text-foreground/85">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Limits */}
      <div className="mt-8 border-t border-border pt-8">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Límites
        </div>
        {isEnterprise ? (
          <div className="text-sm text-foreground/75 italic">
            Contactá a ventas para límites a la medida de tu negocio
          </div>
        ) : (
          <div className="space-y-2 text-sm text-foreground/75">
            <div>Contactos: <span className="text-white font-semibold">{tier.limits.contacts.toLocaleString()}</span></div>
            <div>Facturas/mes: <span className="text-white font-semibold">{tier.limits.invoicesPerMonth.toLocaleString()}</span></div>
            <div>Automatizaciones: <span className="text-white font-semibold">{tier.limits.automations}</span></div>
            <div>Almacenamiento: <span className="text-white font-semibold">{tier.limits.storageGB} GB</span></div>
            <div>Ubicaciones: <span className="text-white font-semibold">{tier.limits.locations}</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
