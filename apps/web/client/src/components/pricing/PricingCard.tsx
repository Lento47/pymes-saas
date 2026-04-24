import { Button } from '@/components/ui/button';
import { PricingTier } from '@/data/pricing.data';
import { Check } from 'lucide-react';

interface PricingCardProps {
  tier: PricingTier;
  billingPeriod: 'monthly' | 'annual';
}

export function PricingCard({ tier, billingPeriod }: PricingCardProps) {
  const price = billingPeriod === 'monthly' ? tier.monthlyUSD : tier.annualUSD;
  const priceCRC = billingPeriod === 'monthly' ? tier.monthlyCRC : tier.annualCRC;
  const isEnterprise = tier.name === 'Enterprise';

  return (
    <div
      className={`relative rounded-2xl border transition-all ${
        tier.popular
          ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      {/* Popular Badge */}
      {tier.popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-blue-600 px-4 py-1 text-sm font-semibold text-white">
            Most popular
          </span>
        </div>
      )}

      <div className="p-8">
        {/* Header */}
        <h3 className="text-2xl font-bold text-gray-900">{tier.name}</h3>
        <p className="mt-2 text-sm text-gray-600">{tier.description}</p>

        {/* Pricing */}
        <div className="mt-6">
          {isEnterprise ? (
            <div className="text-3xl font-bold text-gray-900">Custom pricing</div>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-gray-900">${price}</span>
                <span className="text-gray-600">/month</span>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                ₡{priceCRC.toLocaleString()} / mes
              </div>
              {billingPeriod === 'annual' && (
                <div className="mt-2 text-xs text-blue-600 font-semibold">
                  Save 2 months with annual billing
                </div>
              )}
            </>
          )}
        </div>

        {/* CTA Button */}
        <Button
          className={`mt-8 w-full ${
            tier.popular
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'border border-gray-300 text-gray-900 hover:bg-gray-50'
          }`}
          size="lg"
        >
          {tier.cta}
        </Button>

        {/* Users */}
        <div className="mt-6 border-t border-gray-200 pt-6">
          <div className="text-sm font-semibold text-gray-900 mb-2">
            {tier.users === 999 ? 'Unlimited users' : `${tier.users} users included`}
          </div>
        </div>

        {/* Features List */}
        <div className="mt-6 space-y-4">
          {tier.features.map((feature, index) => (
            <div key={index} className="flex gap-3">
              <Check className="h-5 w-5 flex-shrink-0 text-blue-600" />
              <span className="text-sm text-gray-700">{feature}</span>
            </div>
          ))}
        </div>

        {/* Limits */}
        <div className="mt-8 border-t border-gray-200 pt-6">
          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4">
            Limits
          </div>
          <div className="space-y-2 text-sm text-gray-700">
            <div>Contacts: {tier.limits.contacts.toLocaleString()}</div>
            <div>Invoices/month: {tier.limits.invoicesPerMonth.toLocaleString()}</div>
            <div>Automations: {tier.limits.automations}</div>
            <div>Storage: {tier.limits.storageGB} GB</div>
            <div>Locations: {tier.limits.locations}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
