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
          <div key={index} className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-900">{addOn.name}</h3>
            <p className="mt-2 text-sm text-gray-600">{addOn.description}</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">${price}</span>
              <span className="text-gray-600">/month</span>
            </div>
            <Button
              variant="outline"
              className="mt-6 w-full border-gray-300 text-gray-900 hover:bg-gray-50"
            >
              Add to plan
            </Button>
          </div>
        );
      })}
    </div>
  );
}
