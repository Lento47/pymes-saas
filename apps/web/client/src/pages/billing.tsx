import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Check, Loader2, AlertTriangle, CalendarDays, CreditCard } from 'lucide-react';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

// ── Plan data ─────────────────────────────────────────────────────────────

const PLAN_PARAM_MAP: Record<string, string> = {
  emprende: 'emprende',
  starter: 'starter',
  growth: 'growth',
  business: 'business',
  enterprise: 'business',
};

const PRICING_TIERS = [
  {
    name: 'Emprende',
    planKey: 'emprende',
    monthlyUSD: 12,
    monthlyCRC: 6900,
    features: ['500 contactos', '25 facturas/mes', '3 automatizaciones', '1 usuario'],
    requiresEligibility: true,
  },
  {
    name: 'Starter',
    planKey: 'starter',
    monthlyUSD: 25,
    monthlyCRC: 12900,
    features: ['500 contactos', '100 facturas/mes', '15 automatizaciones', '1 usuario'],
  },
  {
    name: 'Growth',
    planKey: 'growth',
    monthlyUSD: 59,
    monthlyCRC: 29900,
    features: ['2,500 contactos', '500 facturas/mes', '25 automatizaciones', '5 usuarios'],
    popular: true,
  },
  {
    name: 'Business',
    planKey: 'business',
    monthlyUSD: 119,
    monthlyCRC: 59900,
    features: ['15,000 contactos', '2,000 facturas/mes', '100 automatizaciones', '15 usuarios'],
  },
];

const PAYPAL_PENDING_KEY = 'paypal_pending_plan_id';

