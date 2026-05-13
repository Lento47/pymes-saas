import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, RotateCcw } from "lucide-react";

const PLANS = ["FREE", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE", "BUSINESS_PLUS"];
const RESOURCES = [
  "users", "automations", "contacts", "documents",
  "invoices_per_month", "storage_bytes", "locations",
  "invite_codes", "products", "product_categories",
  "diagnostics_per_day", "media_messages_per_day",
];
const RESOURCE_LABELS: Record<string, string> = {
  users: "Users", automations: "Automations", contacts: "Contacts",
  documents: "Documents", invoices_per_month: "Invoices/mes",
  storage_bytes: "Storage (bytes)", locations: "Locations",
  invite_codes: "Invite Codes", products: "Products",
  product_categories: "Categories", diagnostics_per_day: "Diagnostics/día",
  media_messages_per_day: "Media Messages/día",
};

export default function AdminPlanLimits() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["/api/platform/plan-limits"],
    queryFn: api.platformGetPlanLimits,
  });

  const saveMut = useMutation({
    mutationFn: (overrides: { plan: string; resource: string; value: number }[]) =>
      api.platformUpdatePlanLimits(overrides),
    onSuccess: () => {
      toast({ title: "Límites actualizados" });
      setEdits({});
      qc.invalidateQueries({ queryKey: ["/api/platform/plan-limits"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const limits: Record<string, Record<string, number>> = data ?? {};

  const changeCount = useMemo(() => {
    let n = 0;
    for (const plan of PLANS) {
      for (const res of RESOURCES) {
        const v = edits[plan]?.[res];
        if (v !== undefined) {
          const num = Number(v);
          if (!isNaN(num) && String(limits[plan]?.[res]) !== "custom" && num !== limits[plan]?.[res]) n++;
        }
      }
    }
    return n;
  }, [edits, limits]);

  const collectOverrides = () => {
    const overrides: { plan: string; resource: string; value: number }[] = [];
    for (const plan of PLANS) {
      for (const res of RESOURCES) {
        const v = edits[plan]?.[res];
        if (v !== undefined) {
          const num = Number(v);
          if (!isNaN(num) && String(limits[plan]?.[res]) !== "custom" && num !== limits[plan]?.[res]) {
            overrides.push({ plan, resource: res, value: num });
          }
        }
      }
    }
    return overrides;
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="min-h-full" style={{ background: "hsl(var(--bg))" }}>
      <PageHeader title="Límites de Planes" description="Editá los límites por plan. Cambios aplican a todos los workspaces en ese plan. Valores en ámbar = sobreescritos.">
        {changeCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-amber-400 font-medium">{changeCount} cambio{changeCount !== 1 ? "s" : ""}</span>
            <Button size="sm" className="h-8 text-xs" onClick={() => saveMut.mutate(collectOverrides())} disabled={saveMut.isPending}>
              {saveMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              Guardar
            </Button>
          </div>
        )}
      </PageHeader>

      <div className="px-6 py-6 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/60">
              <th className="text-left py-2 px-3 text-muted-foreground font-medium sticky left-0 bg-card z-10">Recurso</th>
              {PLANS.map(p => (
                <th key={p} className="text-right py-2 px-3 text-muted-foreground font-medium">{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RESOURCES.map(res => (
              <tr key={res} className="border-b border-border/30 hover:bg-sidebar-accent/20">
                <td className="py-1.5 px-3 text-foreground sticky left-0 bg-card whitespace-nowrap z-10">{RESOURCE_LABELS[res] ?? res}</td>
                {PLANS.map(plan => {
                  const currentVal = limits[plan]?.[res];
                  const isCustom = String(currentVal) === "custom";
                  const editedStr = edits[plan]?.[res];
                  const changed = editedStr !== undefined;
                  const defVal = isCustom ? "custom" : (currentVal ?? 0);

                  return (
                    <td key={plan} className="py-1.5 px-3">
                      {isCustom ? (
                        <span className="text-muted-foreground italic text-right block">custom</span>
                      ) : (
                        <div className="relative">
                          <Input
                            type="number"
                            className={`h-7 text-xs text-right ${changed ? "border-amber-400 bg-amber-500/5" : "border-transparent"}`}
                            value={changed ? editedStr : String(defVal)}
                            onChange={e => setEdits(prev => ({ ...prev, [plan]: { ...(prev[plan] ?? {}), [res]: e.target.value } }))}
                            placeholder={String(defVal)}
                          />
                          {changed && (
                            <button
                              className="absolute right-0 top-1/2 -translate-y-1/2 -translate-x-5 text-[9px] text-muted-foreground hover:text-amber-400"
                              onClick={() => {
                                setEdits(prev => {
                                  const copy = { ...prev };
                                  if (copy[plan]) {
                                    const row = { ...copy[plan] };
                                    delete row[res];
                                    if (Object.keys(row).length === 0) delete copy[plan];
                                    else copy[plan] = row;
                                  }
                                  return copy;
                                });
                              }}
                              title="Revertir al default"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
