import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/hooks/use-auth";
import { ArrowLeft, Package, ArrowUpRight, ArrowDownRight, Pencil, RotateCcw, Clock } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const ICONS: Record<string, any> = { IN: ArrowUpRight, OUT: ArrowDownRight, ADJUSTMENT: Pencil, REVERSAL: RotateCcw };
const COLORS: Record<string, string> = { IN: "text-emerald-400", OUT: "text-red-400", ADJUSTMENT: "text-amber-400", REVERSAL: "text-blue-400" };
const LABELS: Record<string, string> = { IN: "Entrada", OUT: "Salida", ADJUSTMENT: "Ajuste", REVERSAL: "Reversión" };

export default function InventoryMovementsPage() {
  useRequireAuth();

  const { data: movesData, isLoading } = useQuery({
    queryKey: ["inventory-movements"],
    queryFn: () => api.getStockMovements("limit=100"),
    refetchInterval: 30000,
  });

  const movements: Record<string, any>[] = movesData?.data ?? [];

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/inventory"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Inventario</Button></Link>
          <h1 className="text-xl font-semibold text-foreground">Movimientos de Stock</h1>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground py-4">Cargando...</div>
        ) : movements.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-10 w-10 text-muted-foreground/65 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Sin movimientos todavía</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[hsl(var(--elevated))]">
                <tr>
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Producto</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Tipo</th>
                  <th className="text-center px-4 py-2 text-muted-foreground font-medium">Cant.</th>
                  <th className="text-center px-4 py-2 text-muted-foreground font-medium hidden sm:table-cell">Antes</th>
                  <th className="text-center px-4 py-2 text-muted-foreground font-medium hidden sm:table-cell">Después</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium hidden md:table-cell">Motivo</th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => {
                  const Icon = ICONS[m.type] || Package;
                  const color = COLORS[m.type] || "text-muted-foreground";
                  return (
                    <tr key={m.id} className="border-t border-border hover:bg-[hsl(var(--elevated))] transition-colors">
                      <td className="px-4 py-2.5 text-foreground text-xs">{m.product?.name || "—"}</td>
                      <td className="px-4 py-2.5"><span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}><Icon className="h-3 w-3" />{LABELS[m.type] || m.type}</span></td>
                      <td className="px-4 py-2.5 text-center text-foreground text-xs font-mono">{m.quantity}</td>
                      <td className="px-4 py-2.5 text-center text-muted-foreground text-xs font-mono hidden sm:table-cell">{m.previous_stock}</td>
                      <td className="px-4 py-2.5 text-center text-foreground text-xs font-mono font-medium hidden sm:table-cell">{m.new_stock}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs max-w-[150px] truncate hidden md:table-cell">{m.reason || "—"}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground text-xs flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(m.created_at).toLocaleDateString("es-CR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
