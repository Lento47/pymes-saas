import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { ArrowLeft, Package, Clock, ArrowUpRight, ArrowDownRight, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StockBar } from "@/components/inventory/StockBar";
import { cn } from "@/lib/utils";

const ICONS: Record<string, any> = { IN: ArrowUpRight, OUT: ArrowDownRight, ADJUSTMENT: Pencil, REVERSAL: RotateCcw };
const COLORS: Record<string, string> = { IN: "text-emerald-400", OUT: "text-red-400", ADJUSTMENT: "text-amber-400", REVERSAL: "text-blue-400" };
const LABELS: Record<string, string> = { IN: "Entrada", OUT: "Salida", ADJUSTMENT: "Ajuste", REVERSAL: "Reversión" };

export default function InventoryDetailPage() {
  useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const productId = id || "";

  const { data: product, isLoading } = useQuery({
    queryKey: ["inventory-product", productId],
    queryFn: () => api.getProduct(productId),
    enabled: !!productId,
  });

  const { data: movesData } = useQuery({
    queryKey: ["inventory-movements-product", productId],
    queryFn: () => api.getStockMovements(`product_id=${productId}&limit=50`),
    enabled: !!productId,
  });

  const movements: Record<string, any>[] = movesData?.data ?? [];

  if (isLoading) {
    return (
      <div className="min-h-full bg-background flex items-center justify-center">
        <span className="text-muted-foreground text-sm">Cargando...</span>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-full bg-background flex flex-col items-center justify-center gap-3">
        <Package className="h-10 w-10 text-muted-foreground/65" />
        <span className="text-sm text-muted-foreground">Producto no encontrado</span>
        <Link href="/inventory"><Button variant="outline" size="sm">Volver al inventario</Button></Link>
      </div>
    );
  }

  const catColor = product.category?.color || "hsl(var(--primary))";
  const margin = product.cost_price ? parseFloat(product.unit_price) - parseFloat(product.cost_price) : null;
  const marginPct = margin && product.cost_price && parseFloat(product.cost_price) > 0
    ? Math.round((margin / parseFloat(product.cost_price)) * 100)
    : null;

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <Link href="/inventory">
            <Button variant="ghost" size="sm" className="text-xs"><ArrowLeft className="h-3.5 w-3.5 mr-1" />Volver</Button>
          </Link>
        </div>

        {/* Header */}
        <div className="rounded-xl border border-border bg-card/60 overflow-hidden mb-6">
          <div className="h-[3px] w-full" style={{ backgroundColor: catColor }} />
          <div className="p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="text-lg font-bold text-foreground">{product.name}</h1>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{product.sku}</p>
              </div>
              <span className={cn(
                "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border",
                product.type === "SERVICE" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                product.is_active ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                "bg-muted text-muted-foreground border-border"
              )}>
                {product.type === "SERVICE" ? "Servicio" : product.is_active ? "Activo" : "Archivado"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Precio venta</p>
                <p className="text-lg font-bold text-foreground">₡{parseFloat(product.unit_price).toLocaleString("es-CR", { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Costo</p>
                <p className="text-lg font-bold text-foreground">
                  {product.cost_price ? `₡${parseFloat(product.cost_price).toLocaleString("es-CR", { minimumFractionDigits: 2 })}` : "—"}
                </p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Margen</p>
                <p className={cn("text-lg font-bold", marginPct && marginPct > 0 ? "text-emerald-400" : "text-muted-foreground")}>
                  {marginPct ? `${marginPct}%` : "—"}
                </p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Stock</p>
                {product.track_inventory && product.type === "PRODUCT" ? (
                  <div>
                    <p className={cn("text-lg font-bold",
                      product.current_stock <= 0 ? "text-red-400" :
                      product.current_stock <= product.min_stock ? "text-amber-400" : "text-emerald-400"
                    )}>
                      {product.current_stock}
                    </p>
                    <StockBar current={product.current_stock} min={product.min_stock} trackInventory={true} type="PRODUCT" className="mt-1" />
                  </div>
                ) : (
                  <p className="text-lg font-bold text-muted-foreground">—</p>
                )}
              </div>
            </div>

            {product.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">{product.description}</p>
            )}
          </div>
        </div>

        {/* Movements */}
        <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
          <div className="px-6 py-4 border-b border-border/60">
            <h2 className="text-sm font-semibold text-foreground">Historial de movimientos</h2>
          </div>
          {movements.length === 0 ? (
            <div className="px-6 py-12 text-center text-xs text-muted-foreground">Sin movimientos todavía</div>
          ) : (
            <div className="divide-y divide-border/60">
              {movements.map((m) => {
                const Icon = ICONS[m.type] || Package;
                const color = COLORS[m.type] || "text-muted-foreground";
                return (
                  <div key={m.id} className="flex items-center gap-3 px-6 py-3 text-xs hover:bg-muted/20 transition-colors">
                    <span className={cn("shrink-0", color)}><Icon className="w-3.5 h-3.5" /></span>
                    <span className="text-muted-foreground font-medium w-16">{LABELS[m.type] || m.type}</span>
                    <span className="font-mono font-medium text-foreground w-12 text-right">{m.quantity}</span>
                    <span className="text-muted-foreground/60 font-mono">{m.previous_stock} → {m.new_stock}</span>
                    <span className="text-muted-foreground/80 flex-1 truncate">{m.reason || "—"}</span>
                    <span className="text-muted-foreground/75 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {new Date(m.created_at).toLocaleDateString("es-CR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
