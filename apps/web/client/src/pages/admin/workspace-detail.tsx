import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useParams, useLocation } from "wouter";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/loading-spinner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Crown, Trash2, AlertTriangle, Loader2, Save, ToggleLeft, Shield, Info, Copy, ExternalLink,
  UserPlus, MoreHorizontal, CreditCard, Receipt, Building2,
} from "lucide-react";

/**
 * One workspace, four concerns: identity, membership, subscription and deletion.
 *
 * ## The slug comes from the router now, not from a blacklist
 *
 * It used to be derived by splitting the path and then rejecting anything that looked
 * like a sibling route:
 *
 * ```ts
 * const slug = location.split("/").pop() ?? "";
 * const validSlug = !!slug && !["workspaces","users","plan-limits"].includes(slug);
 * ```
 *
 * That only worked because wouter's `<Switch>` is ordered and `/admin/workspaces` is
 * matched before `/admin/workspaces/:slug`. The list was already stale — `/admin/landing`
 * and `/admin/router-metrics` were never added — so the page treated a sibling route as a
 * workspace slug and fired a lookup for it. `useParams` asks the router what the `:slug`
 * segment actually is, which cannot go stale when a route is added.
 */

/** From the `WorkspaceUserRole` Prisma enum; the PATCH validates against it. */
const MEMBER_ROLES = ["OWNER", "ADMIN", "MANAGER", "AGENT", "BILLING", "VIEWER"] as const;

/** From the `WorkspacePlan` Prisma enum. */
const PLANS = [
  "FREE", "EMPRENDE", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE", "BUSINESS_PLUS", "BETA_INFORMAL",
] as const;

/** From `WorkspaceSubscriptionStatus`. */
const SUB_STATUSES = [
  "TRIALING", "ACTIVE", "PAST_DUE", "UNPAID", "CANCELLED", "EXPIRED", "MANUAL",
] as const;

/** From `BillingProvider`. */
const PROVIDERS = ["MANUAL", "STRIPE", "PAYPAL", "PADDLE", "BAC", "CUSTOM"] as const;

/** From `BillingInterval`. */
const INTERVALS = ["MONTHLY", "YEARLY", "ONE_TIME", "CUSTOM"] as const;

/**
 * `updateWorkspaceProfile` validates against this list and refuses anything else.
 * Note the side effect: choosing `emprende` also sets `beta_profile` to
 * `EMPRENDE_ELIGIBLE`, and choosing anything else clears it.
 */
const COMMERCIAL_PROFILES = ["emprende", "business", "enterprise"] as const;

const PROFILE_LABEL: Record<string, string> = {
  emprende: "Emprende",
  business: "Business",
  enterprise: "Enterprise",
};


const BETA_PROFILE_FEATURES: Record<string, Record<string, boolean>> = {
  BETA_LIGHT:       { contacts:true, orders:true, reminders:true, dashboard:true, conversations:false, whatsapp_inbox:false, billing:false, automations:false, roles:false, reports:false, api_access:false, multi_location:false, audit_logs:false },
  BETA_CONVERSATIONS:{ contacts:true, reminders:true, conversations:true, whatsapp_inbox:true, dashboard:true, orders:false, billing:false, automations:false, roles:false, reports:false, api_access:false, multi_location:false, audit_logs:false },
  BETA_OPERATIONS:  { contacts:true, orders:true, reminders:true, conversations:true, dashboard:true, roles:true, whatsapp_inbox:false, billing:false, automations:false, reports:false, api_access:false, multi_location:false, audit_logs:false },
  EMPRENDE_ELIGIBLE: {},
};
const BETA_PROFILE_LIMITS: Record<string, Record<string, number>> = {
  BETA_LIGHT:       { "contacts.max":150, "users.max":1, "channels.max":0, "orders.monthly_max":100, "invoices.monthly_max":0, "automations.max":0, "storage.gb":1 },
  BETA_CONVERSATIONS:{ "contacts.max":300, "users.max":2, "channels.max":1, "orders.monthly_max":0,  "invoices.monthly_max":0, "automations.max":0, "storage.gb":2 },
  BETA_OPERATIONS:  { "contacts.max":500, "users.max":3, "channels.max":1, "orders.monthly_max":300, "invoices.monthly_max":0, "automations.max":0, "storage.gb":3 },
  EMPRENDE_ELIGIBLE: {},
};

