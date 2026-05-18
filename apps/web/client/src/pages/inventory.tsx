import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Grid3X3, List, ArrowUpDown, Package, ChevronDown, Loader2, Minus, Upload } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductCard } from "@/components/inventory/ProductCard";
import { ProductDrawer } from "@/components/inventory/ProductDrawer";
import { CategoryChips } from "@/components/inventory/CategoryChips";
import { StockBar } from "@/components/inventory/StockBar";
import { cn } from "@/lib/utils";
import CsvImportModal from "@/components/import/csv-import-modal";

type SortKey = "name" | "price" | "stock" | "created";

type Product = {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  price?: string | number;
  stock_quantity?: number;
  current_stock?: number;
  category?: string | Record<string, unknown>;
  unit?: string;
};

export default function InventoryPage() {
  useRequireAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const limit = viewMode === "grid" ? 24 : 20;

  const { data: prodData, isLoading } = useQuery({
    queryKey: ["inventory-products", search, catFilter, lowStockOnly, sortBy, page, limit],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      if (catFilter !== "all") p.set("category_id", catFilter);
      if (lowStockOnly) p.set("low_stock", "true");
      p.set("limit", String(limit));
      p.set("page", String(page));
      return api.getProducts(p.toString());
    },
    refetchInterval: 30000,
  });

  const { data: categories } = useQuery({
    queryKey: ["inventory-categories"],
    queryFn: api.getCategories,
  });

  const products: Record<string, any>[] = prodData?.data ?? [];
  const catList: Record<string, any>[] = Array.isArray(categories) ? categories : [];
  const totalPages = prodData?.meta?.pages ?? 1;
  const total = prodData?.meta?.total ?? products.length;

  const createMut = useMutation({
    mutationFn: (d: Record<string, any>) => api.createProduct(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory-products"] }); setDrawerOpen(false); toast({ title: "Producto creado" }); },
    onError: (e) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: { id: string; [key: string]: unknown }) => api.updateProduct(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory-products"] }); setDrawerOpen(false); setEditingProduct(null); toast({ title: "Producto actualizado" }); },
    onError: (e) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => api.archiveProduct(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory-products"] }); toast({ title: "Producto archivado" }); },
    onError: (e) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const adjustMut = useMutation({
    mutationFn: ({ id, ...d }: { id: string; [key: string]: unknown }) => api.adjustStock(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory-products"] }); setAdjusting(null); setAdjustQty(0); setAdjustReason(""); toast({ title: "Stock ajustado" }); },
    onError: (e) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const sorted = [...products].sort((a, b) => {
    switch (sortBy) {
      case "price": return parseFloat(b.unit_price) - parseFloat(a.unit_price);
      case "stock": return b.current_stock - a.current_stock;
      case "created": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      default: return a.name.localeCompare(b.name);
    }
  });

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Inventario</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {total} producto{total !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={cn("p-1.5 rounded-md transition-colors", viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={cn("p-1.5 rounded-md transition-colors", viewMode === "table" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <Link href="/inventory/movements">
              <Button variant="outline" size="sm" className="h-9"><ChevronDown className="h-4 w-4 mr-1" />Movimientos</Button>
            </Link>
            <Button size="sm" className="h-9" onClick={() => { setEditingProduct(null); setDrawerOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" />Nuevo
            </Button>
            <Button variant="outline" size="sm" className="h-9" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-1" />Importar CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar por nombre o SKU..." className="pl-9 h-9 text-xs bg-background border-border" />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger className="w-[180px] h-9 text-xs bg-background border-border">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nombre</SelectItem>
                <SelectItem value="price">Precio</SelectItem>
                <SelectItem value="stock">Stock</SelectItem>
                <SelectItem value="created">Más reciente</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch checked={lowStockOnly} onCheckedChange={setLowStockOnly} />
              <Label className="text-xs text-muted-foreground cursor-pointer" onClick={() => setLowStockOnly(!lowStockOnly)}>Stock bajo</Label>
            </div>
          </div>
          <CategoryChips categories={catList} selected={catFilter} onSelect={v => { setCatFilter(v); setPage(1); }} />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Cargando...</span>
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-12 w-12 text-muted-foreground/55 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-1">
              {search || catFilter !== "all" || lowStockOnly ? "Sin resultados para estos filtros" : "Agrega tu primer producto para usarlo en facturas"}
            </p>
            {!search && catFilter === "all" && !lowStockOnly && (
              <Button size="sm" className="mt-3" onClick={() => { setEditingProduct(null); setDrawerOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" />Agregar producto
              </Button>
            )}
          </div>
        ) : viewMode === "table" ? (
          <div className="rounded-xl border border-border overflow-hidden bg-card/40">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground">Producto</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground">Categoría</th>
                  <th className="text-right px-4 py-3 text-[11px] font-medium text-muted-foreground">Precio</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground">Stock</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground">Tipo</th>
                  <th className="text-right px-4 py-3 text-[11px] font-medium text-muted-foreground w-20"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <ProductCard key={p.id} product={p} viewMode="table" onEdit={(prod) => { setEditingProduct(prod as Product); setDrawerOpen(true); }} onArchive={archiveMut.mutate} onAdjust={(prod) => setAdjusting(prod as Product)} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sorted.map((p) => (
              <ProductCard key={p.id} product={p} viewMode="grid" onEdit={(prod) => { setEditingProduct(prod as Product); setDrawerOpen(true); }} onArchive={archiveMut.mutate} onAdjust={(prod) => setAdjusting(prod as Product)} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-8 text-xs">Anterior</Button>
            <span className="text-xs text-muted-foreground px-3">{page} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-8 text-xs">Siguiente</Button>
          </div>
        )}
      </div>

      {/* FAB mobile */}
      <button
        onClick={() => { setEditingProduct(null); setDrawerOpen(true); }}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-110 md:hidden flex items-center justify-center"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Drawer */}
      <ProductDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditingProduct(null); }}
        onSave={(data) => {
          if (editingProduct) {
            updateMut.mutate({ id: editingProduct.id, ...data });
          } else {
            createMut.mutate(data);
          }
        }}
        isSaving={createMut.isPending || updateMut.isPending}
        product={editingProduct ?? undefined}
        categories={catList}
        onCategoryCreated={() => qc.invalidateQueries({ queryKey: ["inventory-categories"] })}
      />

      {/* Stock adjust dialog */}
      {adjusting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-semibold text-foreground mb-4">Ajustar stock — {adjusting.name}</h3>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Stock actual: <span className="text-foreground font-semibold">{adjusting.current_stock}</span></p>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Cantidad (+ entrada, − salida)</Label>
                <Input type="number" value={adjustQty} onChange={e => setAdjustQty(parseInt(e.target.value) || 0)} className="h-9 text-xs bg-background border-border" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Motivo</Label>
                <Input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Conteo físico, merma..." className="h-9 text-xs bg-background border-border" />
              </div>
              <p className="text-xs text-muted-foreground">Nuevo stock: <span className="text-foreground font-semibold">{(adjusting.current_stock || 0) + adjustQty}</span></p>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => { setAdjusting(null); setAdjustQty(0); setAdjustReason(""); }}>Cancelar</Button>
              <Button size="sm" className="flex-1 h-8 text-xs" disabled={adjustMut.isPending || adjustQty === 0} onClick={() => adjustMut.mutate({ id: adjusting.id, quantity: adjustQty, reason: adjustReason })}>
                {adjustMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Ajustar
              </Button>
            </div>
          </div>
        </div>
      )}

      <CsvImportModal open={importOpen} onClose={() => setImportOpen(false)} entityType="products" />
    </div>
  );
}
