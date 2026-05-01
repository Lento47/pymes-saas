import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth, useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { usePaddle } from "@/hooks/use-paddle";
import { api, getAuthToken } from "@/lib/api";
import { ADD_ONS } from "@/data/pricing.data";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { queryClient } from "@/lib/queryClient";
import { HelpButton } from "@/components/shared/help-button";
import { DiagnosticButton } from "@/components/shared/diagnostic-button";
import {
  Crown, ArrowUpRight, ArrowDownRight, Check, Loader2, Info, ExternalLink,
  Users, Zap, Receipt, FolderOpen, Database, TrendingUp, Search,
} from "lucide-react";

const PLAN_ORDER = ["FREE", "STARTER", "GROWTH", "BUSINESS", "BUSINESS_PLUS"] as const;

interface PlanTier {
  key: string;
  name: string;
  description: string;
  monthlyUSD: number;
  usersLabel: string;
  highlights: string[];
  limits: { label: string; value: string; icon: typeof Users }[];
  popular: boolean;
  priceIdMonthly: string | null;
  priceIdAnnual: string | null;
}

const PLAN_TIERS: PlanTier[] = [
  {
    key: "FREE",
    name: "Free",
    description: "Para empezar a organizar tu operación sin costo.",
    monthlyUSD: 0,
    usersLabel: "1 usuario",
    highlights: [
      "CRM básico",
      "Dashboard",
      "Facturación básica",
      "5 automatizaciones",
    ],
    limits: [
      { label: "Contactos", value: "100", icon: Users },
      { label: "Facturas/mes", value: "50", icon: Receipt },
      { label: "Automatizaciones", value: "5", icon: Zap },
      { label: "Documentos", value: "50", icon: FolderOpen },
      { label: "Almacenamiento", value: "100 MB", icon: Database },
    ],
    popular: false,
    priceIdMonthly: null,
    priceIdAnnual: null,
  },
  {
    key: "STARTER",
    name: "Starter",
    description: "Ideal para dueños que empiezan a ordenar clientes y facturas.",
    monthlyUSD: 25,
    usersLabel: "1 usuario incluido",
    highlights: [
      "Todo lo de Free",
      "Facturación básica",
      "Dashboard",
      "Pipeline de ventas",
      "Soporte por email",
      "100 facturas/mes",
    ],
    limits: [
      { label: "Contactos", value: "500", icon: Users },
      { label: "Facturas/mes", value: "100", icon: Receipt },
      { label: "Automatizaciones", value: "15", icon: Zap },
      { label: "Documentos", value: "500", icon: FolderOpen },
      { label: "Almacenamiento", value: "5 GB", icon: Database },
    ],
    popular: false,
    priceIdMonthly: null,
    priceIdAnnual: null,
  },
  {
    key: "GROWTH",
    name: "Growth",
    description: "Para equipos en crecimiento que necesitan flujos avanzados.",
    monthlyUSD: 59,
    usersLabel: "5 usuarios incluidos",
    highlights: [
      "Todo lo de Starter",
      "WhatsApp inbox",
      "Automatizaciones básicas",
      "Dashboard de dueño",
      "Soporte prioritario",
    ],
    limits: [
      { label: "Contactos", value: "2,500", icon: Users },
      { label: "Facturas/mes", value: "500", icon: Receipt },
      { label: "Automatizaciones", value: "25", icon: Zap },
      { label: "Documentos", value: "500", icon: FolderOpen },
      { label: "Almacenamiento", value: "10 GB", icon: Database },
    ],
    popular: true,
    priceIdMonthly: null,
    priceIdAnnual: null,
  },
  {
    key: "BUSINESS",
    name: "Business",
    description: "Control avanzado para operaciones que no pueden frenar.",
    monthlyUSD: 119,
    usersLabel: "15 usuarios incluidos",
    highlights: [
      "Todo lo de Growth",
      "WhatsApp Inbox avanzado",
      "API access",
      "Audit logs",
      "Multi-location",
      "100 automatizaciones",
    ],
    limits: [
      { label: "Contactos", value: "15,000", icon: Users },
      { label: "Facturas/mes", value: "2,000", icon: Receipt },
      { label: "Automatizaciones", value: "100", icon: Zap },
      { label: "Documentos", value: "5,000", icon: FolderOpen },
      { label: "Almacenamiento", value: "50 GB", icon: Database },
    ],
    popular: false,
    priceIdMonthly: null,
    priceIdAnnual: null,
  },
  {
    key: "BUSINESS_PLUS",
    name: "Business+",
    description: "Para pymes con operaciones avanzadas y necesidades a medida.",
    monthlyUSD: 0,
    usersLabel: "usuarios personalizados",
    highlights: [
      "Todo lo de Business",
      "SSO / SAML",
      "Contrato personalizado",
      "Onboarding dedicado",
      "Soporte prioritario 24/7",
    ],
    limits: [
      { label: "Contactos", value: "Personalizado", icon: Users },
      { label: "Facturas/mes", value: "Personalizado", icon: Receipt },
      { label: "Automatizaciones", value: "Personalizado", icon: Zap },
      { label: "Documentos", value: "Personalizado", icon: FolderOpen },
      { label: "Almacenamiento", value: "Personalizado", icon: Database },
    ],
    popular: false,
    priceIdMonthly: null,
    priceIdAnnual: null,
  },
];

