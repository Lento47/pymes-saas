import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, Building2, UserPlus, UserMinus, Bot, Github, KeyRound, Phone } from "lucide-react";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { SecretInput } from "@/components/settings/secret-input";

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  ADMIN: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  AGENT: "bg-green-500/10 text-green-400 border-green-500/30",
  VIEWER: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

export default function PlatformSettingsPage() {
  const { user } = useAuth();
  if (!user?.is_platform_admin) return <Redirect to="/settings/workspace" />;

  return <PlatformContent />;
}

// ── Platform AI & GitHub Config ──────────────────────────────────────────────
function PlatformAiConfigSection() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const AI_MODELS = [
    "mimo/mimo-v2.5-pro",
    "mimo/mimo-v2.5",
    "deepseek/deepseek-chat",
    "deepseek/deepseek-r1",
    "mistral/mistral-large-latest",
    "anthropic/claude-3-5-sonnet",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
  ];

  const [mimoKey, setMimoKey] = useState("");
  const [adminPhones, setAdminPhones] = useState("");
  const [adminModel, setAdminModel] = useState("mimo/mimo-v2.5-pro");
  const [githubToken, setGithubToken] = useState("");
  const [githubOwner, setGithubOwner] = useState("");
  const [githubRepo, setGithubRepo] = useState("");

  // Masks used when the server returns "••••••" (field is set but hidden)
  const MASKED = "••••••";
  const isMasked = (v: string) => v === MASKED || v?.startsWith("••");

  const { data: cfg, isLoading } = useQuery({
    queryKey: ["/api/platform/ai-config"],
    queryFn: () => api.platformGetAiConfig(),
  });

  useEffect(() => {
    if (!cfg) return;
    // Server returns _set flags (bool) for secrets, never the raw values
    setMimoKey(cfg.mimo_api_key_set ? MASKED : "");
    setAdminPhones(cfg.admin_phones ?? "");
    setAdminModel(cfg.admin_ai_model ?? "mimo/mimo-v2.5-pro");
    setGithubToken(cfg.github_token_set ? MASKED : "");
    setGithubOwner(cfg.github_repo_owner ?? "");
    setGithubRepo(cfg.github_repo_name ?? "");
  }, [cfg]);

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = {
        admin_phones: adminPhones || undefined,
        admin_ai_model: adminModel || undefined,
        github_repo_owner: githubOwner || undefined,
        github_repo_name: githubRepo || undefined,
      };
      // Only send secrets if the user actually changed them (not the mask)
      if (mimoKey && !isMasked(mimoKey)) payload.mimo_api_key = mimoKey;
      if (githubToken && !isMasked(githubToken)) payload.github_token = githubToken;
      return api.platformUpdateAiConfig(payload);
    },
    onSuccess: () => {
      toast({ title: "Configuración de IA guardada" });
      qc.invalidateQueries({ queryKey: ["/api/platform/ai-config"] });
    },
    onError: (e: any) =>
      toast({ title: "Error al guardar", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="rounded-xl border border-border bg-[hsl(var(--elevated))] p-4 space-y-4">
      {/* MiMo API Key */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="text-xs">MiMo API Key</Label>
          {cfg?.mimo_api_key_set && (
            <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400 bg-green-500/10 ml-1">Configurada</Badge>
          )}
        </div>
        <SecretInput
          value={mimoKey}
          onChange={setMimoKey}
          placeholder="Ingresá tu MiMo API Key…"
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Usada para el admin de plataforma y modelos MiMo. Base URL: <code className="text-xs">token-plan-cn.xiaomimimo.com/v1</code>
        </p>
      </div>

      {/* Admin AI Model */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <Bot className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="text-xs">Modelo IA del Administrador</Label>
        </div>
        <Select value={adminModel} onValueChange={setAdminModel}>
          <SelectTrigger className="bg-[hsl(var(--elevated))] border-border text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {AI_MODELS.map((m) => (
              <SelectItem key={m} value={m} className="text-xs font-mono">{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground mt-1">
          Modelo que responde cuando el admin de plataforma escribe en cualquier WhatsApp/Telegram del sistema.
        </p>
      </div>

      {/* Admin Phones */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="text-xs">Teléfonos del Administrador</Label>
        </div>
        <Input
          value={adminPhones}
          onChange={(e) => setAdminPhones(e.target.value)}
          placeholder="+50688888888, +50677777777"
          className="bg-[hsl(var(--elevated))] border-border text-sm"
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Números separados por coma. Cualquier mensaje desde estos teléfonos activa el modo admin (sin restricciones de negocio).
        </p>
      </div>

      <div className="h-px bg-border" />

      {/* GitHub Token */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <Github className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="text-xs">GitHub Personal Access Token</Label>
          {cfg?.github_token_set && (
            <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400 bg-green-500/10 ml-1">Configurado</Badge>
          )}
        </div>
        <SecretInput
          value={githubToken}
          onChange={setGithubToken}
          placeholder="ghp_xxxxxxxxxxxxxxxx"
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          PAT con permisos <code className="text-xs">repo</code>. Se usa para crear PRs automáticos al aprobar un fix de soporte.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">GitHub Owner</Label>
          <Input
            value={githubOwner}
            onChange={(e) => setGithubOwner(e.target.value)}
            placeholder="lento47"
            className="mt-1 bg-[hsl(var(--elevated))] border-border text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">GitHub Repo</Label>
          <Input
            value={githubRepo}
            onChange={(e) => setGithubRepo(e.target.value)}
            placeholder="pymes-saas"
            className="mt-1 bg-[hsl(var(--elevated))] border-border text-sm"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <p className="text-[11px] text-muted-foreground">
          Los secretos se cifran con AES-256-GCM antes de guardarse en la base de datos.
        </p>
        <Button
          size="sm"
          onClick={() => save.mutate()}
          disabled={save.isPending || isLoading}
          className="bg-primary hover:bg-primary/90 min-w-[110px]"
        >
          {save.isPending ? "Guardando…" : "Guardar config"}
        </Button>
      </div>
    </div>
  );
}

function PlatformContent() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignRole, setAssignRole] = useState("AGENT");
  const [searchEmail, setSearchEmail] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [billingPlan, setBillingPlan] = useState("FREE");
  const [billingStatus, setBillingStatus] = useState("MANUAL");
  const [billingProvider, setBillingProvider] = useState("MANUAL");
  const [billingInterval, setBillingInterval] = useState("MONTHLY");
  const [providerCustomerId, setProviderCustomerId] = useState("");
  const [providerSubscriptionId, setProviderSubscriptionId] = useState("");
  const [billingNotes, setBillingNotes] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);

  const { data: workspaces, isLoading: wsLoading } = useQuery({
    queryKey: ["/api/platform/workspaces"],
    queryFn: () => api.platformListWorkspaces(),
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["/api/platform/workspaces", selectedSlug, "members"],
    queryFn: () => api.platformListMembers(selectedSlug!),
    enabled: !!selectedSlug,
  });

  const { data: billingData, isLoading: billingLoading } = useQuery({
    queryKey: ["/api/platform/workspaces", selectedSlug, "billing"],
    queryFn: () => api.platformGetWorkspaceBilling(selectedSlug!),
    enabled: !!selectedSlug,
  });

  const { data: users } = useQuery({
    queryKey: ["/api/platform/users", searchQuery],
    queryFn: () => api.platformSearchUsers(searchQuery || undefined),
    enabled: searchQuery.length >= 2 || searchQuery === "",
  });

  const assign = useMutation({
    mutationFn: () => api.platformAssignMember(selectedSlug!, { email: assignEmail, role: assignRole }),
    onSuccess: () => {
      toast({ title: "Usuario asignado al workspace" });
      qc.invalidateQueries({ queryKey: ["/api/platform/workspaces", selectedSlug, "members"] });
      setAssignOpen(false);
      setAssignEmail("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const revoke = useMutation({
    mutationFn: ({ userId }: { userId: string }) => api.platformRemoveMember(selectedSlug!, userId),
    onSuccess: () => {
      toast({ title: "Acceso revocado" });
      qc.invalidateQueries({ queryKey: ["/api/platform/workspaces", selectedSlug, "members"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateBilling = useMutation({
    mutationFn: () =>
      api.platformUpdateWorkspaceBilling(selectedSlug!, {
        plan: billingPlan,
        status: billingStatus,
        provider: billingProvider,
        billing_interval: billingInterval,
        provider_customer_id: providerCustomerId || undefined,
        provider_subscription_id: providerSubscriptionId || undefined,
        current_period_start: periodStart || undefined,
        current_period_end: periodEnd || undefined,
        cancel_at_period_end: cancelAtPeriodEnd,
        notes: billingNotes || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Billing actualizado" });
      qc.invalidateQueries({ queryKey: ["/api/platform/workspaces"] });
      qc.invalidateQueries({ queryKey: ["/api/platform/workspaces", selectedSlug, "billing"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    const subscription = billingData?.subscription;
    const workspace = billingData?.workspace;

    setBillingPlan(subscription?.plan ?? workspace?.plan ?? "FREE");
    setBillingStatus(subscription?.status ?? "MANUAL");
    setBillingProvider(subscription?.provider ?? "MANUAL");
    setBillingInterval(subscription?.billing_interval ?? "MONTHLY");
    setProviderCustomerId(subscription?.provider_customer_id ?? "");
    setProviderSubscriptionId(subscription?.provider_subscription_id ?? "");
    setBillingNotes(subscription?.notes ?? "");
    setPeriodStart(subscription?.current_period_start ? String(subscription.current_period_start).slice(0, 10) : "");
    setPeriodEnd(subscription?.current_period_end ? String(subscription.current_period_end).slice(0, 10) : "");
    setCancelAtPeriodEnd(subscription?.cancel_at_period_end === true);
  }, [billingData]);

  const wsList = Array.isArray(workspaces) ? workspaces : [];
  const membersList = Array.isArray(members) ? members : [];
  const usersList = Array.isArray(users) ? users : [];
  const billingEvents = Array.isArray(billingData?.events) ? billingData.events : [];

  return (
    <SettingsLayout>
      <div className="space-y-6">

        {/* ── IA de Plataforma ──────────────────────────────────────────── */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Bot className="h-4 w-4" />IA de Plataforma
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Configuración de la IA del administrador, teléfonos de acceso directo y GitHub para auto-PRs de soporte.
          </p>
          <PlatformAiConfigSection />
        </div>

        <div className="h-px bg-border" />

        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Search className="h-4 w-4" />Buscar usuarios
          </h3>
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Buscar por email..."
              value={searchEmail}
              onChange={e => setSearchEmail(e.target.value)}
              className="bg-[hsl(var(--elevated))] border-border"
            />
            <Button size="sm" onClick={() => setSearchQuery(searchEmail)}>Buscar</Button>
          </div>
          {usersList.length > 0 && (
            <div className="space-y-2">
              {usersList.map((u: any) => (
                <div key={u.id} className="p-3 rounded-lg border border-border bg-card flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                    {u.is_platform_admin && (
                      <Badge variant="outline" className="text-xs mt-1 text-purple-400 border-purple-500/30">Admin Plataforma</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {u.workspace_users?.map((wu: any) => (
                      <Badge key={wu.workspace?.id} variant="outline" className="text-xs text-muted-foreground">
                        {wu.workspace?.name} · {wu.role}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-px bg-border" />

        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4" />Gestión de accesos por workspace
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Seleccionar workspace</p>
              {wsLoading ? (
                <p className="text-sm text-muted-foreground">Cargando...</p>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {wsList.map((w: any) => (
                    <button
                      key={w.id}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${selectedSlug === w.slug ? "bg-elevated text-white" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}
                      onClick={() => setSelectedSlug(w.slug)}
                    >
                      <span className="font-medium">{w.name}</span>
                      <span className="ml-2 text-xs opacity-60">{w.member_count} miembros</span>
                      <span className="ml-2 text-[10px] rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-blue-300">
                        {w.plan}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              {selectedSlug ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-[hsl(var(--elevated))] p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Billing y desbloqueo</p>
                        <p className="text-xs text-muted-foreground">
                          Cuando el customer paga, aquí se actualiza la suscripción y el plan efectivo del workspace.
                        </p>
                      </div>
                      <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-300">
                        Plan actual: {billingData?.workspace?.plan ?? "—"}
                      </Badge>
                    </div>

                    {billingLoading ? (
                      <p className="text-sm text-muted-foreground">Cargando billing...</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Plan efectivo</Label>
                            <Select value={billingPlan} onValueChange={setBillingPlan}>
                              <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                {["FREE", "STARTER", "GROWTH", "ENTERPRISE"].map((value) => (
                                  <SelectItem key={value} value={value}>{value}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Estado suscripción</Label>
                            <Select value={billingStatus} onValueChange={setBillingStatus}>
                              <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                {["TRIALING", "ACTIVE", "PAST_DUE", "UNPAID", "CANCELLED", "EXPIRED", "MANUAL"].map((value) => (
                                  <SelectItem key={value} value={value}>{value}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Proveedor</Label>
                            <Select value={billingProvider} onValueChange={setBillingProvider}>
                              <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                {["MANUAL", "STRIPE", "PAYPAL", "BAC", "CUSTOM"].map((value) => (
                                  <SelectItem key={value} value={value}>{value}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Intervalo</Label>
                            <Select value={billingInterval} onValueChange={setBillingInterval}>
                              <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                {["MONTHLY", "YEARLY", "ONE_TIME", "CUSTOM"].map((value) => (
                                  <SelectItem key={value} value={value}>{value}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Provider Customer ID</Label>
                            <Input value={providerCustomerId} onChange={(e) => setProviderCustomerId(e.target.value)} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                          </div>
                          <div>
                            <Label>Provider Subscription ID</Label>
                            <Input value={providerSubscriptionId} onChange={(e) => setProviderSubscriptionId(e.target.value)} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Periodo inicio</Label>
                            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                          </div>
                          <div>
                            <Label>Periodo fin</Label>
                            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                          </div>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                          <div>
                            <p className="text-sm text-foreground">Cancelar al final del periodo</p>
                            <p className="text-xs text-muted-foreground">Útil para bajas programadas sin cortar acceso hoy.</p>
                          </div>
                          <Switch checked={cancelAtPeriodEnd} onCheckedChange={setCancelAtPeriodEnd} />
                        </div>

                        <div>
                          <Label>Notas internas</Label>
                          <Input value={billingNotes} onChange={(e) => setBillingNotes(e.target.value)} className="mt-1 bg-[hsl(var(--elevated))] border-border" placeholder="Ej: pago manual confirmado por transferencia" />
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-muted-foreground">
                            Guardar aquí sincroniza la suscripción y actualiza el `workspace.plan`, que es lo que desbloquea el producto hoy.
                          </p>
                          <Button size="sm" onClick={() => updateBilling.mutate()} disabled={updateBilling.isPending}>
                            {updateBilling.isPending ? "Guardando..." : "Guardar billing"}
                          </Button>
                        </div>

                        {billingEvents.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Eventos recientes</p>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {billingEvents.map((event: any) => (
                                <div key={event.id} className="rounded border border-border bg-card px-3 py-2">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs font-medium text-foreground">{event.event_type}</p>
                                    <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                                      {event.applied_plan ?? "sin plan"}
                                    </Badge>
                                  </div>
                                  <p className="mt-1 text-[11px] text-muted-foreground">
                                    {event.provider} · {event.source} · {event.created_at ? new Date(event.created_at).toLocaleString() : "sin fecha"}
                                  </p>
                                  {event.notes && (
                                    <p className="mt-1 text-[11px] text-muted-foreground">{event.notes}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">{membersList.length} miembro(s)</p>
                    <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="h-7 text-xs">
                          <UserPlus className="h-3 w-3 mr-1" />Asignar usuario
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-card border-border">
                        <DialogHeader><DialogTitle>Asignar usuario al workspace</DialogTitle></DialogHeader>
                        <div className="space-y-3 pt-2">
                          <div>
                            <Label>Email del usuario</Label>
                            <Input
                              value={assignEmail}
                              onChange={e => setAssignEmail(e.target.value)}
                              placeholder="usuario@empresa.com"
                              className="mt-1 bg-[hsl(var(--elevated))] border-border"
                            />
                            <p className="text-xs text-muted-foreground mt-1">El usuario debe estar registrado en la plataforma.</p>
                          </div>
                          <div>
                            <Label>Rol</Label>
                            <Select value={assignRole} onValueChange={setAssignRole}>
                              <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                {["ADMIN", "AGENT", "VIEWER"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            onClick={() => assign.mutate()}
                            disabled={!assignEmail || assign.isPending}
                            className="w-full bg-primary hover:bg-primary/90"
                          >
                            {assign.isPending ? "Asignando..." : "Asignar"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {membersLoading ? (
                    <p className="text-sm text-muted-foreground">Cargando...</p>
                  ) : (
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {membersList.map((m: any) => (
                        <div key={m.id} className="flex items-center justify-between px-2 py-1.5 rounded border border-border bg-card">
                          <div>
                            <p className="text-xs font-medium">{m.user?.name}</p>
                            <p className="text-xs text-muted-foreground">{m.user?.email}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className={`text-xs ${ROLE_COLORS[m.role] ?? ""}`}>{m.role}</Badge>
                            {!m.is_owner && (
                              <button
                                className="text-muted-foreground hover:text-destructive ml-1"
                                onClick={() => revoke.mutate({ userId: m.user?.id })}
                                title="Revocar acceso"
                              >
                                <UserMinus className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {membersList.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">Sin miembros</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground pt-6 text-center">Seleccioná un workspace</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}
