import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Search, Package, X, Loader2 } from "lucide-react";

interface ProductPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (product: { id: string; name: string; description: string; unit_price: number; current_stock: number }) => void;
}

export function ProductPicker({ open, onOpenChange, onSelect }: ProductPickerProps) {
  const [search, setSearch] = useState("");

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["product-picker"],
    queryFn: () => api.getProducts("limit=200"),
    enabled: open,
  });

  const \1: Record<string, any>[] = Array.isArray(productsData) ? productsData : productsData?.data ?? [];

  const filtered = search
    ? products.filter((p) =>
        p.is_active !== false &&
        (p.name?.toLowerCase().includes(search.toLowerCase()) ||
         p.sku?.toLowerCase().includes(search.toLowerCase()))
      )
    : products.filter((p) => p.is_active !== false);

  if (!open) return null;

  return (
    <div className="rounded-lg border border-border bg-background p-2 max-h-48 overflow-y-auto space-y-1">
      <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background pb-1 z-10">
        <Search className="w-3 h-3 text-muted-foreground shrink-0" />
        <input
          className="flex-1 text-[10px] bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50"
          placeholder="Buscar producto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
          <X className="w-3 h-3" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-3 justify-center">
          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Cargando...</span>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-[10px] text-muted-foreground text-center py-3">Sin productos activos.</p>
      ) : (
        filtered.slice(0, 30).map((p) => (
          <button
            key={p.id}
            className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-[11px] flex items-center justify-between transition-colors"
            onClick={() => {
              onSelect({
                id: p.id,
                name: p.name,
                description: p.name,
                unit_price: Number(p.unit_price ?? 0),
                current_stock: p.current_stock ?? 0,
              });
              onOpenChange(false);
            }}
          >
            <span className="flex items-center gap-2">
              <Package className="w-3 h-3 text-muted-foreground shrink-0" />
              <span>{p.name}</span>
            </span>
            <span className="text-muted-foreground text-[10px]">
              {new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(p.unit_price ?? 0)}
              {(p.current_stock ?? 0) > 0 && (
                <span className="ml-1.5">Stock: {p.current_stock}</span>
              )}
            </span>
          </button>
        ))
      )}
    </div>
  );
}