const PLAN_BADGE: Record<string, string> = {
  FREE: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
  STARTER: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  GROWTH: "border-violet-500/20 bg-violet-500/10 text-violet-400",
  BUSINESS: "border-sky-500/20 bg-sky-500/10 text-sky-400",
  ENTERPRISE: "border-sky-500/20 bg-sky-500/10 text-sky-400", // Legacy
  BUSINESS_PLUS: "border-yellow-500/20 bg-yellow-500/10 text-yellow-400",
};

const PLAN_CARD_BORDER: Record<string, string> = {
  FREE: "border-border/60",
  STARTER: "border-amber-500/20",
  GROWTH: "border-violet-500/20",
  BUSINESS: "border-sky-500/20",
  ENTERPRISE: "border-sky-500/20", // Legacy
  BUSINESS_PLUS: "border-yellow-500/20",
};

const EXTRA_SEAT_ADD_ON = ADD_ONS.find((addOn) => addOn.key === "extra_user");

type PlanRelation = "upgrade" | "current" | "downgrade";

function getPlanRelation(currentPlan: string, tierKey: string): PlanRelation {
  const currentIdx = PLAN_ORDER.indexOf(currentPlan as any);
  const tierIdx = PLAN_ORDER.indexOf(tierKey as any);
  if (tierIdx < 0 || currentIdx < 0) return tierIdx >= currentIdx ? "upgrade" : "downgrade";
  if (tierIdx > currentIdx) return "upgrade";
  if (tierIdx === currentIdx) return "current";
  return "downgrade";
}

// IMPORTANTE: ANTES SE USABA `fetch()` CRUDO AQUI, LO QUE CAUSABA 401 PORQUE
// NO INCLUIA EL HEADER DE AUTH. AHORA USAMOS `api.getSubscription()` QUE PASA
// EL JWT AUTOMATICAMENTE. NO REVERTIR.
async function fetchSubscription(_workspaceSlug: string) {
  return api.getSubscription();
}

