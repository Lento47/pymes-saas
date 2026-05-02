import { MoreHorizontal, Pencil, Archive, Minus, Plus } from "lucide-react";
import { Link } from "wouter";
import { StockBar } from "./StockBar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: any;
  onEdit: (p: any) => void;
  onArchive: (id: string) => void;
  onAdjust: (p: any) => void;
  viewMode: "grid" | "table";
}

export function ProductCard({ product, onEdit, onArchive, onAdjust, viewMode }: ProductCardProps) {
  if (viewMode === "table") {
    const sc = !product.track_inventory || product.type === "SERVICE" ? "text-muted-foreground" :
      product.current_stock <= 0 ? "text-red-400" :
      product.current_stock <= product.min_stock ? "text-amber-400" :
      "text-emerald-400";
    return (
      <tr className="border-t border-border hover:bg-accent/30 transition-colors group">
        <td className="px-4 py-3">
          <Link href={`/inventory/${product.id}`}>
            <span className="text-sm font-medium text-foreground hover:text-primary cursor-pointer">{product.name}</span>
          </Link>
          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{product.sku}</div>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">{product.category?.name || "—"}</td>
        <td className="px-4 py-3 text-sm text-foreground font-medium text-right">
          ₡{parseFloat(product.unit_price).toLocaleString("es-CR", { minimumFractionDigits: 2 })}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 min-w-[100px]">
            <StockBar current={product.current_stock} min={product.min_stock} trackInventory={product.track_inventory} type={product.type} className="flex-1" />
            <span className={cn("text-[11px] tabular-nums font-medium", sc)}>
              {product.track_inventory && product.type === "PRODUCT" ? product.current_stock : "—"}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">
          {product.type === "SERVICE" ? <Badge variant="secondary" className="text-[10px]">Servicio</Badge> : null}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {product.track_inventory && product.type === "PRODUCT" && (
              <button onClick={(e) => { e.stopPropagation(); onAdjust(product); }} className="p-1.5 rounded-md hover:bg-accent transition-colors" title="Ajustar stock">
                <Minus className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onEdit(product); }} className="p-1.5 rounded-md hover:bg-accent transition-colors" title="Editar">
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onArchive(product.id); }} className="p-1.5 rounded-md hover:bg-accent transition-colors" title="Archivar">
              <Archive className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  const catColor = product.category?.color || "#5771ff";
  const isLowStock = product.track_inventory && product.type === "PRODUCT" && product.current_stock <= product.min_stock;
  const isOutOfStock = product.track_inventory && product.type === "PRODUCT" && product.current_stock <= 0;

  return (
    <div className={cn(
      "group relative rounded-xl border bg-card/60 overflow-hidden transition-all duration-200",
      "hover:scale-[1.02] hover:shadow-lg hover:border-primary/20 hover:bg-card",
      isOutOfStock && "border-red-500/20",
      isLowStock && !isOutOfStock && "border-amber-500/20",
    )}>
      {/* Category color bar */}
      <div className="h-[3px] w-full" style={{ backgroundColor: catColor }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <Link href={`/inventory/${product.id}`}>
            <h3 className="text-sm font-semibold text-foreground hover:text-primary cursor-pointer leading-tight truncate max-w-[140px]">
              {product.name}
            </h3>
          </Link>
          {product.type === "SERVICE" && (
            <Badge variant="secondary" className="text-[10px] shrink-0">Servicio</Badge>
          )}
        </div>

        {/* SKU */}
        <p className="text-[10px] text-muted-foreground font-mono mb-3">{product.sku}</p>

        {/* Price */}
        <p className="text-lg font-bold text-foreground mb-3">
          ₡{parseFloat(product.unit_price).toLocaleString("es-CR", { minimumFractionDigits: 2 })}
        </p>

        {/* Stock bar */}
        <div className="mb-1">
          <StockBar current={product.current_stock} min={product.min_stock} trackInventory={product.track_inventory} type={product.type} />
        </div>
        <div className="flex items-center justify-between">
          <span className={cn("text-[10px]",
            product.current_stock <= 0 ? "text-red-400" :
            product.current_stock <= product.min_stock ? "text-amber-400" :
            "text-muted-foreground/60"
          )}>
            {product.track_inventory && product.type === "PRODUCT"
              ? `Stock: ${product.current_stock} / min ${product.min_stock}`
              : product.type === "SERVICE" ? "Servicio" : "Sin control"}
          </span>
          {product.unit_of_measure && (
            <span className="text-[10px] text-muted-foreground/40">{product.unit_of_measure}</span>
          )}
        </div>
      </div>

      {/* Hover actions */}
      <div className="absolute top-3 right-3 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {product.track_inventory && product.type === "PRODUCT" && (
          <>
            <button onClick={(e) => { e.stopPropagation(); onAdjust(product); }} className="p-1.5 rounded-lg bg-card border border-border hover:bg-accent transition-colors" title="Entrada rápida">
              <Plus className="h-3.5 w-3.5 text-emerald-400" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onAdjust(product); }} className="p-1.5 rounded-lg bg-card border border-border hover:bg-accent transition-colors" title="Ajustar stock">
              <Minus className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </>
        )}
        <button onClick={(e) => { e.stopPropagation(); onEdit(product); }} className="p-1.5 rounded-lg bg-card border border-border hover:bg-accent transition-colors" title="Editar">
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onArchive(product.id); }} className="p-1.5 rounded-lg bg-card border border-border hover:bg-accent transition-colors" title="Archivar">
          <Archive className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