const featureList = ["contacts","orders","reminders","conversations","whatsapp_inbox","billing","automations","dashboard","roles","reports","api_access","multi_location","audit_logs"];
const limitList = ["contacts.max","users.max","channels.max","orders.monthly_max","invoices.monthly_max","automations.max","storage.gb"];

export default function AdminWorkspaceDetail() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  // The router knows what `:slug` matched. The old path-split plus blacklist could not,
  // and had already gone stale against `/admin/landing` and `/admin/router-metrics`.
  const { slug = "" } = useParams<{ slug: string }>();
  const validSlug = slug.length > 0;

  // Declared before the queries because `billingQ` gates on the active tab, and a
  // variable read above its declaration is a runtime `undefined` dressed up as a
  // compile error.
  const [tab, setTab] = useState("info");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/platform/workspace", slug],
    queryFn: () => api.platformGetWorkspaceBySlug(slug),
    enabled: !!user?.is_platform_admin && validSlug,
    retry: false,
  });

  const featuresQ = useQuery({
    queryKey: ["/api/platform/workspaces", slug, "features"],
    queryFn: () => api.platformGetWorkspaceFeatures(slug),
    enabled: !!user?.is_platform_admin && validSlug,
    retry: false,
  });

  const samlQ = useQuery({
    queryKey: ["/api/auth/saml/status", slug],
    queryFn: () => api.checkSamlStatus(slug),
    enabled: validSlug,
    retry: false,
  });

  const membersQ = useQuery({
    queryKey: ["/api/platform/workspaces", slug, "members"],
    queryFn: () => api.platformListMembers(slug),
    enabled: !!user?.is_platform_admin && validSlug,
    retry: false,
  });

  const billingQ = useQuery({
    queryKey: ["/api/platform/workspaces", slug, "billing"],
    queryFn: () => api.platformGetWorkspaceBilling(slug),
    enabled: !!user?.is_platform_admin && validSlug && tab === "billing",
    retry: false,
  });

  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [edit, setEdit] = useState<any>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [invite, setInvite] = useState({ email: "", role: "AGENT" });
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string; email: string } | null>(null);
  const [billingEdit, setBillingEdit] = useState<Record<string, any> | null>(null);

  const fail = (e: unknown) =>
    toast({
      title: "No se pudo completar la acción",
      description: e instanceof Error ? e.message : String(e),
      variant: "destructive",
    });

  const featuresMut = useMutation({
    mutationFn: (d: Record<string, any>) => api.platformUpdateWorkspaceFeatures(slug, d),
    onSuccess: () => { toast({ title: "Configuración guardada" }); void featuresQ.refetch(); },
    onError: fail,
  });

  const profileMut = useMutation({
    mutationFn: (profile: string) => api.platformUpdateWorkspaceProfile(slug, profile),
    onSuccess: () => {
      toast({ title: "Perfil comercial actualizado" });
      void queryClient.invalidateQueries({ queryKey: ["/api/platform/workspace", slug] });
      void featuresQ.refetch();
    },
    onError: fail,
  });

  const addMemberMut = useMutation({
    mutationFn: () => api.platformAssignMember(slug, { email: invite.email.trim(), role: invite.role }),
    onSuccess: () => {
      setAddOpen(false);
      setInvite({ email: "", role: "AGENT" });
      toast({ title: "Miembro agregado" });
      void membersQ.refetch();
    },
    onError: fail,
  });

  const roleMut = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.platformUpdateMemberRole(slug, userId, role),
    onSuccess: () => { toast({ title: "Rol actualizado" }); void membersQ.refetch(); },
    onError: fail,
  });

  const removeMemberMut = useMutation({
    mutationFn: (userId: string) => api.platformRemoveMember(slug, userId),
    onSuccess: () => {
      setRemoveTarget(null);
      toast({ title: "Acceso revocado" });
      void membersQ.refetch();
    },
    onError: (e) => { setRemoveTarget(null); fail(e); },
  });

  const billingMut = useMutation({
    mutationFn: (payload: Record<string, any>) => api.platformUpdateWorkspaceBilling(slug, payload),
    onSuccess: () => {
      setBillingEdit(null);
      toast({ title: "Suscripción actualizada" });
      void billingQ.refetch();
    },
    onError: fail,
  });

  const deleteMut = useMutation({
    mutationFn: () => api.platformDeleteWorkspace(slug),
    onSuccess: () => { toast({ title: "Workspace eliminado" }); navigate("/admin/workspaces"); },
    onError: fail,
  });

  const openEditor = () => {
    if (!featuresQ.data) return;
    setEdit({
      plan: featuresQ.data.plan,
      beta: featuresQ.data.beta_profile ?? "",
      feat: { ...featuresQ.data.features },
      lim: { ...featuresQ.data.limits },
      reason: "",
    });
  };

  const applyBetaProfile = (profile: string) => {
    if (!edit) return;
    const featPreset = BETA_PROFILE_FEATURES[profile];
    const limPreset = BETA_PROFILE_LIMITS[profile];
    setEdit({
      ...edit,
      beta: profile,
      feat: featPreset ? { ...edit.feat, ...featPreset } : edit.feat,
      lim: limPreset ? { ...edit.lim, ...limPreset } : edit.lim,
    });
    toast({ title: `Perfil ${profile} aplicado — revisá y ajustá antes de guardar.` });
  };

  if (isLoading) return <PageLoader />;
  const ws = data ?? {};

  return (
    <div className="min-h-full" style={{ background: "hsl(var(--bg))" }}>
      <PageHeader title={ws.name ?? slug} description="Workspace details and configuration.">
        <div className="flex items-center gap-2">
          {featuresQ.data?.beta_profile && <Badge variant="outline" className="text-[10px]">{featuresQ.data.beta_profile}</Badge>}
          <Badge variant="outline" className="text-[10px]">{featuresQ.data?.plan ?? ws.plan}</Badge>
        </div>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab} className="px-6 py-4">
        <TabsList className="bg-card border border-border mb-4">
          <TabsTrigger value="info" className="data-[state=active]:bg-elevated"><Info className="w-3.5 h-3.5 mr-1.5" />Info</TabsTrigger>
          <TabsTrigger value="members" className="data-[state=active]:bg-elevated"><UserPlus className="w-3.5 h-3.5 mr-1.5" />Equipo</TabsTrigger>
          <TabsTrigger value="billing" className="data-[state=active]:bg-elevated"><CreditCard className="w-3.5 h-3.5 mr-1.5" />Suscripción</TabsTrigger>
          <TabsTrigger value="features" className="data-[state=active]:bg-elevated"><ToggleLeft className="w-3.5 h-3.5 mr-1.5" />Features</TabsTrigger>
          <TabsTrigger value="sso" className="data-[state=active]:bg-elevated"><Shield className="w-3.5 h-3.5 mr-1.5" />SSO / SAML</TabsTrigger>
          <TabsTrigger value="danger" className="data-[state=active]:bg-elevated"><AlertTriangle className="w-3.5 h-3.5 mr-1.5" />Peligro</TabsTrigger>
        </TabsList>

        {/* ── Info ── */}
        <TabsContent value="info" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-card/40 p-4">
              <div className="text-[11px] text-muted-foreground">Slug</div>
              <div className="text-sm font-medium text-foreground">{ws.slug}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/40 p-4">
              <div className="text-[11px] text-muted-foreground">Status</div>
              <div className="text-sm font-medium text-foreground">{ws.status ?? "ACTIVE"}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/40 p-4">
              <div className="text-[11px] text-muted-foreground">Created</div>
              <div className="text-sm font-medium text-foreground">
                {ws.created_at ? new Date(ws.created_at).toLocaleDateString() : "—"}
              </div>
            </div>
          </div>
          {ws.subscription && (
            <div className="rounded-xl border border-border/60 bg-card/40 p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Crown className="w-4 h-4 text-amber-400" />Subscription</h3>
              <div className="grid gap-3 md:grid-cols-2 text-xs">
                {["provider","plan","status","billing_interval"].map(k => (
                  <div key={k}><span className="text-muted-foreground">{k}:</span> <span className="text-foreground">{(ws.subscription as any)[k]}</span></div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Commercial profile ── */}
        <TabsContent value="info" className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card/40 p-5">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />Perfil comercial
                </h3>
                {/* `updateWorkspaceProfile` is not a plain column write: `emprende` also
                    sets `beta_profile` to EMPRENDE_ELIGIBLE, and any other value clears
                    it. That is a plan-entitlement side effect, so it is stated here
                    rather than discovered later in the Features tab. */}
                <p className="text-[10px] text-muted-foreground mt-1">
                  Elegir <strong>Emprende</strong> marca el workspace como elegible para
                  PymesHub Emprende. Cualquier otro valor lo desmarca.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-[10px]">
                  {PROFILE_LABEL[ws.profile] ?? ws.profile ?? "—"}
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {COMMERCIAL_PROFILES.map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={ws.profile === p ? "default" : "outline"}
                  className="h-7 text-[10px]"
                  disabled={profileMut.isPending || ws.profile === p}
                  onClick={() => profileMut.mutate(p)}
                >
                  {profileMut.isPending && profileMut.variables === p && (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  )}
                  {PROFILE_LABEL[p]}
                </Button>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── Team ── */}
        <TabsContent value="members" className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card/40">
            <div className="flex items-center justify-between p-5 pb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-muted-foreground" />Equipo
              </h3>
              <Button size="sm" className="h-7 text-[10px]" onClick={() => setAddOpen(true)}>
                <UserPlus className="w-3 h-3 mr-1" />Agregar
              </Button>
            </div>

            {membersQ.isLoading ? (
              <div className="p-5"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : membersQ.isError ? (
              <div className="p-5">
                <p className="text-xs text-red-400 mb-2">No se pudo cargar el equipo.</p>
                <p className="text-[10px] text-muted-foreground mb-3">
                  {membersQ.error instanceof Error ? membersQ.error.message : ""}
                </p>
                <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => void membersQ.refetch()}>
                  Reintentar
                </Button>
              </div>
            ) : (membersQ.data?.length ?? 0) === 0 ? (
              <p className="p-5 text-xs text-muted-foreground">Este workspace no tiene miembros.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {(membersQ.data as any[]).map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground truncate">{m.user?.name}</span>
                        {m.user?.is_platform_admin && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-yellow-500/20 bg-yellow-500/10 text-yellow-400">
                            Admin
                          </Badge>
                        )}
                        {m.is_owner && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-500/20 bg-amber-500/10 text-amber-400">
                            Owner
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{m.user?.email}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* The role dropdown is disabled for the owner because
                          `removeMember` refuses to remove them and their role is not
                          ours to reassign from this screen. */}
                      <select
                        className="h-7 text-[10px] bg-background border border-border rounded-md px-2 disabled:opacity-50"
                        value={m.role}
                        disabled={m.is_owner || roleMut.isPending}
                        aria-label={`Rol de ${m.user?.email}`}
                        onChange={(e) => roleMut.mutate({ userId: m.user.id, role: e.target.value })}
                      >
                        {MEMBER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Acciones para ${m.user?.email}`}
                            disabled={m.is_owner}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel>Rol en el workspace</DropdownMenuLabel>
                          {MEMBER_ROLES.map((r) => (
                            <DropdownMenuItem
                              key={r}
                              disabled={m.is_owner || m.role === r || roleMut.isPending}
                              onSelect={() => roleMut.mutate({ userId: m.user.id, role: r })}
                            >
                              {r}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-400 focus:text-red-400"
                            onSelect={() =>
                              setRemoveTarget({ id: m.user.id, name: m.user.name, email: m.user.email })
                            }
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />Revocar acceso
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Subscription ── */}
        <TabsContent value="billing" className="space-y-4">
          {billingQ.isLoading ? (
            <div className="rounded-xl border border-border/60 bg-card/40 p-5">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : billingQ.isError ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-5">
              <p className="text-xs text-red-400 mb-2">No se pudo cargar la suscripción.</p>
              <p className="text-[10px] text-muted-foreground mb-3">
                {billingQ.error instanceof Error ? billingQ.error.message : ""}
              </p>
              <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => void billingQ.refetch()}>
                Reintentar
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border/60 bg-card/40 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400" />Suscripción
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    onClick={() => {
                      const s = billingQ.data?.subscription;
                      setBillingEdit({
                        plan: s?.plan ?? data?.plan ?? "FREE",
                        status: s?.status ?? "MANUAL",
                        provider: s?.provider ?? "MANUAL",
                        billing_interval: s?.billing_interval ?? "MONTHLY",
                        provider_customer_id: s?.provider_customer_id ?? "",
                        provider_subscription_id: s?.provider_subscription_id ?? "",
                        external_reference: s?.external_reference ?? "",
                        current_period_start: s?.current_period_start?.slice(0, 10) ?? "",
                        current_period_end: s?.current_period_end?.slice(0, 10) ?? "",
                        trial_ends_at: s?.trial_ends_at?.slice(0, 10) ?? "",
                        cancel_at_period_end: s?.cancel_at_period_end ?? false,
                        notes: s?.notes ?? "",
                      });
                    }}
                  >
                    <Save className="w-3 h-3 mr-1" />Editar
                  </Button>
                </div>

                {billingQ.data?.subscription ? (
                  <div className="grid gap-3 md:grid-cols-3 text-xs">
                    {[
                      ["plan", billingQ.data.subscription.plan],
                      ["status", billingQ.data.subscription.status],
                      ["provider", billingQ.data.subscription.provider],
                      ["interval", billingQ.data.subscription.billing_interval],
                      ["inicio", billingQ.data.subscription.current_period_start?.slice(0, 10) ?? "—"],
                      ["fin", billingQ.data.subscription.current_period_end?.slice(0, 10) ?? "—"],
                    ].map(([k, v]) => (
                      <div key={k as string}>
                        <span className="text-muted-foreground">{k}:</span>{" "}
                        <span className="text-foreground">{String(v ?? "—")}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Este workspace no tiene suscripción. Al guardar se crea una.
                  </p>
                )}
              </div>

              {/* `getWorkspaceBilling` returns the 10 most recent events, ordered newest
                  first, and there is no pagination or total on the endpoint. */}
              <div className="rounded-xl border border-border/60 bg-card/40 p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-muted-foreground" />Últimos eventos de facturación
                </h3>
                {(billingQ.data?.events?.length ?? 0) === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin eventos registrados.</p>
                ) : (
                  <div className="space-y-1.5 text-[10px]">
                    {(billingQ.data?.events ?? []).map((e: any) => (
                      <div key={e.id} className="flex items-center justify-between gap-3 border-b border-border/40 pb-1.5 last:border-0">
                        <span className="text-foreground">
                          {e.event_type ?? "—"} <span className="text-muted-foreground">· {e.source ?? "—"}</span>
                        </span>
                        <span className="text-muted-foreground shrink-0">
                          {e.created_at ? new Date(e.created_at).toLocaleDateString() : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Features ── */}
        <TabsContent value="features" className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card/40 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><ToggleLeft className="w-4 h-4 text-blue-400" />Features</h3>
              <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={openEditor}><Save className="w-3 h-3 mr-1" />Configurar</Button>
            </div>
            {featuresQ.data ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1.5 text-xs">
                  {featureList.map(f => (
                    <div key={f} className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${featuresQ.data.features[f] ? "bg-green-400" : "bg-zinc-600"}`} />
                      <span className={featuresQ.data.features[f] ? "text-foreground" : "text-muted-foreground"}>{f}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-[10px] text-muted-foreground">
                  Plan: {featuresQ.data.plan}{featuresQ.data.beta_profile ? ` · Perfil comercial: ${featuresQ.data.beta_profile}` : ""}
                </div>
              </>
            ) : <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
        </TabsContent>

        {/* ── SSO / SAML ── */}
        <TabsContent value="sso" className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card/40 p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-muted-foreground" />SAML SSO</h3>
            {samlQ.data ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${samlQ.data.configured ? "bg-green-400" : "bg-zinc-500"}`} />
                  <span className={samlQ.data.configured ? "text-green-400 font-medium" : "text-muted-foreground"}>{samlQ.data.configured ? "Activo" : "No configurado"}</span>
                </div>
                {samlQ.data.configured && (
                  <>
                    <div className="flex items-center gap-2">
                      <Input value={samlQ.data.loginUrl} readOnly className="text-[10px] font-mono h-7 flex-1 bg-background border-border" />
                      <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => { void navigator.clipboard.writeText(samlQ.data.loginUrl); toast({ title: "Copiado" }); }}><Copy className="w-3 h-3" /></Button>
                      <a href={samlQ.data.loginUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline whitespace-nowrap flex items-center gap-1"><ExternalLink className="w-3 h-3" />Probar</a>
                    </div>
                    <div><span className="text-muted-foreground">Metadata: </span><span className="text-foreground">/api/auth/saml/{slug}/metadata</span></div>
                  </>
                )}
              </div>
            ) : <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
        </TabsContent>

        {/* ── Danger ── */}
        <TabsContent value="danger" className="space-y-4">
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-400" />Zona de peligro</h3>
                <p className="text-xs text-muted-foreground mt-1">Eliminar este workspace es irreversible. Todos los datos asociados se marcarán como eliminados.</p>
              </div>
              <Button variant="outline" size="sm" className="h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0" onClick={() => setShowDelete(true)}>
                <Trash2 className="w-3.5 h-3.5 mr-1" />Eliminar
              </Button>
            </div>
            {showDelete && (
              <div className="mt-4 pt-4 border-t border-red-500/10 space-y-3">
                <p className="text-xs text-muted-foreground">Escribí <span className="font-semibold text-red-400">confirmar</span> para eliminar este workspace.</p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label className="text-[11px]">Confirmación</Label>
                    <Input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="confirmar" className="h-9 text-xs bg-background border-border" autoFocus />
                  </div>
                  <Button variant="destructive" size="sm" className="h-9 text-xs" disabled={confirmText !== "confirmar" || deleteMut.isPending} onClick={() => deleteMut.mutate()}>
                    {deleteMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}Confirmar eliminación
                  </Button>
                  <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setShowDelete(false); setConfirmText(""); }}>Cancelar</Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Add member ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Agregar miembro</DialogTitle>
            <DialogDescription>
              La persona tiene que tener una cuenta en PymesHub. Si no existe, el API la rechaza
              con “Debe registrarse primero” — no hay invitación por email desde acá.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[11px]">Email</Label>
              <Input
                type="email"
                autoFocus
                className="h-9 text-xs bg-background border-border"
                value={invite.email}
                onChange={(e) => setInvite({ ...invite, email: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-[11px]">Rol</Label>
              <select
                className="w-full h-9 text-xs bg-background border border-border rounded-md px-2"
                value={invite.role}
                onChange={(e) => setInvite({ ...invite, role: e.target.value })}
              >
                {MEMBER_ROLES.filter((r) => r !== "OWNER").map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {/* OWNER is filtered out above because `assignMember` always writes
                  `is_owner: false`, so sending it would grant a role the membership does
                  not actually hold. */}
              <p className="text-[10px] text-muted-foreground mt-1">
                OWNER no se puede asignar desde acá: la API siempre crea la membresía con{" "}
                <code>is_owner: false</code>.
              </p>
            </div>
            {addMemberMut.isError && (
              <p className="text-[10px] text-red-400">
                {addMemberMut.error instanceof Error ? addMemberMut.error.message : ""}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              disabled={addMemberMut.isPending || !invite.email.trim()}
              onClick={() => addMemberMut.mutate()}
            >
              {addMemberMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Revocar acceso"
        description={
          removeTarget
            ? `${removeTarget.email} va a perder el acceso a ${ws.name ?? slug}. Si sigue trabajando ahí, va a tener que volver a ser miembro.`
            : ""
        }
        confirmLabel="Revocar"
        destructive
        onConfirm={() => removeTarget && removeMemberMut.mutate(removeTarget.id)}
      />

      {/* ── Billing editor ── */}
      <Dialog open={billingEdit !== null} onOpenChange={(open) => !open && setBillingEdit(null)}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar suscripción</DialogTitle>
            <DialogDescription>
              Sobrescribe la suscripción del workspace. Cada cambio escribe un evento de
              facturación.
            </DialogDescription>
          </DialogHeader>

          {billingEdit && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px]">Plan</Label>
                  <select
                    className="w-full h-8 text-xs bg-background border border-border rounded-md px-2"
                    value={billingEdit.plan}
                    onChange={(e) => setBillingEdit({ ...billingEdit, plan: e.target.value })}
                  >
                    {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-[10px]">Estado</Label>
                  <select
                    className="w-full h-8 text-xs bg-background border border-border rounded-md px-2"
                    value={billingEdit.status}
                    onChange={(e) => setBillingEdit({ ...billingEdit, status: e.target.value })}
                  >
                    {SUB_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-[10px]">Proveedor</Label>
                  <select
                    className="w-full h-8 text-xs bg-background border border-border rounded-md px-2"
                    value={billingEdit.provider}
                    onChange={(e) => setBillingEdit({ ...billingEdit, provider: e.target.value })}
                  >
                    {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-[10px]">Intervalo</Label>
                  <select
                    className="w-full h-8 text-xs bg-background border border-border rounded-md px-2"
                    value={billingEdit.billing_interval}
                    onChange={(e) => setBillingEdit({ ...billingEdit, billing_interval: e.target.value })}
                  >
                    {INTERVALS.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px]">Customer ID (proveedor)</Label>
                  <Input
                    className="h-8 text-xs bg-background border-border"
                    value={billingEdit.provider_customer_id}
                    onChange={(e) => setBillingEdit({ ...billingEdit, provider_customer_id: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Subscription ID (proveedor)</Label>
                  <Input
                    className="h-8 text-xs bg-background border-border"
                    value={billingEdit.provider_subscription_id}
                    onChange={(e) => setBillingEdit({ ...billingEdit, provider_subscription_id: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Referencia externa</Label>
                  <Input
                    className="h-8 text-xs bg-background border-border"
                    value={billingEdit.external_reference}
                    onChange={(e) => setBillingEdit({ ...billingEdit, external_reference: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Notas</Label>
                  <Input
                    className="h-8 text-xs bg-background border-border"
                    value={billingEdit.notes}
                    onChange={(e) => setBillingEdit({ ...billingEdit, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {([
                  ["current_period_start", "Inicio del período"],
                  ["current_period_end", "Fin del período"],
                  ["trial_ends_at", "Fin de prueba"],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <Label className="text-[10px]">{label}</Label>
                    <Input
                      type="date"
                      className="h-8 text-xs bg-background border-border"
                      value={billingEdit[key] ?? ""}
                      onChange={(e) => setBillingEdit({ ...billingEdit, [key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>

              <label className="flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={!!billingEdit.cancel_at_period_end}
                  onChange={(e) => setBillingEdit({ ...billingEdit, cancel_at_period_end: e.target.checked })}
                />
                Cancelar al final del período actual
              </label>

              {/* `metadata_json` and `payload_json` exist on the DTO but carry no
                  class-validator decorator, so with `forbidNonWhitelisted: true` the
                  global pipe rejects them with a 400. They are omitted from this form
                  for that reason — the DTO is the thing that needs fixing, not the
                  client. See the plan's backend-work table. */}
              {billingMut.isError && (
                <p className="text-[10px] text-red-400">
                  {billingMut.error instanceof Error ? billingMut.error.message : ""}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setBillingEdit(null)}>Cancelar</Button>
            <Button
              size="sm"
              disabled={billingMut.isPending}
              onClick={() => {
                if (!billingEdit) return;
                // Empty optional values are omitted rather than sent as "": the date
                // fields are `@IsDateString()`, and an empty string fails that check.
                const text = (v: unknown) => (typeof v === "string" ? v.trim() : v);
                const payload: Record<string, any> = {
                  plan: billingEdit.plan,
                  status: billingEdit.status,
                  provider: billingEdit.provider,
                  billing_interval: billingEdit.billing_interval,
                  cancel_at_period_end: !!billingEdit.cancel_at_period_end,
                };
                for (const key of [
                  "provider_customer_id",
                  "provider_subscription_id",
                  "external_reference",
                  "notes",
                  "current_period_start",
                  "current_period_end",
                  "trial_ends_at",
                ]) {
                  const value = text(billingEdit[key]);
                  if (value) payload[key] = value;
                }
                billingMut.mutate(payload);
              }}
            >
              {billingMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feature editor modal */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEdit(null)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold">Configurar Features</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px]">Plan</Label>
                <select className="w-full h-8 text-xs bg-background border border-border rounded-md px-2" value={edit.plan} onChange={e => setEdit({...edit, plan: e.target.value})}>
                  {["FREE","EMPRENDE","STARTER","GROWTH","BUSINESS","ENTERPRISE","BUSINESS_PLUS","BETA_INFORMAL"].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-[10px]">Perfil comercial</Label>
                <div className="flex gap-1">
                  <select className="flex-1 h-8 text-xs bg-background border border-border rounded-md px-2" value={edit.beta} onChange={e => applyBetaProfile(e.target.value)}>
                    <option value="">(ninguno)</option>
                    {Object.keys(BETA_PROFILE_FEATURES).map(p => (
                      <option key={p} value={p}>
                        {p === "EMPRENDE_ELIGIBLE" ? "PymesHub Emprende elegible" : p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {featureList.map(f => (
                <label key={f} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={!!edit.feat[f]} onChange={e => setEdit({...edit, feat: {...edit.feat, [f]: e.target.checked}})} />{f}
                </label>
              ))}
            </div>

            <div className="border-t border-border pt-3">
              <h4 className="text-[10px] font-medium text-muted-foreground mb-2">Límites</h4>
              <div className="grid grid-cols-2 gap-2">
                {limitList.map(l => (
                  <div key={l}><Label className="text-[9px]">{l}</Label>
                    <Input type="number" className="h-7 text-xs" value={(edit.lim as any)[l] ?? 0} onChange={e => setEdit({...edit, lim: {...edit.lim, [l]: Number(e.target.value)}})} />
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <h4 className="text-[10px] font-medium text-muted-foreground mb-2">Límites IA custom (ENTERPRISE / BUSINESS_PLUS)</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[9px]">Ejecuciones agente/día</Label>
                  <Input type="number" className="h-7 text-xs" placeholder="ilimitado"
                    value={(edit.lim as any).custom_agent_executions_per_day ?? ""}
                    onChange={e => setEdit({...edit, lim: {...edit.lim, custom_agent_executions_per_day: e.target.value ? Number(e.target.value) : undefined}})} />
                </div>
                <div>
                  <Label className="text-[9px]">Mensajes IA chat/día</Label>
                  <Input type="number" className="h-7 text-xs" placeholder="ilimitado"
                    value={(edit.lim as any).custom_ai_chat_messages_per_day ?? ""}
                    onChange={e => setEdit({...edit, lim: {...edit.lim, custom_ai_chat_messages_per_day: e.target.value ? Number(e.target.value) : undefined}})} />
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground mt-1">Solo aplica cuando el plan tiene límite "custom". Se guarda en settings_json.</p>
            </div>

            <div>
              <Label className="text-[10px]">Motivo (audit log)</Label>
              <Input className="h-8 text-xs" value={edit.reason} onChange={e => setEdit({...edit, reason: e.target.value})} placeholder="Ej: Cliente aprobado para PymesHub Emprende" />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setEdit(null)}>Cancelar</Button>
              <Button size="sm" className="h-8 text-xs" onClick={() => {
                featuresMut.mutate({ plan: edit.plan, beta_profile: edit.beta || null, features: edit.feat, limits: edit.lim, reason: edit.reason || undefined });
                setEdit(null);
              }} disabled={featuresMut.isPending}>
                {featuresMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
