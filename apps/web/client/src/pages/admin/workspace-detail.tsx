import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Crown, Calendar, CreditCard, Trash2, AlertTriangle, Loader2, Save, ToggleLeft, ToggleRight } from "lucide-react";

export default function AdminWorkspaceDetail() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const slug = location.split("/").pop() ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["/api/platform/workspace", slug],
    queryFn: () => api.platformGetWorkspaceBySlug(slug),
    enabled: !!user?.is_platform_admin && !!slug,
    retry: false,
  });

  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const qc = useQueryClient();

  const featuresQ = useQuery({
    queryKey: ["/api/platform/workspaces", slug, "features"],
    queryFn: () => api.platformGetWorkspaceFeatures(slug),
    enabled: !!user?.is_platform_admin && !!slug,
  });

  const [editFeatures, setEditFeatures] = useState<any>(null);
  const [editLimits, setEditLimits] = useState<any>(null);
  const [editPlan, setEditPlan] = useState("");
  const [editBeta, setEditBeta] = useState("");
  const [editReason, setEditReason] = useState("");

  const featuresMut = useMutation({
    mutationFn: (data: any) => api.platformUpdateWorkspaceFeatures(slug, data),
    onSuccess: () => {
      toast({ title: "Configuración guardada" });
      featuresQ.refetch();
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const featureList = ["contacts","orders","reminders","conversations","whatsapp_inbox","billing","automations","dashboard","roles","reports","api_access","multi_location","audit_logs"];
  const limitList = ["contacts.max","users.max","channels.max","orders.monthly_max","invoices.monthly_max","automations.max","storage.gb"];

  const openFeatures = () => {
    if (!featuresQ.data) return;
    setEditFeatures({ ...featuresQ.data.features });
    setEditLimits({ ...featuresQ.data.limits });
    setEditPlan(featuresQ.data.plan);
    setEditBeta(featuresQ.data.beta_profile ?? "");
    setEditReason("");
  };

  const deleteMut = useMutation({
    mutationFn: () => api.platformDeleteWorkspace(slug),
    onSuccess: () => {
      toast({ title: "Workspace eliminado" });
      navigate("/admin/workspaces");
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  if (isLoading) return <PageLoader />;

  const ws = data ?? {};

  return (
    <div className="min-h-full" style={{ background: "hsl(var(--bg))" }}>
      <PageHeader
        title={ws.name ?? slug}
        description="Workspace details and configuration."
      >
        <Badge variant="outline" className="text-[10px]">{ws.plan}</Badge>
      </PageHeader>

      <div className="px-6 py-6 space-y-4">
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
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" /> Subscription
            </h3>
            <div className="grid gap-3 md:grid-cols-2 text-xs">
              <div><span className="text-muted-foreground">Provider:</span> <span className="text-foreground">{ws.subscription.provider}</span></div>
              <div><span className="text-muted-foreground">Plan:</span> <span className="text-foreground">{ws.subscription.plan}</span></div>
              <div><span className="text-muted-foreground">Status:</span> <span className="text-foreground">{ws.subscription.status}</span></div>
              <div><span className="text-muted-foreground">Interval:</span> <span className="text-foreground">{ws.subscription.billing_interval}</span></div>
            </div>
          </div>
        )}

        {ws.enterpriseConfig && (
          <div className="rounded-xl border border-border/60 bg-card/40 p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Enterprise Configuration</h3>
            <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap">
              {JSON.stringify(ws.enterpriseConfig, null, 2)}
            </pre>
          </div>
        )}

        {/* Workspace Features */}
        <div className="rounded-xl border border-border/60 bg-card/40 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ToggleLeft className="w-4 h-4 text-blue-400" /> Features
            </h3>
            <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={openFeatures}>
              <Save className="w-3 h-3 mr-1" /> Configurar
            </Button>
          </div>
          {featuresQ.data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1.5 text-xs">
              {featureList.map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${featuresQ.data.features[f] ? "bg-green-400" : "bg-zinc-600"}`} />
                  <span className={featuresQ.data.features[f] ? "text-foreground" : "text-muted-foreground"}>{f}</span>
                </div>
              ))}
            </div>
          )}
          {featuresQ.data && (
            <div className="mt-2 text-[10px] text-muted-foreground">
              Plan: {featuresQ.data.plan}{featuresQ.data.beta_profile ? ` · Beta: ${featuresQ.data.beta_profile}` : ""}
            </div>
          )}
        </div>

        {/* Feature editor modal */}
        {editFeatures && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditFeatures(null)}>
            <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-semibold">Configurar Features</h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px]">Plan</Label>
                  <select className="w-full h-8 text-xs bg-background border border-border rounded-md px-2" value={editPlan} onChange={(e) => setEditPlan(e.target.value)}>
                    {["FREE","STARTER","GROWTH","BUSINESS","ENTERPRISE","BUSINESS_PLUS","BETA_INFORMAL"].map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-[10px]">Beta Profile</Label>
                  <select className="w-full h-8 text-xs bg-background border border-border rounded-md px-2" value={editBeta} onChange={(e) => setEditBeta(e.target.value)}>
                    <option value="">(ninguno)</option>
                    {["BETA_LIGHT","BETA_CONVERSATIONS","BETA_OPERATIONS"].map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {featureList.map((f) => (
                  <label key={f} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={!!editFeatures[f]} onChange={(e) => setEditFeatures({...editFeatures, [f]: e.target.checked})} />
                    {f}
                  </label>
                ))}
              </div>

              <div className="border-t border-border pt-3">
                <h4 className="text-[10px] font-medium text-muted-foreground mb-2">Límites</h4>
                <div className="grid grid-cols-2 gap-2">
                  {limitList.map((l) => (
                    <div key={l}>
                      <Label className="text-[9px]">{l}</Label>
                      <Input type="number" className="h-7 text-xs" value={(editLimits as any)[l] ?? 0} onChange={(e) => setEditLimits({...editLimits, [l]: Number(e.target.value)})} />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-[10px]">Motivo (audit log)</Label>
                <Input className="h-8 text-xs" value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="Ej: Beta informal: repostería casera" />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setEditFeatures(null)}>Cancelar</Button>
                <Button size="sm" className="h-8 text-xs" onClick={() => {
                  featuresMut.mutate({
                    plan: editPlan,
                    beta_profile: editBeta || null,
                    features: editFeatures,
                    limits: editLimits,
                    reason: editReason || undefined,
                  });
                  setEditFeatures(null);
                }} disabled={featuresMut.isPending}>
                  {featuresMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Guardar"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete workspace */}
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                Zona de peligro
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Eliminar este workspace es irreversible. Todos los datos asociados se marcarán como eliminados.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Eliminar
            </Button>
          </div>

          {showDelete && (
            <div className="mt-4 pt-4 border-t border-red-500/10 space-y-3">
              <p className="text-xs text-muted-foreground">
                Escribí <span className="font-semibold text-red-400">confirmar</span> para eliminar este workspace.
              </p>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-[11px]">Confirmación</Label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="confirmar"
                    className="h-9 text-xs bg-background border-border"
                    autoFocus
                  />
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-9 text-xs"
                  disabled={confirmText !== "confirmar" || deleteMut.isPending}
                  onClick={() => deleteMut.mutate()}
                >
                  {deleteMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Confirmar eliminación
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => { setShowDelete(false); setConfirmText(""); }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
