import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { usePaddle, getPaddle } from '@/hooks/use-paddle';
import { useLocation } from 'wouter';
import { api } from '@/lib/api';
import { ModuleHero } from '@/components/shared/module-hero';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, ExternalLink } from 'lucide-react';

const PRICING_TIERS = [
  {
    name: 'Starter',
    monthlyUSD: 25,
    monthlyCRC: 12900,
    features: ['500 Contacts', '100 invoices/month', '5 Automations', '1 User'],
    priceId: import.meta.env.VITE_PADDLE_PRICE_STARTER_MONTHLY as string | undefined,
  },
  {
    name: 'Growth',
    monthlyUSD: 59,
    monthlyCRC: 29900,
    features: ['2,500 Contacts', '500 invoices/month', '25 Automations', '5 Users'],
    popular: true,
    priceId: import.meta.env.VITE_PADDLE_PRICE_GROWTH_MONTHLY as string | undefined,
  },
  {
    name: 'Business',
    monthlyUSD: 119,
    monthlyCRC: 59900,
    features: ['15,000 Contacts', '2,000 invoices/month', '100 Automations', '15 Users'],
    priceId: import.meta.env.VITE_PADDLE_PRICE_ENTERPRISE_MONTHLY as string | undefined,
  },
];

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ACTIVE: { label: 'Active', variant: 'default' },
  TRIALING: { label: 'Trial', variant: 'secondary' },
  PAST_DUE: { label: 'Past Due', variant: 'destructive' },
  UNPAID: { label: 'Unpaid', variant: 'destructive' },
  CANCELLED: { label: 'Cancelled', variant: 'outline' },
  EXPIRED: { label: 'Expired', variant: 'outline' },
  MANUAL: { label: 'Active', variant: 'default' },
};

