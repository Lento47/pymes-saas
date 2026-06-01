import type { AddOn } from '@/data/pricing.data';
import { Button } from '@/components/ui/button';

interface AddOnsSectionProps {
  addOns: AddOn[];
  billingPeriod: 'monthly' | 'annual';
}

export function AddOnsSection({ addOns, billingPeriod }: AddOnsSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {addOns.map((addOn, index) => {
        const price = billingPeriod === 'monthly' ? addOn.monthlyUSD : addOn.monthlyUSD * 12;

        return (
          <div key={index} className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-semibold text-foreground">{addOn.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{addOn.description}</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">${price}</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <Button
              variant="outline"
              className="mt-6 w-full border-border text-foreground hover:bg-muted"
            >
              Add to plan
            </Button>
          </div>
        );
      })}
    </div>
  );
}
