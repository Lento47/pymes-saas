import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2 } from "lucide-react";

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
  const [hasChanges, setHasChanges] = useState(false);

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
      setHasChanges(false);
      qc.invalidateQueries({ queryKey: ["/api/platform/plan-limits"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  if (isLoading) return <PageLoader />;

  const limits: Record<string, Record<string, number>> = data ?? {};

  const getVal = (plan: string, res: string): string => {
    if (edits[plan]?.[res] !== undefined) return edits[plan][res];
    const v = limits[plan]?.[res];
    return v !== undefined ? String(v) : "";
  };

  const setVal = (plan: string, res: string, val: string) => {
    setEdits((prev) => ({
      ...prev,
      [plan]: { ...(prev[plan] ?? {}), [res]: val },
    }));
    setHasChanges(true);
  };

  const collectOverrides = () => {
    const overrides: { plan: string; resource: string; value: number }[] = [];
    for (const plan of PLANS) {
      for (const res of RESOURCES) {
        const v = edits[plan]?.[res];
        if (v !== undefined) {
          const num = Number(v);
          if (!isNaN(num) && num !== limits[plan]?.[res]) {
            overrides.push({ plan, resource: res, value: num });
          }
        }
      }
    }
    return overrides;
  };

  return (
    <div className="min-h-full" style={{ background: "hsl(var(--bg))" }}>
      <PageHeader title="Límites de Planes" description="Editá los límites de recursos por plan. Los cambios se aplican a todos los workspaces en ese plan.">
        {hasChanges && (
          <Button size="sm" className="h-8 text-xs" onClick={() => saveMut.mutate(collectOverrides())} disabled={saveMut.isPending}>
            {saveMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            Guardar cambios
          </Button>
        )}
      </PageHeader>

      <div className="px-6 py-6 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/60">
              <th className="text-left py-2 px-3 text-muted-foreground font-medium sticky left-0 bg-card">Recurso</th>
              {PLANS.map((p) => (
                <th key={p} className="text-right py-2 px-3 text-muted-foreground font-medium">{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RESOURCES.map((res) => (
              <tr key={res} className="border-b border-border/30 hover:bg-sidebar-accent/20">
                <td className="py-1.5 px-3 text-foreground sticky left-0 bg-card whitespace-nowrap">{RESOURCE_LABELS[res] ?? res}</td>
                {PLANS.map((plan) => {
                  const val = getVal(plan, res);
                  const orig = limits[plan]?.[res];
                  const isCustom = String(orig) === "custom";
                  const changed = edits[plan]?.[res] !== undefined;
                  return (
                    <td key={plan} className="py-1.5 px-3">
                      {isCustom && !changed ? (
                        <span className="text-muted-foreground italic">custom</span>
                      ) : (
                        <Input
                          type="number"
                          className={`h-7 text-xs text-right ${changed ? "border-amber-400" : ""}`}
                          value={val}
                          onChange={(e) => setVal(plan, res, e.target.value)}
                        />
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
