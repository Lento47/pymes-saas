import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { SamlConfig } from "@/components/settings/saml-config";
import { WorkspaceTab } from "@/components/settings/workspace-tab";
import { MembersTab } from "@/components/settings/members-tab";
import { ChannelsTab } from "@/components/settings/channels-tab";
import { DepartmentsTab } from "@/components/settings/departments-tab";
import { IntegrationsTab } from "@/components/settings/integrations-tab";
import { AiTab } from "@/components/settings/ai-tab";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, PlugZap, UserPlus, Plus, Plug,
  Eye, ExternalLink, PowerOff, Trash2, UserMinus, ShieldCheck, Search, Layers,
} from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  ADMIN: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  AGENT: "bg-green-500/10 text-green-400 border-green-500/30",
  VIEWER: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

function PlatformTab() {
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

  const { data: searchResults, refetch: searchUsers } = useQuery({
    queryKey: ["platform-search-users", searchQuery],
    queryFn: () => api.platformSearchUsers(searchQuery || undefined),
    enabled: false,
  });

  const { data: workspaces, refetch: refetchWorkspaces } = useQuery({
    queryKey: ["platform-workspaces", selectedSlug],
    queryFn: () => api.platformListWorkspaces(),
  });

  const { data: billing, refetch: refetchBilling } = useQuery({
    queryKey: ["platform-workspace-billing", selectedSlug],
    queryFn: () => api.platformGetWorkspaceBilling(selectedSlug!),
    enabled: !!selectedSlug,
  });

  const { data: members, refetch: refetchMembers } = useQuery({
    queryKey: ["platform-workspace-members", selectedSlug],
    queryFn: () => api.platformListMembers(selectedSlug!),
    enabled: !!selectedSlug,
  });

  const userSearchResults: any[] = searchResults?.data ?? searchResults ?? [];

  useEffect(() => {
    if (selectedSlug) {
      refetchMembers();
    }
  }, [selectedSlug]);

  useEffect(() => {
    if (selectedSlug) {
      refetchBilling();
      const sub = billing?.subscription;
      if (sub) {
        setBillingPlan(sub.plan ?? "FREE");
        setBillingStatus(sub.status ?? "MANUAL");
        setBillingProvider(sub.provider ?? "MANUAL");
        setBillingInterval(sub.billing_interval ?? "MONTHLY");
        setProviderCustomerId(sub.provider_customer_id ?? "");
        setProviderSubscriptionId(sub.provider_subscription_id ?? "");
        setBillingNotes(sub.notes ?? "");
        setPeriodStart(sub.current_period_start ? new Date(sub.current_period_start).toISOString().slice(0, 10) : "");
        setPeriodEnd(sub.current_period_end ? new Date(sub.current_period_end).toISOString().slice(0, 10) : "");
        setCancelAtPeriodEnd(sub.cancel_at_period_end ?? false);
      }
    }
  }, [selectedSlug, billing?.subscription]);

  const revokeAccess = useMutation({
    mutationFn: ({ slug, userId }: { slug: string; userId: string }) => api.platformRemoveMember(slug, userId),
    onSuccess: () => { refetchMembers(); toast({ title: "Acceso revocado" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const assignUser = useMutation({
    mutationFn: () => api.platformAssignMember(selectedSlug!, { email: assignEmail, role: assignRole }),
    onSuccess: () => { setAssignOpen(false); setAssignEmail(""); refetchMembers(); toast({ title: "Usuario asignado" }); },
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
    onSuccess: () => { toast({ title: "Facturación actualizada" }); refetchBilling(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const wsList: any[] = Array.isArray(workspaces) ? workspaces : workspaces?.data ?? [];
  const memberList: any[] = Array.isArray(members) ? members : members?.data ?? [];

  return (
    <div className="space-y-6">
      <section>
        <Label className="text-sm font-medium text-foreground">Buscar usuario por email</Label>
        <div className="flex gap-2 mt-2">
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="usuario@email.com" className="bg-[hsl(var(--elevated))] border-border" />
          <Button size="sm" onClick={() => searchUsers()}><Search className="h-4 w-4 mr-1" />Buscar</Button>
        </div>
        {userSearchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {userSearchResults.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                <div>
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(u.workspaces ?? []).map((w: any) => (
                    <Badge key={w.slug} variant="outline" className={ROLE_COLORS[w.role] ?? ""}>{w.slug}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <Label className="text-sm font-medium text-foreground mb-2 block">Seleccionar workspace</Label>
        <div className="space-y-2">
          {wsList.map((w: any) => (
            <button
              key={w.slug}
              onClick={() => setSelectedSlug(w.slug)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedSlug === w.slug ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:bg-card/60"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{w.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{w._count?.members ?? 0} miembros</span>
                  <Badge variant="outline">{w.plan}</Badge>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {selectedSlug && (
        <>
          <section>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium text-foreground">Miembros — {selectedSlug}</Label>
              <Button size="sm" onClick={() => setAssignOpen(true)}><UserPlus className="h-4 w-4 mr-1" />Asignar usuario</Button>
            </div>
            <div className="space-y-2">
              {memberList.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                  <div>
                    <p className="text-sm font-medium">{m.user?.name}</p>
                    <p className="text-xs text-muted-foreground">{m.user?.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={ROLE_COLORS[m.role] ?? ""}>{m.role}</Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => revokeAccess.mutate({ slug: selectedSlug, userId: m.user_id })}>
                      <UserMinus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle>Asignar usuario a {selectedSlug}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Email</Label>
                    <Input value={assignEmail} onChange={e => setAssignEmail(e.target.value)} placeholder="usuario@email.com" className="mt-1 bg-[hsl(var(--elevated))] border-border" />
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
                  <Button onClick={() => assignUser.mutate()} disabled={!assignEmail || assignUser.isPending} className="w-full">
                    {assignUser.isPending ? "Asignando..." : "Asignar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </section>

          <section>
            <Label className="text-sm font-medium text-foreground mb-3 block">Facturación — {selectedSlug}</Label>
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Plan</Label>
                  <Select value={billingPlan} onValueChange={setBillingPlan}>
                    <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {["FREE", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Estado</Label>
                  <Select value={billingStatus} onValueChange={setBillingStatus}>
                    <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {["TRIAL", "ACTIVE", "PAST_DUE", "UNPAID", "CANCELLED"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Proveedor</Label>
                  <Select value={billingProvider} onValueChange={setBillingProvider}>
                    <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {["MANUAL", "STRIPE", "PAYPAL", "BAC", "CUSTOM"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Intervalo</Label>
                  <Select value={billingInterval} onValueChange={setBillingInterval}>
                    <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {["MONTHLY", "YEARLY"].map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Provider Customer ID</Label>
                  <Input value={providerCustomerId} onChange={e => setProviderCustomerId(e.target.value)} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                </div>
                <div>
                  <Label className="text-xs">Provider Subscription ID</Label>
                  <Input value={providerSubscriptionId} onChange={e => setProviderSubscriptionId(e.target.value)} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                </div>
                <div>
                  <Label className="text-xs">Period Start</Label>
                  <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                </div>
                <div>
                  <Label className="text-xs">Period End</Label>
                  <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Notas</Label>
                  <Input value={billingNotes} onChange={e => setBillingNotes(e.target.value)} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={cancelAtPeriodEnd} onCheckedChange={setCancelAtPeriodEnd} />
                <span className="text-sm text-muted-foreground">Cancelar al final del período</span>
              </div>
              <Button onClick={() => updateBilling.mutate()} disabled={updateBilling.isPending} className="w-full">
                {updateBilling.isPending ? "Guardando..." : "Guardar facturación"}
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get("tab") || "workspace");
  const isPlatformAdmin = user?.is_platform_admin === true;

  useEffect(() => {
    const handler = () => setTab(new URLSearchParams(window.location.search).get("tab") || "workspace");
    window.addEventListener("popstate", handler);
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    (history as any).pushState = function () { origPush.apply(history, arguments as any); handler(); };
    (history as any).replaceState = function () { origReplace.apply(history, arguments as any); handler(); };
    return () => {
      window.removeEventListener("popstate", handler);
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }, []);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Configuración" />
      <Tabs value={tab} onValueChange={(v) => navigate(`/settings?tab=${v}`, { replace: true })}>
        <Card className="mt-4 bg-card border-border">
          <CardContent className="pt-6">
            <TabsContent value="workspace"><WorkspaceTab /></TabsContent>
            <TabsContent value="members"><MembersTab /></TabsContent>
            <TabsContent value="channels"><ChannelsTab /></TabsContent>
            <TabsContent value="departments"><DepartmentsTab /></TabsContent>
            <TabsContent value="integrations"><IntegrationsTab /></TabsContent>
            <TabsContent value="ai"><AiTab /></TabsContent>
            <TabsContent value="saml"><SamlConfig /></TabsContent>
            {isPlatformAdmin && (
              <TabsContent value="platform"><PlatformTab /></TabsContent>
            )}
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
