import { useLocation } from 'wouter';
import { PricingTier } from '@/data/pricing.data';
import { Check, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PricingCardProps {
  tier: PricingTier;
  isAnnual: boolean;
}

export function PricingCard({ tier, isAnnual }: PricingCardProps) {
  const [, navigate] = useLocation();
  const price = isAnnual ? tier.annualUSD : tier.monthlyUSD;
  const priceCRC = isAnnual ? tier.annualCRC : tier.monthlyCRC;
  const isEnterprise = tier.name === 'Business+';

  const handleCTA = () => {
    if (isEnterprise) {
      navigate('/contact-sales');
    } else {
      navigate(`/login?plan=${tier.name.toLowerCase().replace('+', 'plus')}`);
    }
  };

  return (
    <div className={cn(
      'relative rounded-2xl border transition-all backdrop-blur-sm p-8',
      tier.popular
        ? 'border-[#dfff4a]/30 bg-white/[0.08]'
        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/20'
    )}>
      {/* Popular Badge */}
      {tier.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-[#dfff4a] px-3 py-1 text-xs font-semibold text-[#051127]">
            Most Popular
          </span>
        </div>
      )}

      {/* Header */}
      <div>
        <h3 className="text-2xl font-bold text-white">{tier.name}</h3>
        <p className="mt-2 text-sm text-white/60">{tier.description}</p>
      </div>

      {/* Pricing */}
      <div className="mt-6">
        {isEnterprise ? (
          <div className="text-3xl font-bold text-white">Custom Pricing</div>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-white">${price}</span>
              <span className="text-white/60">/month</span>
            </div>
            <div className="mt-2 text-sm text-white/60">
              ₡{priceCRC.toLocaleString()} / mes
            </div>
          </>
        )}
      </div>

      {/* CTA Button */}
      <button
        onClick={handleCTA}
        className={cn(
          'mt-8 w-full rounded-full px-4 py-3 font-semibold transition flex items-center justify-center gap-2 text-sm',
          tier.popular
            ? 'glow-button bg-[linear-gradient(90deg,#efff53_0%,#dfff4a_55%,#7ff4d2_100%)] text-[#051127] hover:translate-y-[-1px]'
            : 'border border-white/20 text-white hover:border-white/40 hover:bg-white/[0.08]'
        )}>
        {tier.cta}
        {tier.popular && <ArrowRight className="h-4 w-4" />}
      </button>

      {/* Features List */}
      <div className="mt-8 border-t border-white/10 pt-8">
        <div className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-4">
          Features
        </div>
        <div className="space-y-3">
          {tier.features.map((feature, index) => (
            <div key={index} className="flex gap-3">
              <Check className="h-4 w-4 flex-shrink-0 text-[#dfff4a]" />
              <span className="text-sm text-white/80">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Limits */}
      <div className="mt-8 border-t border-white/10 pt-8">
        <div className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-4">
          Limits
        </div>
        {isEnterprise ? (
          <div className="text-sm text-white/70 italic">
            Contact Sales for custom limits tailored to your business needs
          </div>
        ) : (
          <div className="space-y-2 text-sm text-white/70">
            <div>Contacts: <span className="text-white font-semibold">{tier.limits.contacts.toLocaleString()}</span></div>
            <div>Invoices/month: <span className="text-white font-semibold">{tier.limits.invoicesPerMonth.toLocaleString()}</span></div>
            <div>Automations: <span className="text-white font-semibold">{tier.limits.automations}</span></div>
            <div>Storage: <span className="text-white font-semibold">{tier.limits.storageGB} GB</span></div>
            <div>Locations: <span className="text-white font-semibold">{tier.limits.locations}</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