function statusBadge(status?: string) {
  if (!status) return null;
  const map: Record<string, { label: string; className: string }> = {
    ACTIVE:    { label: 'Activo',        className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    TRIALING:  { label: 'Prueba',        className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    PAST_DUE:  { label: 'Pago pendiente',className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    CANCELLED: { label: 'Cancelado',     className: 'bg-red-500/10 text-red-600 border-red-500/20' },
    MANUAL:    { label: 'Manual',        className: 'bg-muted text-muted-foreground border-border' },
  };
  const cfg = map[status.toUpperCase()] ?? map.MANUAL;
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── PayPal return detection ──────────────────────────────────────────────
  // PayPal redirects to: base?subscription_id=I-xxx&ba_token=xxx#/billing
  // We read from window.location.search (before the hash).
  const searchParams = new URLSearchParams(window.location.search);
  const ppSubscriptionId = searchParams.get('subscription_id');
  const ppCanceled = searchParams.get('pp_canceled');
  const ppPlanParam = searchParams.get('plan'); // from ?plan=starter links

  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const autoCheckoutFired = useRef(false);
  const confirmFired = useRef(false);

  const { data: subscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.getSubscription(),
    enabled: isAuthenticated,
  });

  const { data: prices, isLoading: pricesLoading } = useQuery({
    queryKey: ['billingPrices'],
    queryFn: () => api.getBillingPrices(),
    enabled: isAuthenticated,
  });

  const { data: currentFeatures, isLoading: featuresLoading } = useQuery({
    queryKey: ['currentFeatures'],
    queryFn: () => api.getCurrentFeatures(),
    enabled: isAuthenticated,
  });

  const isEmprendeActive =
    subscription?.plan === 'EMPRENDE' || currentFeatures?.plan === 'EMPRENDE';
  const isEmprendeEligible =
    isEmprendeActive || currentFeatures?.beta_profile === 'EMPRENDE_ELIGIBLE';
  const visiblePricingTiers = useMemo(
    () => PRICING_TIERS.filter((tier) => !tier.requiresEligibility || isEmprendeEligible),
    [isEmprendeEligible],
  );

  // ── Confirm PayPal subscription after redirect ──────────────────────────
  useEffect(() => {
    if (!ppSubscriptionId || confirmFired.current || !isAuthenticated) return;
    const pendingPlanId = sessionStorage.getItem(PAYPAL_PENDING_KEY);
    if (!pendingPlanId) return;

    confirmFired.current = true;
    setConfirmLoading(true);

    api.confirmPayPalSubscription(ppSubscriptionId, pendingPlanId)
      .then(() => {
        sessionStorage.removeItem(PAYPAL_PENDING_KEY);
        setConfirmed(true);
        qc.invalidateQueries({ queryKey: ['subscription'] });
        qc.invalidateQueries({ queryKey: ['currentFeatures'] });
        // Clean URL without reload
        const cleanUrl = window.location.origin + window.location.pathname + '#/billing';
        window.history.replaceState(null, '', cleanUrl);
      })
      .catch((err: any) => {
        setCheckoutError(err?.message ?? 'No se pudo confirmar la suscripción.');
      })
      .finally(() => setConfirmLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ppSubscriptionId, isAuthenticated]);

  // ── Auto-trigger checkout from ?plan= param ─────────────────────────────
  useEffect(() => {
    if (autoCheckoutFired.current || ppSubscriptionId) return;
    if (!ppPlanParam || pricesLoading || subscriptionLoading || featuresLoading) return;

    const targetPlanKey = PLAN_PARAM_MAP[ppPlanParam.toLowerCase()];
    const tier = visiblePricingTiers.find((t) => t.planKey === targetPlanKey);
    if (!tier) return;

    const isCurrentPlan =
      subscription?.plan?.toUpperCase() === tier.planKey.toUpperCase();
    if (isCurrentPlan) return;

    autoCheckoutFired.current = true;
    handleUpgrade(tier);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ppPlanParam, prices, pricesLoading, subscriptionLoading, featuresLoading, subscription, visiblePricingTiers]);

  async function handleUpgrade(tier: (typeof PRICING_TIERS)[number]) {
    if (tier.requiresEligibility && !isEmprendeEligible) {
      setCheckoutError('PymesHub Emprende requiere aprobación previa.');
      return;
    }

    const planId = prices?.[`${tier.planKey}_monthly`];
    if (!planId) {
      setCheckoutError('El precio del plan no está configurado. Contactá a soporte.');
      return;
    }

    setCheckoutLoading(tier.planKey);
    setCheckoutError(null);

    try {
      const result = await api.createCheckout(planId);
      if (result.checkoutUrl) {
        sessionStorage.setItem(PAYPAL_PENDING_KEY, planId);
        window.location.href = result.checkoutUrl;
      } else {
        setCheckoutError('No se pudo crear la sesión de pago. Intentá de nuevo.');
      }
    } catch (err: any) {
      setCheckoutError(err?.message ?? 'Error al iniciar el pago. Intentá de nuevo.');
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleCancel() {
    if (!confirm('¿Confirmás cancelar tu suscripción? El acceso al plan actual terminará inmediatamente.')) return;
    try {
      await api.cancelPlan();
      toast({ title: 'Suscripción cancelada correctamente.' });
      qc.invalidateQueries({ queryKey: ['subscription'] });
      qc.invalidateQueries({ queryKey: ['currentFeatures'] });
    } catch (err: any) {
      toast({ title: 'No se pudo cancelar', description: err?.message, variant: 'destructive' });
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Iniciá sesión para ver tu facturación.</p>
      </div>
    );
  }

  const activePlan = subscription?.plan;
  const activePlanLabel = activePlan
    ? PRICING_TIERS.find((t) => t.planKey === activePlan.toLowerCase())?.name ?? activePlan
    : 'Free';

  return (
    <div className="space-y-6 px-6 py-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Facturación</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestioná tu plan y suscripción</p>
      </div>

      {/* Alerts */}
      {confirmLoading && (
        <Alert className="bg-blue-500/10 border-blue-500/20">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <AlertDescription className="text-blue-700 ml-2">Confirmando suscripción con PayPal…</AlertDescription>
        </Alert>
      )}

      {confirmed && (
        <Alert className="bg-emerald-500/10 border-emerald-500/20">
          <Check className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-700 ml-2">
            ¡Suscripción activada! Tu plan ha sido actualizado.
          </AlertDescription>
        </Alert>
      )}

      {ppCanceled && (
        <Alert className="bg-amber-500/10 border-amber-500/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 ml-2">
            El pago fue cancelado. Tu suscripción no cambió.
          </AlertDescription>
        </Alert>
      )}

      {checkoutError && (
        <Alert className="bg-destructive/10 border-destructive/20">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive ml-2">{checkoutError}</AlertDescription>
        </Alert>
      )}

      {/* Current plan */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Plan actual</CardTitle>
            {subscription?.status && statusBadge(subscription.status)}
          </div>
        </CardHeader>
        <CardContent>
          {subscriptionLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando…
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-accent/10">
                  <CreditCard className="h-4 w-4 text-accent" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{activePlanLabel}</p>
                  {subscription?.billing_interval && (
                    <p className="text-xs text-muted-foreground capitalize">
                      {subscription.billing_interval === 'YEARLY' ? 'Anual' : 'Mensual'}
                    </p>
                  )}
                </div>
              </div>

              {subscription?.current_period_start && subscription?.current_period_end && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  Período:{' '}
                  {format(new Date(subscription.current_period_start), 'dd MMM yyyy', { locale: es })} –{' '}
                  {format(new Date(subscription.current_period_end), 'dd MMM yyyy', { locale: es })}
                </div>
              )}

              {subscription?.provider === 'PAYPAL' && activePlan !== 'FREE' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
                  onClick={handleCancel}
                >
                  Cancelar suscripción
                </Button>
              )}

              {(!subscription || subscription.plan === 'FREE' || !subscription.provider) && (
                <p className="text-xs text-muted-foreground">
                  Estás en el plan gratuito. Elegí un plan para desbloquear todas las funciones.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Plans */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Planes disponibles</h2>
          {!isEmprendeEligible && (
            <p className="text-xs text-muted-foreground mt-0.5">
              PymesHub Emprende requiere aprobación previa. Contactá a soporte para revisar elegibilidad.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visiblePricingTiers.map((tier) => {
            const isCurrentPlan = activePlan?.toUpperCase() === tier.planKey.toUpperCase();
            const isLoadingThis = checkoutLoading === tier.planKey;
            const hasPlanId = !!prices?.[`${tier.planKey}_monthly`];

            return (
              <Card
                key={tier.planKey}
                className={isCurrentPlan ? 'border-accent/40 bg-accent/[0.03]' : undefined}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{tier.name}</CardTitle>
                    {(tier as any).popular && !isCurrentPlan && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Popular</Badge>
                    )}
                    {isCurrentPlan && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-accent/40 text-accent">
                        Actual
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    <span className="text-xl font-bold text-foreground">${tier.monthlyUSD}</span>
                    <span className="text-xs text-muted-foreground font-normal">/mes</span>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      ₡{tier.monthlyCRC.toLocaleString()}/mes
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <ul className="space-y-1.5">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs"
                    variant={isCurrentPlan ? 'outline' : 'default'}
                    disabled={isCurrentPlan || isLoadingThis || !hasPlanId || confirmLoading}
                    onClick={() => handleUpgrade(tier)}
                    title={!hasPlanId ? 'Plan no configurado' : undefined}
                  >
                    {isLoadingThis ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Redirigiendo…
                      </>
                    ) : isCurrentPlan ? (
                      'Plan actual'
                    ) : (
                      'Elegir plan'
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
