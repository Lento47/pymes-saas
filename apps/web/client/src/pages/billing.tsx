import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

async function fetchWorkspaceSubscription(workspaceSlug: string) {
  const response = await fetch(`/api/workspaces/${workspaceSlug}/subscription`);
  if (!response.ok) throw new Error('Failed to fetch subscription');
  return response.json();
}

async function fetchBillingPortalLink() {
  const response = await fetch('/api/billing/portal');
  if (!response.ok) throw new Error('Failed to fetch billing portal link');
  return response.json();
}

// Maps the ?plan= URL param value to a tier planKey
const PLAN_PARAM_MAP: Record<string, string> = {
  starter: 'starter',
  growth: 'growth',
  business: 'enterprise',
  enterprise: 'enterprise',
};

const PRICING_TIERS = [
  {
    name: 'Starter',
    planKey: 'starter',
    monthlyUSD: 25,
    monthlyCRC: 12900,
    features: ['500 Contacts', '100 invoices/month', '5 Automations', '1 User'],
  },
  {
    name: 'Growth',
    planKey: 'growth',
    monthlyUSD: 59,
    monthlyCRC: 29900,
    features: ['2,500 Contacts', '500 invoices/month', '25 Automations', '5 Users'],
  },
  {
    name: 'Business',
    planKey: 'enterprise',
    monthlyUSD: 119,
    monthlyCRC: 59900,
    features: ['15,000 Contacts', '2,000 invoices/month', '100 Automations', '15 Users'],
  },
];

export default function BillingPage() {
  const { workspaceSlug, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const params = new URLSearchParams(location.split('?')[1]);
  const success = params.get('success');
  const canceled = params.get('canceled');
  const planParam = params.get('plan'); // e.g. 'starter', 'growth', 'business'

  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const autoCheckoutFired = useRef(false);

  const { data: subscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ['subscription', workspaceSlug],
    queryFn: () => fetchWorkspaceSubscription(workspaceSlug || ''),
    enabled: !!workspaceSlug && isAuthenticated,
  });

  const { data: portalLink, isLoading: portalLoading } = useQuery({
    queryKey: ['billingPortal'],
    queryFn: fetchBillingPortalLink,
    enabled: isAuthenticated,
  });

  const { data: prices, isLoading: pricesLoading } = useQuery({
    queryKey: ['billingPrices'],
    queryFn: () => api.getBillingPrices(),
    enabled: isAuthenticated,
  });

  // Auto-trigger checkout when arriving from a ?plan= link (e.g. login?plan=starter)
  useEffect(() => {
    if (autoCheckoutFired.current) return;
    if (!planParam || pricesLoading || subscriptionLoading) return;

    const targetPlanKey = PLAN_PARAM_MAP[planParam.toLowerCase()];
    const tier = PRICING_TIERS.find(t => t.planKey === targetPlanKey);
    if (!tier) return;

    const isCurrentPlan =
      subscription?.plan?.toUpperCase() === tier.name.toUpperCase() ||
      subscription?.plan?.toUpperCase() === tier.planKey.toUpperCase();
    if (isCurrentPlan) return;

    autoCheckoutFired.current = true;
    handleUpgrade(tier);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planParam, prices, pricesLoading, subscriptionLoading, subscription]);

  async function handleUpgrade(tier: (typeof PRICING_TIERS)[number]) {
    const priceId = prices?.[`${tier.planKey}_monthly`];
    if (!priceId) {
      setCheckoutError('Plan pricing is not configured yet. Please contact support.');
      return;
    }

    setCheckoutLoading(tier.planKey);
    setCheckoutError(null);

    try {
      const result = await api.createCheckout(priceId);
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        setCheckoutError('Could not create checkout session. Please try again.');
      }
    } catch (err: unknown) {
      setCheckoutError(err?.message ?? 'Checkout failed. Please try again.');
    } finally {
      setCheckoutLoading(null);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Please log in to view billing information.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Facturación y suscripción</h1>
        <p className="text-muted-foreground mt-2">Gestioná tu plan y método de pago</p>
      </div>

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">
            Payment successful! Your subscription has been updated.
          </AlertDescription>
        </Alert>
      )}

      {canceled && (
        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertDescription className="text-yellow-800">
            Payment was canceled. Your subscription remains unchanged.
          </AlertDescription>
        </Alert>
      )}

      {checkoutError && (
        <Alert className="bg-red-50 border-red-200">
          <AlertDescription className="text-red-800">{checkoutError}</AlertDescription>
        </Alert>
      )}

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>Your active subscription</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscriptionLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading subscription info...</span>
            </div>
          ) : subscription ? (
            <>
              <div className="flex justify-between items-center">
                <span className="font-semibold capitalize">{subscription.plan || 'Starter'}</span>
                <span className="text-sm text-muted-foreground">
                  ${subscription.monthly_price || 0}/month
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Billing period: {new Date(subscription.current_period_start).toLocaleDateString()} -{' '}
                {new Date(subscription.current_period_end).toLocaleDateString()}
              </div>
              {subscription.trial_ends_at && (
                <div className="text-sm text-blue-600">
                  Trial ends: {new Date(subscription.trial_ends_at).toLocaleDateString()}
                </div>
              )}
              <div className="flex gap-2">
                {portalLoading ? (
                  <Button disabled>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </Button>
                ) : (
                  <>
                    {portalLink?.url && (
                      <Button
                        onClick={() => window.open(portalLink.url, '_blank')}
                        variant="outline"
                      >
                        Manage Subscription
                      </Button>
                    )}
                    <Button onClick={() => window.scrollTo(0, document.getElementById('upgrade-plans')?.offsetTop || 0)}>
                      View Plans
                    </Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="text-muted-foreground">No hay suscripción activa. Elegí un plan para empezar.</div>
          )}
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div id="upgrade-plans" className="space-y-4">
        <h2 className="text-2xl font-bold">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PRICING_TIERS.map((tier) => {
            const isCurrentPlan =
              subscription?.plan?.toUpperCase() === tier.name.toUpperCase() ||
              subscription?.plan?.toUpperCase() === tier.planKey.toUpperCase();
            const isLoading = checkoutLoading === tier.planKey;
            const hasPriceId = !!prices?.[`${tier.planKey}_monthly`];

            return (
              <Card key={tier.name}>
                <CardHeader>
                  <CardTitle>{tier.name}</CardTitle>
                  <CardDescription>
                    <div className="text-2xl font-bold text-foreground mt-2">
                      ${tier.monthlyUSD}
                      <span className="text-sm text-muted-foreground font-normal">/month</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      ₡{tier.monthlyCRC.toLocaleString()}/month
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {tier.features.map((feature) => (
                      <li key={feature} className="text-sm text-muted-foreground flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={isCurrentPlan ? 'outline' : 'default'}
                    disabled={isCurrentPlan || isLoading || !hasPriceId}
                    onClick={() => handleUpgrade(tier)}
                    title={!hasPriceId ? 'Pricing not configured' : undefined}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Redirecting...
                      </>
                    ) : isCurrentPlan ? (
                      'Current Plan'
                    ) : (
                      'Upgrade'
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>Your recent invoices and payments</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No hay facturas aún. La primera aparecerá después del primer pago.</p>
        </CardContent>
      </Card>
    </div>
  );
}
