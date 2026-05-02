import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Crown, Calendar, CreditCard, Trash2, AlertTriangle, Loader2 } from "lucide-react";

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
