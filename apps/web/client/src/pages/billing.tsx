import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

async function fetchWorkspaceSubscription() {
  const response = await fetch('/api/workspaces/current/subscription');
  if (!response.ok) throw new Error('Failed to fetch subscription');
  return response.json();
}

async function fetchBillingPortalLink() {
  const response = await fetch('/api/billing/portal');
  if (!response.ok) throw new Error('Failed to fetch billing portal link');
  return response.json();
}

async function createCheckout(priceId: string): Promise<{ transactionId: string; checkoutUrl?: string }> {
  const response = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Checkout failed' }));
    throw new Error(err.message || 'Checkout failed');
  }
  return response.json();
}

const PRICE_IDS: Record<string, string> = {
  STARTER: import.meta.env.VITE_PADDLE_PRICE_STARTER_MONTHLY || 'pri_starter_monthly',
  GROWTH: import.meta.env.VITE_PADDLE_PRICE_GROWTH_MONTHLY || 'pri_growth_monthly',
  ENTERPRISE: import.meta.env.VITE_PADDLE_PRICE_ENTERPRISE_MONTHLY || 'pri_enterprise_monthly',
};

const PRICING_TIERS = [
  {
    name: 'Starter',
    planKey: 'STARTER' as const,
    monthlyUSD: 25,
    monthlyCRC: 12900,
    features: ['500 Contacts', '100 invoices/month', '5 Automations', '1 User'],
  },
  {
    name: 'Growth',
    planKey: 'GROWTH' as const,
    monthlyUSD: 59,
    monthlyCRC: 29900,
    features: ['2,500 Contacts', '500 invoices/month', '25 Automations', '5 Users'],
  },
  {
    name: 'Enterprise',
    planKey: 'ENTERPRISE' as const,
    monthlyUSD: 119,
    monthlyCRC: 59900,
    features: ['Unlimited Contacts', 'Unlimited invoices', 'Unlimited Automations', 'Unlimited Users'],
  },
];

export default function BillingPage() {
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();
  const params = new URLSearchParams(location.split('?')[1]);
  const success = params.get('success');
  const canceled = params.get('canceled');

  const { data: subscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: fetchWorkspaceSubscription,
    enabled: isAuthenticated,
  });

  const { data: portalLink, isLoading: portalLoading } = useQuery({
    queryKey: ['billingPortal'],
    queryFn: fetchBillingPortalLink,
    enabled: isAuthenticated,
  });

  const checkoutMutation = useMutation({
    mutationFn: createCheckout,
    onSuccess: async (data) => {
      if (data.transactionId) {
        const clientToken = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
        if (!clientToken) {
          console.error('VITE_PADDLE_CLIENT_TOKEN is not configured');
          window.open('https://paddle.com', '_blank');
          return;
        }
        try {
          const { initializePaddle } = await import('@paddle/paddle-js');
          const paddle = await initializePaddle({
            environment: (import.meta.env.VITE_PADDLE_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
            token: clientToken,
          });
          if (paddle) {
            paddle.Checkout.open({ transactionId: data.transactionId });
          }
        } catch {
          if (data.checkoutUrl) {
            window.open(data.checkoutUrl, '_blank');
          }
        }
      }
    },
  });

  const handleUpgrade = (planKey: string) => {
    const priceId = PRICE_IDS[planKey];
    if (priceId) {
      checkoutMutation.mutate(priceId);
    }
  };

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
        <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        <p className="text-gray-600 mt-2">Manage your plan and payment method</p>
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
                <span className="font-semibold capitalize">{subscription.plan || 'Free'}</span>
              </div>
              {subscription.current_period_start && subscription.current_period_end && (
                <div className="text-sm text-gray-600">
                  Billing period: {new Date(subscription.current_period_start).toLocaleDateString()} -{' '}
                  {new Date(subscription.current_period_end).toLocaleDateString()}
                </div>
              )}
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
                    <Button onClick={() => window.scrollTo(0, (document.getElementById('upgrade-plans')?.offsetTop || 0) - 20)}>
                      View Plans
                    </Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="text-gray-600">No active subscription. Choose a plan to get started.</div>
          )}
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div id="upgrade-plans" className="space-y-4">
        <h2 className="text-2xl font-bold">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PRICING_TIERS.map((tier) => {
            const isCurrentPlan = subscription?.plan?.toUpperCase() === tier.planKey;
            return (
              <Card key={tier.name}>
                <CardHeader>
                  <CardTitle>{tier.name}</CardTitle>
                  <CardDescription>
                    <div className="text-2xl font-bold text-gray-900 mt-2">
                      ${tier.monthlyUSD}
                      <span className="text-sm text-gray-600 font-normal">/month</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      ₡{tier.monthlyCRC.toLocaleString()}/month
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {tier.features.map((feature) => (
                      <li key={feature} className="text-sm text-gray-600 flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={isCurrentPlan ? 'outline' : 'default'}
                    disabled={isCurrentPlan || checkoutMutation.isPending}
                    onClick={() => handleUpgrade(tier.planKey)}
                  >
                    {checkoutMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
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

      {checkoutMutation.isError && (
        <Alert className="bg-red-50 border-red-200">
          <AlertDescription className="text-red-800">
            {(checkoutMutation.error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>Your recent invoices and payments</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">No invoices yet. Your first invoice will appear after your first payment.</p>
        </CardContent>
      </Card>
    </div>
  );
}
