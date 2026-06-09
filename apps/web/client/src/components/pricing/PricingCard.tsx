import { useLocation } from 'wouter';
import type { PricingTier } from '@/data/pricing.data';
import { Check, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useState } from 'react';
import ContactSalesModal from './contact-sales-modal';

interface PricingCardProps {
  tier: PricingTier;
  isAnnual: boolean;
}

export function PricingCard({ tier, isAnnual }: PricingCardProps) {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [contactOpen, setContactOpen] = useState(false);

  const price = isAnnual ? tier.annualUSD : tier.monthlyUSD;
  const isEnterprise = tier.name === 'Business+';
  const planSlug = tier.name.toLowerCase().replace('+', 'plus');

  const handleCTA = () => {
    if (isEnterprise) {
      setContactOpen(true);
      return;
    }
    if (isAuthenticated) {
      navigate(`/settings/billing?plan=${planSlug}`);
    } else {
      navigate(`/login?plan=${planSlug}`);
    }
  };

  return (
    <div className={cn(
      'relative rounded-lg border bg-card p-5 transition-colors',
      tier.popular
        ? 'border-primary/35'
        : 'border-border hover:bg-muted/25'
    )}>
      {tier.popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="whitespace-nowrap rounded-md border border-primary/30 bg-card px-3 py-1.5 text-xs font-semibold text-primary">
            Recomendado
          </span>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-foreground">{tier.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{tier.description}</p>
      </div>

      <div className="mt-4">
        {isEnterprise ? (
          <div className="text-2xl font-semibold text-foreground">Precio personalizado</div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold text-foreground tabular-nums">${price}</span>
            <span className="text-xs text-muted-foreground">/{isAnnual ? 'año' : 'mes'}</span>
          </div>
        )}
      </div>

      <button
        onClick={handleCTA}
        className={cn(
          'mt-5 flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-xs font-semibold transition',
          tier.popular
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'border border-border text-foreground hover:bg-muted/35'
        )}>
        {tier.cta}
        {tier.popular && <ArrowRight className="h-3.5 w-3.5" />}
      </button>

      <div className="mt-5 border-t border-border pt-5">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Incluye
        </div>
        <div className="space-y-1.5">
          {tier.features.map((feature, index) => {
            const status = tier.featureStatuses?.[feature];
            return (
              <div key={index} className="flex gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-success" />
                <span className="text-xs text-foreground/85">{feature}</span>
                {status && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                    status === 'Parcial' ? 'bg-amber-500/10 text-amber-300' : 'bg-zinc-500/10 text-zinc-400'
                  }`}>
                    {status}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-5">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Límites
        </div>
        {isEnterprise ? (
          <div className="text-xs text-foreground/75 italic">
            Contactá a ventas para límites a la medida de tu negocio
          </div>
        ) : (
          <div className="space-y-1 text-[11px] text-foreground/75">
            <div>Facturas/mes: <span className="font-semibold text-foreground">{tier.limits.invoicesPerMonth.toLocaleString()}</span></div>
            <div>Automatizaciones: <span className="font-semibold text-foreground">{tier.limits.automations}</span></div>
            <div>Almacenamiento: <span className="font-semibold text-foreground">{tier.limits.storageGB} GB</span></div>
            <div>Ubicaciones: <span className="font-semibold text-foreground">{tier.limits.locations}</span></div>
          </div>
        )}
      </div>
      <ContactSalesModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </div>
  );
}
