import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PricingTier } from "@/data/pricing.data";

interface PricingCardProps {
  tier: PricingTier;
  isAnnual: boolean;
  isCurrentPlan?: boolean;
  onUpgrade?: (plan: string) => void;
}

export function PricingCard({
  tier,
  isAnnual,
  isCurrentPlan = false,
  onUpgrade,
}: PricingCardProps) {
  const price = isAnnual
    ? tier.yearlyUSD ?? tier.monthlyUSD * 12
    : tier.monthlyUSD;
  const currency = isAnnual
    ? tier.yearlyCRC ?? tier.monthlyCRC * 12
    : tier.monthlyCRC;
  const billingPeriod = isAnnual ? "/year" : "/month";
  const savingsPercent = isAnnual ? "15" : "0";

  return (
    <div
      className={cn(
        "relative rounded-2xl border transition-all duration-300",
        tier.popular
          ? "border-[#dfff4a]/30 bg-gradient-to-br from-[#dfff4a]/5 to-[#7ff4d2]/5 ring-1 ring-[#dfff4a]/20"
          : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
      )}
    >
      {tier.popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="inline-block rounded-full bg-gradient-to-r from-[#dfff4a] to-[#7ff4d2] px-4 py-1 text-xs font-semibold text-[#051127]">
            Most Popular
          </span>
        </div>
      )}

      <div className="p-6 sm:p-8">
        {/* Header */}
        <div className="mb-6">
          <h3 className="font-marketing text-2xl font-semibold text-white">
            {tier.name}
          </h3>
          <p className="mt-2 text-sm text-white/60">{tier.description}</p>
        </div>

        {/* Pricing */}
        <div className="mb-8">
          <div className="flex items-baseline gap-1">
            <span className="font-marketing text-4xl font-bold text-white">
              ${price}
            </span>
            <span className="text-white/60">{billingPeriod}</span>
          </div>
          {tier.monthlyCRC > 0 && (
            <p className="mt-2 text-sm text-white/50">
              ₡{currency.toLocaleString()}{billingPeriod}
            </p>
          )}
          {isAnnual && savingsPercent !== "0" && (
            <p className="mt-3 inline-block rounded-full bg-[#dfff4a]/10 px-3 py-1 text-xs font-semibold text-[#dfff4a]">
              Save {savingsPercent}% annually
            </p>
          )}
        </div>

        {/* CTA Button */}
        <Button
          className={cn(
            "mb-8 w-full",
            tier.popular
              ? "bg-gradient-to-r from-[#dfff4a] to-[#7ff4d2] text-[#051127] font-semibold hover:opacity-90"
              : "bg-white/10 text-white hover:bg-white/20"
          )}
          disabled={isCurrentPlan}
          onClick={() => onUpgrade?.(tier.plan)}
        >
          {isCurrentPlan ? "Current Plan" : tier.cta}
        </Button>

        {/* Features List */}
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
            What's Included
          </p>
          <ul className="space-y-3">
            {tier.features.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm text-white/80">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#dfff4a]" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Limits Info */}
        <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
            Plan Limits
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-white/70">
            <div>
              <p className="font-medium text-white/90">{tier.limits.users}</p>
              <p>Team Members</p>
            </div>
            <div>
              <p className="font-medium text-white/90">
                {tier.limits.contacts.toLocaleString()}
              </p>
              <p>Contacts</p>
            </div>
            <div>
              <p className="font-medium text-white/90">
                {tier.limits.invoicesPerMonth}
              </p>
              <p>Invoices/mo</p>
            </div>
            <div>
              <p className="font-medium text-white/90">{tier.limits.automations}</p>
              <p>Automations</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
