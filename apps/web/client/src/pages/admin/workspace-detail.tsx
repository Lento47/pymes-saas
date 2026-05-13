import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/loading-spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Crown, Trash2, AlertTriangle, Loader2, Save, ToggleLeft, Shield, Info, Copy, ExternalLink } from "lucide-react";

const BETA_PROFILE_FEATURES: Record<string, Record<string, boolean>> = {
  BETA_LIGHT:       { contacts:true, orders:true, reminders:true, dashboard:true, conversations:false, whatsapp_inbox:false, billing:false, automations:false, roles:false, reports:false, api_access:false, multi_location:false, audit_logs:false },
  BETA_CONVERSATIONS:{ contacts:true, reminders:true, conversations:true, whatsapp_inbox:true, dashboard:true, orders:false, billing:false, automations:false, roles:false, reports:false, api_access:false, multi_location:false, audit_logs:false },
  BETA_OPERATIONS:  { contacts:true, orders:true, reminders:true, conversations:true, dashboard:true, roles:true, whatsapp_inbox:false, billing:false, automations:false, reports:false, api_access:false, multi_location:false, audit_logs:false },
};
const BETA_PROFILE_LIMITS: Record<string, Record<string, number>> = {
  BETA_LIGHT:       { "contacts.max":150, "users.max":1, "channels.max":0, "orders.monthly_max":100, "invoices.monthly_max":0, "automations.max":0, "storage.gb":1 },
  BETA_CONVERSATIONS:{ "contacts.max":300, "users.max":2, "channels.max":1, "orders.monthly_max":0,  "invoices.monthly_max":0, "automations.max":0, "storage.gb":2 },
  BETA_OPERATIONS:  { "contacts.max":500, "users.max":3, "channels.max":1, "orders.monthly_max":300, "invoices.monthly_max":0, "automations.max":0, "storage.gb":3 },
};

const featureList = ["contacts","orders","reminders","conversations","whatsapp_inbox","billing","automations","dashboard","roles","reports","api_access","multi_location","audit_logs"];
const limitList = ["contacts.max","users.max","channels.max","orders.monthly_max","invoices.monthly_max","automations.max","storage.gb"];

export default function AdminWorkspaceDetail() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const slug = location.split("/").pop() ?? "";
  const isAdminKeyword = ["workspaces", "users", "plan-limits"].includes(slug);
  const validSlug = !!slug && !isAdminKeyword;

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

  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [tab, setTab] = useState("info");
  const [edit, setEdit] = useState<any>(null);

  const featuresMut = useMutation({
    mutationFn: (d: any) => api.platformUpdateWorkspaceFeatures(slug, d),
    onSuccess: () => { toast({ title: "Configuración guardada" }); featuresQ.refetch(); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.platformDeleteWorkspace(slug),
    onSuccess: () => { toast({ title: "Workspace eliminado" }); navigate("/admin/workspaces"); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
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
          {featuresQ.data?.beta_profile && <Badge className="text-[10px] bg-purple-500/20 text-purple-400 border-purple-500/30">{featuresQ.data.beta_profile}</Badge>}
          <Badge variant="outline" className="text-[10px]">{featuresQ.data?.plan ?? ws.plan}</Badge>
        </div>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab} className="px-6 py-4">
        <TabsList className="bg-card border border-border mb-4">
          <TabsTrigger value="info" className="data-[state=active]:bg-elevated"><Info className="w-3.5 h-3.5 mr-1.5" />Info</TabsTrigger>
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
                  Plan: {featuresQ.data.plan}{featuresQ.data.beta_profile ? ` · Beta: ${featuresQ.data.beta_profile}` : ""}
                </div>
              </>
            ) : <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
        </TabsContent>

        {/* ── SSO / SAML ── */}
        <TabsContent value="sso" className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card/40 p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-violet-400" />SAML SSO</h3>
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
                      <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => { navigator.clipboard.writeText(samlQ.data.loginUrl); toast({ title: "Copiado" }); }}><Copy className="w-3 h-3" /></Button>
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

      {/* Feature editor modal */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEdit(null)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold">Configurar Features</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px]">Plan</Label>
                <select className="w-full h-8 text-xs bg-background border border-border rounded-md px-2" value={edit.plan} onChange={e => setEdit({...edit, plan: e.target.value})}>
                  {["FREE","STARTER","GROWTH","BUSINESS","ENTERPRISE","BUSINESS_PLUS","BETA_INFORMAL"].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-[10px]">Beta Profile</Label>
                <div className="flex gap-1">
                  <select className="flex-1 h-8 text-xs bg-background border border-border rounded-md px-2" value={edit.beta} onChange={e => applyBetaProfile(e.target.value)}>
                    <option value="">(ninguno)</option>
                    {Object.keys(BETA_PROFILE_FEATURES).map(p => <option key={p}>{p}</option>)}
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

            <div>
              <Label className="text-[10px]">Motivo (audit log)</Label>
              <Input className="h-8 text-xs" value={edit.reason} onChange={e => setEdit({...edit, reason: e.target.value})} placeholder="Ej: Beta informal: repostería casera" />
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
