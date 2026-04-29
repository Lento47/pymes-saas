import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AddOn } from '@/data/pricing.data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api';

interface AddOnsSectionProps {
  addOns: AddOn[];
  billingPeriod: 'monthly' | 'annual';
}

export function AddOnsSection({ addOns, billingPeriod }: AddOnsSectionProps) {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [extraQty, setExtraQty] = useState(1);

  const extraUsersMutation = useMutation({
    mutationFn: (quantity: number) => api.checkoutExtraUsers(quantity),
    onSuccess: (data) => {
      if (data?.updated) {
        toast({
          title: 'Asientos actualizados',
          description: 'Tu suscripción se actualizó con los usuarios extra. El cargo prorrateado se cobra de inmediato.',
        });
      } else if (data?.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank');
        toast({ title: 'Redirigiendo a Paddle para completar el pago…' });
      } else {
        toast({ title: 'No se pudo generar el checkout', variant: 'destructive' });
      }
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const handleAdd = (addOn: AddOn) => {
    if (!addOn.available) {
      toast({ title: 'Próximamente', description: `${addOn.name} estará disponible pronto.` });
      return;
    }
    if (!isAuthenticated) {
      toast({
        title: 'Iniciá sesión',
        description: 'Necesitás una cuenta para agregar add-ons.',
        variant: 'destructive',
      });
      return;
    }
    if (addOn.key === 'extra_user') {
      const qty = Math.max(1, Math.floor(extraQty || 1));
      extraUsersMutation.mutate(qty);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {addOns.map((addOn) => {
        const price = billingPeriod === 'monthly' ? addOn.monthlyUSD : addOn.monthlyUSD * 12;
        const priceCRC = billingPeriod === 'monthly' ? addOn.monthlyCRC : addOn.monthlyCRC * 12;
        const isExtraUser = addOn.key === 'extra_user';
        const loading = isExtraUser && extraUsersMutation.isPending;

        return (
          <div key={addOn.key} className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold text-gray-900">{addOn.name}</h3>
              {!addOn.available && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  Próximamente
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-gray-600">{addOn.description}</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">${price}</span>
              <span className="text-gray-600">/month</span>
            </div>
            <div className="mt-1 text-sm text-gray-600">₡{priceCRC.toLocaleString()} / mes</div>

            {isExtraUser && addOn.quantifiable && (
              <div className="mt-4">
                <label className="text-xs font-medium text-gray-700">Cantidad de usuarios extra</label>
                <Input
                  type="number"
                  min={1}
                  value={extraQty}
                  onChange={(e) => setExtraQty(Number(e.target.value) || 1)}
                  className="mt-1"
                />
              </div>
            )}

            <Button
              variant="outline"
              className="mt-6 w-full border-gray-300 text-gray-900 hover:bg-gray-50"
              disabled={!addOn.available || loading}
              onClick={() => handleAdd(addOn)}
            >
              {loading ? 'Procesando…' : addOn.available ? 'Agregar al plan' : 'Próximamente'}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