export default function BillingPage({ standalone = false }: { standalone?: boolean }) {
  const { user, isAuthenticated } = useAuth();
  const paddle = usePaddle();
  const [location] = useLocation();
  const params = new URLSearchParams(location.split('?')[1]);
  const success = params.get('success') || params.get('paddle');
  const canceled = params.get('canceled');
  const planParam = params.get('plan');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const { data: subscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: api.getSubscription,
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: portalLink, isLoading: portalLoading } = useQuery({
    queryKey: ['billingPortal'],
    queryFn: api.getBillingPortal,
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['billingInvoices'],
    queryFn: api.getBillingInvoices,
    enabled: isAuthenticated,
    retry: false,
  });

  const queryClient = useQueryClient();
  const { mutate: syncSubscription, isPending: syncPending } = useMutation({
    mutationFn: (args?: { customerId?: string; subscriptionId?: string }) =>
      api.syncSubscription(args?.customerId, args?.subscriptionId),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['billingInvoices'] });
    },
  });

  const handleSync = () => {
    const id = prompt('Paddle Subscription ID (starts with sub_) or Customer ID (starts with ctm_):');
    if (!id) return;
    if (id.startsWith('sub_')) {
      syncSubscription({ subscriptionId: id });
    } else {
      syncSubscription({ customerId: id });
    }
  };

  // Auto-trigger upgrade when ?plan=growth|starter|business is in the URL
  const autoUpgradeTier = planParam
    ? PRICING_TIERS.find((t) => t.name.toLowerCase() === planParam.toLowerCase())
    : null;

  const handleOpenCheckout = async (tier: typeof PRICING_TIERS[number]) => {
    setCheckoutLoading(tier.name);
    try {
      await paddle!.Checkout.open({
        items: [{ priceId: tier.priceId!, quantity: 1 }],
        customData: { workspaceSlug: workspaceSlug ?? null, plan: tier.name.toLowerCase() },
        settings: {
          displayMode: 'overlay',
          theme: 'dark',
          locale: 'en',
          successUrl: `${window.location.origin}/#/settings/billing?success=true`,
        },
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  useEffect(() => {
    if (autoUpgradeTier && paddle && autoUpgradeTier.priceId) {
      handleOpenCheckout(autoUpgradeTier);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!autoUpgradeTier, !!paddle]);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Please log in to view billing information.</p>
      </div>
    );
  }

  const statusInfo = subscription?.status ? STATUS_LABELS[subscription.status] : null;
  const workspaceSlug = user?.workspace?.slug;

  // Map backend plan names to PRICING_TIERS display names
  const planDisplayName = (plan: string | undefined) => {
    if (plan?.toUpperCase() === 'ENTERPRISE') return 'Business';
    return plan?.toLowerCase() || 'free';
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {standalone && (
        <ModuleHero module="billing">
          <div className="px-6 py-5">
            <h1 className="text-xl font-bold text-gray-900">Billing & Subscription</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage your plan and payment method</p>
          </div>
        </ModuleHero>
      )}
      {!standalone && (
        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing & Subscription</h1>
          <p className="text-muted-foreground mt-1">Manage your plan and payment method</p>
        </div>
      )}

      {success && (
        <Alert className="border-green-500/30 bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-400">
            Payment successful! Your subscription has been updated.
          </AlertDescription>
        </Alert>
      )}

      {canceled && (
        <Alert className="border-yellow-500/30 bg-yellow-500/10">
          <AlertDescription className="text-yellow-400">
            Payment was canceled. Your subscription remains unchanged.
          </AlertDescription>
        </Alert>
      )}

      {/* Current Plan */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground">Current Plan</CardTitle>
              <CardDescription className="text-muted-foreground mt-1">Your active subscription details</CardDescription>
            </div>
            {statusInfo && (
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscriptionLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading subscription info...</span>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border bg-[hsl(var(--elevated))] px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Plan</p>
                  <p className="text-lg font-semibold text-foreground capitalize">
                    {planDisplayName(subscription?.plan)}
                  </p>
                </div>
                {(() => {
                  const displayPlan = planDisplayName(subscription?.plan);
                  const planPrice = PRICING_TIERS.find((t) => t.name.toUpperCase() === displayPlan.toUpperCase())?.monthlyUSD;
                  if (planPrice) {
                    return (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Price</p>
                        <p className="text-lg font-semibold text-foreground">
                          ${planPrice}
                          <span className="text-sm font-normal text-muted-foreground">/month</span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {subscription?.current_period_start && subscription?.current_period_end && (
                <div className="text-sm text-muted-foreground">
                  Billing period:{' '}
                  <span className="text-foreground">
                    {new Date(subscription.current_period_start).toLocaleDateString()} –{' '}
                    {new Date(subscription.current_period_end).toLocaleDateString()}
                  </span>
                </div>
              )}

              {subscription?.trial_ends_at && (
                <div className="text-sm text-blue-400">
                  Trial ends: {new Date(subscription.trial_ends_at).toLocaleDateString()}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  onClick={() => portalLink?.url && window.open(portalLink.url, '_blank')}
                  variant="outline"
                  disabled={portalLoading || !portalLink?.url}
                  className="gap-2"
                >
                  {portalLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                  Manage Subscription
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleSync}
                  disabled={syncPending}
                >
                  {syncPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Sync'
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    const el = document.getElementById('upgrade-plans');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  View Plans
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div id="upgrade-plans" className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PRICING_TIERS.map((tier) => {
            const isCurrent = planDisplayName(subscription?.plan).toUpperCase() === tier.name.toUpperCase();
            return (
              <Card
                key={tier.name}
                className={`bg-card border-border relative ${tier.popular ? 'ring-1 ring-primary' : ''}`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-xs px-2">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground">{tier.name}</CardTitle>
                  <CardDescription className="mt-2">
                    <div className="text-2xl font-bold text-foreground">
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
                      <li key={feature} className="text-sm text-muted-foreground flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={isCurrent ? 'outline' : 'default'}
                    disabled={isCurrent || checkoutLoading === tier.name}
                    onClick={async () => {
                      if (isCurrent) return;

                      if (!tier.priceId) {
                        console.warn('[Billing Upgrade] No priceId for', tier.name, '— redirecting to /pricing');
                        window.location.href = '/#/pricing';
                        return;
                      }

                      let checkoutPaddle = paddle;
                      if (!checkoutPaddle) {
                        console.log('[Billing Upgrade] Paddle not yet ready, polling getPaddle()...');
                        setCheckoutLoading(tier.name);
                        const started = Date.now();
                        for (let i = 0; i < 50; i++) {
                          await new Promise((r) => setTimeout(r, 200));
                          checkoutPaddle = getPaddle();
                          if (checkoutPaddle) break;
                        }
                        if (!checkoutPaddle) {
                          console.error('[Billing Upgrade] getPaddle() still null after 10s — redirecting to /pricing');
                          setCheckoutLoading(null);
                          window.location.href = '/#/pricing';
                          return;
                        }
                        console.log('[Billing Upgrade] Paddle acquired after', ((Date.now() - started) / 1000).toFixed(1), 's');
                      }

                      setCheckoutLoading(tier.name);
                      try {
                        await checkoutPaddle.Checkout.open({
                          items: [{ priceId: tier.priceId, quantity: 1 }],
                          customData: { workspaceSlug: workspaceSlug ?? null, plan: tier.name.toLowerCase() },
                          settings: {
                            displayMode: 'overlay',
                            theme: 'dark',
                            locale: 'en',
                            successUrl: `${window.location.origin}/#/settings/billing?success=true`,
                          },
                        });
                      } finally {
                        setCheckoutLoading(null);
                      }
                    }}
                  >
                    {checkoutLoading === tier.name ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Redirecting...
                      </>
                    ) : isCurrent ? (
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
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Billing History</CardTitle>
          <CardDescription className="text-muted-foreground">Your recent invoices and payments</CardDescription>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading invoices...</span>
            </div>
          ) : invoices?.length > 0 ? (
            <div className="space-y-3">
              {invoices.map((inv: any) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-[hsl(var(--elevated))] px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{inv.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.plan_name} — {inv.plan_interval === 'MONTHLY' ? 'Monthly' : 'Annual'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(inv.issued_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
                        {inv.currency === 'CRC' ? '₡' : '$'}{inv.total.toLocaleString()}
                      </p>
                      <Badge variant={inv.status === 'PAID' ? 'default' : inv.status === 'DRAFT' ? 'secondary' : 'outline'}>
                        {inv.status}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(`/api/billing/invoices/${inv.id}/pdf`, '_blank')}
                    >
                      PDF
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No invoices yet. Your first invoice will appear after your first payment.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