export default function BillingPage() {
  useRequireAuth();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const paddle = usePaddle();
  const [location] = useLocation();
  const [intervals, setIntervals] = useState<Record<string, "monthly" | "annual">>({});
  const openBillingPortal = async () => {
    try {
      const { url } = await api.getBillingPortal();
      if (url) window.open(url, "_blank");
    } catch {
      toast({ title: "Portal no disponible", variant: "destructive" });
    }
  };

  const [loading, setLoading] = useState<string | null>(null);
  const params = new URLSearchParams(location.split("?")[1]);
  const success = params.get("paddle") === "success";
  const canceled = params.get("canceled");
  const addonParam = params.get("addon");
  const addonLabels: Record<string, string> = {
    ai_assistant: 'Asistente IA',
    whatsapp_premium: 'WhatsApp + Analíticas',
    extra_user: 'Usuario extra',
    advanced_inventory: 'Inventario avanzado',
    approvals_signature: 'Aprobaciones y firma digital',
  };
  const workspaceSlug = user?.workspace?.slug;

  const currentPlan = user?.workspace?.plan ?? "FREE";
  const planBadge = PLAN_BADGE[currentPlan] || PLAN_BADGE.FREE;

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ["subscription", workspaceSlug],
    queryFn: () => fetchSubscription(workspaceSlug || ""),
    enabled: !!workspaceSlug && isAuthenticated,
    staleTime: 0,
  });

  const { data: pricesData } = useQuery({
    queryKey: ["/api/billing/prices"],
    queryFn: api.getBillingPrices,
    enabled: isAuthenticated,
    retry: false,
  });

  // ────────────────────────────────────────────────────────────────────────
  // IMPORTANTE — FUENTE DE VERDAD DE LOS PRICE IDs:
  // SIEMPRE LEEMOS DESDE EL BACKEND (`api.getBillingPrices()` => pricesData),
  // NO DESDE `import.meta.env.VITE_PADDLE_PRICE_*`. ASI SOLO HAY QUE
  // CONFIGURAR PADDLE EN UN LUGAR (RAILWAY: PADDLE_PRICE_*_MONTHLY/ANNUAL).
  // SI ALGUN DIA SE QUIERE DUPLICAR EN EL FRONT, OK — PERO MANTENER EL
  // BACKEND COMO FALLBACK PRIMARIO.
  // PADDLE ESTA EN SANDBOX. CAMBIAR A PROD: ROTAR PADDLE_API_KEY,
  // PADDLE_WEBHOOK_SECRET, PADDLE_PRICE_*, Y PADDLE_ENVIRONMENT=production
  // EN RAILWAY.
  // ────────────────────────────────────────────────────────────────────────
  const paddlePriceIds: Record<string, string> = {
    starter_monthly: pricesData?.starter_monthly || "",
    starter_annual: pricesData?.starter_annual || "",
    growth_monthly: pricesData?.growth_monthly || "",
    growth_annual: pricesData?.growth_annual || "",
    enterprise_monthly: pricesData?.enterprise_monthly || "",
    enterprise_annual: pricesData?.enterprise_annual || "",
    business_monthly: pricesData?.enterprise_monthly || "", // ALIAS — `BUSINESS` (UI) MAPEA A `enterprise_*` (BACKEND)
    business_annual: pricesData?.enterprise_annual || "",
  };

  // ¿EL WORKSPACE YA TIENE SUBSCRIPCION ACTIVA EN PADDLE?
  // SI SI → CAMBIO DE PLAN (PRORRATEADO) VIA BACKEND.
  // SI NO → CHECKOUT NUEVO VIA OVERLAY DE PADDLE.
  const hasActiveSubscription = !!subscription?.provider_subscription_id
    && subscription.status !== 'CANCELLED';

  const handleCheckout = async (tier: PlanTier) => {
    const interval = intervals[tier.key] ?? "monthly";
    const priceKey = `${tier.key.toLowerCase()}_${interval}`;
    const priceId = paddlePriceIds[priceKey] || null;

    if (!priceId) {
      if (tier.key === "BUSINESS_PLUS") {
        toast({ title: "Contactá a ventas", description: "El plan Business+ requiere contacto directo con nuestro equipo." });
      } else if (tier.key === "FREE") {
        toast({ title: "Plan gratuito", description: "Ya estás en el plan Free." });
      } else {
        // IMPORTANTE: ESTE TOAST SOLO DEBERIA APARECER SI EL BACKEND NO TIENE
        // CONFIGURADAS LAS VARIABLES PADDLE_PRICE_* EN RAILWAY. NO ES UN BUG
        // DEL FRONT.
        toast({ title: "No disponible", description: "Este plan aún no está configurado para checkout automático." });
      }
      return;
    }

    // PATH DE CHECKOUT — TODOS LOS UPGRADES PASAN POR EL OVERLAY DE PADDLE Y COBRAN.
    // PADDLE PRORRATEA: UPGRADE COBRA LA DIFERENCIA, DOWNGRADE APLICA AL PROX PERIODO.
    if (!paddle) {
      toast({ title: "Paddle no disponible", description: "El sistema de pagos no está listo. Intentá de nuevo." });
      return;
    }

    setLoading(tier.key);
    try {
      await paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customData: {
          workspaceSlug: user?.workspace?.slug ?? null,
          plan: tier.key.toLowerCase(),
        },
        settings: {
          displayMode: 'overlay',
          theme: 'dark',
          locale: 'es',
          successUrl: `${window.location.origin}/settings/billing?paddle=success`,
        },
      });
    } catch (err: any) {
      if (err?.message !== 'Checkout closed') {
        toast({ title: "Error", description: err?.message || "No se pudo abrir el checkout.", variant: "destructive" });
      }
    } finally {
      setLoading(null);
    }
  };

  const handleExtraSeatCheckout = async () => {
    const priceId = import.meta.env.VITE_PADDLE_PRICE_EXTRA_SEAT || null;
    if (!priceId || !paddle) {
      window.location.href = "mailto:legal@pymeshub.lat?subject=Extra%20seat%20for%20PyMesHub";
      return;
    }
    setLoading("extra");
    try {
      await paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customData: { workspaceSlug: user?.workspace?.slug ?? null },
        settings: { displayMode: 'overlay', theme: 'dark', locale: 'es', successUrl: `${window.location.origin}/settings/billing?paddle=success` },
      });
    } catch (err: any) {
      if (err?.message !== 'Checkout closed') toast({ title: "Error", description: err?.message, variant: "destructive" });
    } finally { setLoading(null); }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground text-sm">Inicia sesión para ver la facturación.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full" style={{ background: "hsl(var(--bg))" }}>
      <PageHeader
        title="Facturación y plan"
        description="Gestiona tu plan actual, explora nuevas opciones y accede a tu historial."
      >
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-[10px] px-2 py-0.5 border ${planBadge}`}>
            Plan {currentPlan}
          </Badge>
        </div>
      </PageHeader>

      <div className="px-6 pb-2">
        <DiagnosticButton module="billing" />
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Success / Cancel alerts */}
        {success && (
          <Alert className="border-emerald-500/20 bg-emerald-500/5">
            <AlertDescription className="text-emerald-400 text-xs">
              Pago exitoso. Tu suscripción fue actualizada.
            </AlertDescription>
          </Alert>
        )}
        {canceled && (
          <Alert className="border-amber-500/20 bg-amber-500/5">
            <AlertDescription className="text-amber-400 text-xs">
              El pago fue cancelado. Tu suscripción no fue modificada.
            </AlertDescription>
          </Alert>
        )}
        {addonParam && (
          <Alert className="border-[#dfff4a]/20 bg-[#dfff4a]/5">
            <AlertDescription className="text-[#dfff4a] text-xs">
              {addonLabels[addonParam] || addonParam} activado correctamente. Ya podés usar sus funciones.
            </AlertDescription>
          </Alert>
        )}

        {/* Current plan info card */}
        <div
          className="rounded-md border p-5"
          style={{
            borderColor: currentPlan === "FREE" ? "hsl(var(--border))" : "hsl(var(--accent) / 0.3)",
            background: currentPlan === "FREE"
              ? "hsl(var(--bg-card) / 0.5)"
              : "linear-gradient(135deg, hsl(var(--accent) / 0.06), hsl(var(--bg-card) / 0.4))",
          }}
        >
          {subLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Cargando suscripción...</span>
            </div>
          ) : subscription ? (
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-semibold text-foreground">
                    Plan {subscription.plan || currentPlan}
                  </span>
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border ${planBadge}`}>
                    Activo
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  ${subscription.monthly_price || 0}/mes
                  {subscription.trial_ends_at && (
                    <span className="text-amber-400 ml-2">
                      · Trial vence {new Date(subscription.trial_ends_at).toLocaleDateString("es-CR")}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Período: {new Date(subscription.current_period_start).toLocaleDateString("es-CR")} –{" "}
                  {new Date(subscription.current_period_end).toLocaleDateString("es-CR")}
                </p>
              </div>
              <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={openBillingPortal}
              >
                  Gestionar suscripción
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 py-1">
              <Crown className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Sin suscripción activa. Elige un plan para empezar.
              </p>
            </div>
          )}
        </div>

        {EXTRA_SEAT_ADD_ON && (
          <div className="rounded-md border border-accent/25 bg-gradient-to-br from-accent/[0.07] via-card/50 to-card/30 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-accent/20 bg-accent/10 text-accent">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground">Usuarios adicionales</h2>
                    <Badge variant="outline" className="border-accent/25 bg-accent/10 text-[10px] text-accent">
                      Add-on
                    </Badge>
                  </div>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                    Agrega usuarios por encima del límite incluido en tu plan. Los planes públicos incluyen Starter 1 usuario,
                    Growth 5 usuarios y Business 15 usuarios.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="rounded-lg border border-border/70 bg-card/60 px-4 py-3">
                  <div className="text-lg font-bold text-foreground">
                    ${EXTRA_SEAT_ADD_ON.monthlyUSD}
                    <span className="ml-1 text-xs font-medium text-muted-foreground">/usuario/mes</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="h-9 text-xs"
                  onClick={handleExtraSeatCheckout}
                      disabled={!!loading}
                >
                  {loading ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Comprar usuario extra
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Plan tier cards grid */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-4">Planes disponibles</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {PLAN_TIERS.filter((t) => t.name !== "Business+").map((tier) => {
              const relation = getPlanRelation(currentPlan, tier.key);
              const isCurrent = relation === "current";
              const isUpgrade = relation === "upgrade";
              const isDowngrade = relation === "downgrade";
              const interval = intervals[tier.key] ?? "monthly";

              return (
                <div
                  key={tier.key + tier.name}
                  className={`rounded-md border p-5 transition-all duration-200 hover:border-accent/30 ${
                    isCurrent
                      ? "border-accent/30 bg-accent/[0.03] ring-1 ring-accent/10"
                      : `border-border/60 bg-card/40 hover:bg-card/60`
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{tier.name}</span>
                        {tier.popular && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border border-violet-500/20 bg-violet-500/10 text-violet-400">
                            Popular
                          </Badge>
                        )}
                        {isCurrent && (
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border ${planBadge}`}>
                            Actual
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{tier.description}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-4">
                    {tier.monthlyUSD === 0 && tier.name === "Free" ? (
                      <div className="text-2xl font-bold text-foreground">Gratis</div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-foreground">
                          ${tier.monthlyUSD}
                        </span>
                        <span className="text-xs text-muted-foreground">/mes</span>
                      </div>
                    )}
                    <p className="mt-2 text-[11px] font-medium text-foreground">
                      {tier.usersLabel}
                    </p>
                  </div>

                  {/* Limits */}
                  <div className="space-y-2 mb-4">
                    {tier.limits.map((lim) => {
                      const Icon = lim.icon;
                      return (
                        <div key={lim.label} className="flex items-center gap-2 text-[11px]">
                          <Icon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground">{lim.label}:</span>
                          <span className="text-foreground font-medium ml-auto">{lim.value}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Highlights */}
                  <ul className="space-y-1.5 mb-4">
                    {tier.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <Check className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                        {h}
                      </li>
                    ))}
                  </ul>

                  {/* Action button */}
                  {isCurrent ? (
                    <Button size="sm" className="w-full h-8 text-xs" variant="outline" disabled>
                      <Check className="w-3.5 h-3.5 mr-1.5" /> Plan actual
                    </Button>
                  ) : isUpgrade ? (
                    <Button
                      size="sm"
                      className="w-full h-8 text-xs gap-1.5"
                      onClick={() => handleCheckout(tier)}
                      disabled={!!loading}
                    >
                      {loading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      )}
                      Mejorar a {tier.name}
                    </Button>
                  ) : (
                    <div className="space-y-1.5">
                      <Button size="sm" className="w-full h-8 text-xs" variant="ghost" disabled>
                        <ArrowDownRight className="w-3.5 h-3.5 mr-1.5" /> Cambiar a este plan
                      </Button>
                      <p className="text-center text-[10px] text-muted-foreground">
                        Los cambios de plan aplican al final del período actual.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Business+ card (separate, wider or different style) */}
            {(() => {
              const tier = PLAN_TIERS.find((t) => t.name === "Business+")!;
              const isCurrent = currentPlan === "BUSINESS_PLUS" || currentPlan === "ENTERPRISE";
              return (
                <div
                  className={`rounded-md border p-5 transition-all duration-200 md:col-span-2 xl:col-span-1 ${
                    isCurrent
                      ? "border-yellow-500/30 bg-yellow-500/[0.03] ring-1 ring-yellow-500/10"
                      : "border-yellow-500/20 bg-gradient-to-br from-yellow-500/[0.03] to-card/40 hover:border-yellow-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{tier.name}</span>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border border-yellow-500/20 bg-yellow-500/10 text-yellow-400">
                          Enterprise
                        </Badge>
                        {isCurrent && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border border-yellow-500/20 bg-yellow-500/10 text-yellow-400">
                            Actual
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{tier.description}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-2xl font-bold text-foreground">Personalizado</div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Precio a medida según tus necesidades</p>
                  </div>

                  <ul className="space-y-1.5 mb-4">
                    {tier.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <Check className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />
                        {h}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <Button size="sm" className="w-full h-8 text-xs" variant="outline" disabled>
                      <Check className="w-3.5 h-3.5 mr-1.5" /> Plan actual
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full h-8 text-xs gap-1.5 bg-yellow-600 hover:bg-yellow-700 text-white"
                      onClick={() => toast({ title: "Contactá a ventas", description: "Escribinos a ventas@pymeshub.lat para armar tu plan Business+ a medida." })}
                    >
                      Contactar a ventas
                    </Button>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Downgrade explanation banner */}
          <div className="mt-4 rounded-lg border border-border/60 bg-card/30 p-3 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">
              <span className="text-foreground font-medium">Importante:</span> Los cambios de plan (upgrade o downgrade) se facturan de forma prorrateada. Si mejoras a un plan superior, solo pagarás la diferencia por los días restantes del período. Si bajas de plan, el cambio aplica al final del período de facturación actual.
            </p>
          </div>
        </div>

        {/* Billing history */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Historial de facturación</h2>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              onClick={openBillingPortal}
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Ver todas en Paddle
            </Button>
          </div>
          <BillingHistory openBillingPortal={openBillingPortal} />
        </div>
      </div>
    </div>
  );
}

function BillingHistory({ openBillingPortal }: { openBillingPortal: () => void }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/billing/invoices", { page, search }],
    queryFn: () => api.getBillingInvoices({ page, limit: 10, search: search || undefined }),
    retry: false,
    staleTime: 30_000,
    refetchInterval: 15_000,
  });

  const invoices = Array.isArray(data?.data) ? data.data : [];
  const meta = data?.meta;

  if (isLoading) {
    return (
      <div className="rounded-md border border-border/60 bg-card/40 p-6 text-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mx-auto" />
      </div>
    );
  }

  if (invoices.length === 0 && !search) {
    return (
      <div className="rounded-md border border-border/60 bg-card/40 p-6 text-center">
        <Receipt className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
        <p className="text-xs text-muted-foreground mb-3">
          Aún no hay facturas. La primera aparecerá después de tu primer pago.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px]"
          onClick={openBillingPortal}
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          Ver facturas en Paddle
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border/60 bg-card/40 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border/60">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por número, cliente, plan o estado..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-8 pl-8 pr-3 rounded-md border border-border/60 bg-background/60 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 transition-colors"
          />
        </div>
      </div>
      <div className="divide-y divide-border/60">
        {invoices.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-muted-foreground">
              No se encontraron facturas con "{search}".
            </p>
          </div>
        ) : (
          invoices.map((inv: any) => (
            <div key={inv.id} className="flex items-center justify-between px-4 py-3 hover:bg-foreground/[0.015] transition-colors">
              <div>
                <div className="text-xs font-medium text-foreground">
                  {inv.number || inv.receipt_number || `Factura #${inv.id?.slice(0, 8)}`}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {inv.created_at ? new Date(inv.created_at).toLocaleDateString("es-CR") : ""}
                  {inv.status ? ` · ${inv.status}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-foreground">
                  {inv.amount ? `₡${Number(inv.amount).toLocaleString("es-CR")}` : ""}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px]"
                onClick={async () => {
                  const token = getAuthToken();
                  const apiBase = import.meta.env.VITE_API_URL || '';
                  const res = await fetch(`${apiBase}/api/billing/invoices/${inv.id}/pdf`, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  window.open(url, "_blank");
                }}
                >
                  PDF
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {meta && meta.pages > 1 && (
        <div className="px-4 py-2.5 border-t border-border/60 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {meta.total} factura{meta.total !== 1 ? "s" : ""} · Página {meta.page} de {meta.pages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px]"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px]"
              disabled={page >= meta.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      <HelpButton page="Facturación" />
    </div>
  );
}
