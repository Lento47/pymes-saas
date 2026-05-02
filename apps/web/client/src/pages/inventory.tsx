import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Plus, Pencil, Archive, Package, Layers, Minus, Plus as PlusIcon,
  Loader2, Trash2, ChevronDown,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

function stockColor(stock: number, min: number, track: boolean, type: string) {
  if (!track || type === "SERVICE") return "text-muted-foreground";
  if (stock <= 0) return "text-red-400";
  if (stock <= min) return "text-amber-400";
  return "text-emerald-400";
}

function stockBg(stock: number, min: number, track: boolean, type: string) {
  if (!track || type === "SERVICE") return "bg-muted/30";
  if (stock <= 0) return "bg-red-500/10";
  if (stock <= min) return "bg-amber-500/10";
  return "bg-emerald-500/10";
}

const EMPTY = { name: "", sku: "", description: "", type: "PRODUCT", unit_price: 0, cost_price: 0, min_stock: 0, unit_of_measure: "", track_inventory: true, category_id: "" };

export default function InventoryPage() {
  useRequireAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [adjusting, setAdjusting] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");

  const { data: prodData, isLoading } = useQuery({
    queryKey: ["inventory-products", search, catFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      if (catFilter) p.set("category_id", catFilter);
      p.set("limit", "100");
      return api.getProducts(p.toString());
    },
    refetchInterval: 30000,
  });

  const { data: categories } = useQuery({
    queryKey: ["inventory-categories"],
    queryFn: api.getCategories,
  });

  const { data: lowStock } = useQuery({
    queryKey: ["inventory-low-stock"],
    queryFn: api.getLowStock,
    refetchInterval: 60000,
  });

  const products: any[] = prodData?.data ?? [];
  const catList: any[] = Array.isArray(categories) ? categories : [];
  const lowList: any[] = Array.isArray(lowStock) ? lowStock : [];

  const createMut = useMutation({
    mutationFn: (d: any) => api.createProduct(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory-products"] }); setCreating(false); setForm({ ...EMPTY }); toast({ title: "Producto creado" }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: any) => api.updateProduct(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory-products"] }); setEditing(null); toast({ title: "Producto actualizado" }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => api.archiveProduct(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory-products"] }); toast({ title: "Producto archivado" }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const adjustMut = useMutation({
    mutationFn: ({ id, ...d }: any) => api.adjustStock(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory-products"] }); setAdjusting(null); setAdjustQty(0); setAdjustReason(""); toast({ title: "Stock ajustado" }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const prodForm = (isEdit: boolean) => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Nombre</Label>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-[hsl(var(--elevated))] border-border" />
        </div>
        <div>
          <Label>SKU</Label>
          <Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} className="bg-[hsl(var(--elevated))] border-border" />
        </div>
      </div>
      <div>
        <Label>Categoría</Label>
        <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
          <SelectTrigger className="bg-[hsl(var(--elevated))] border-border"><SelectValue placeholder="Sin categoría" /></SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="none">Sin categoría</SelectItem>
            {catList.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Descripción</Label>
        <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="bg-[hsl(var(--elevated))] border-border" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tipo</Label>
          <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
            <SelectTrigger className="bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="PRODUCT">Producto</SelectItem>
              <SelectItem value="SERVICE">Servicio</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Unidad</Label>
          <Input value={form.unit_of_measure} onChange={e => setForm({ ...form, unit_of_measure: e.target.value })} placeholder="unidad, kg, hora" className="bg-[hsl(var(--elevated))] border-border" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Precio venta</Label>
          <Input type="number" min="0" step="0.01" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })} className="bg-[hsl(var(--elevated))] border-border" />
        </div>
        <div>
          <Label>Costo</Label>
          <Input type="number" min="0" step="0.01" value={form.cost_price || ""} onChange={e => setForm({ ...form, cost_price: parseFloat(e.target.value) || 0 })} className="bg-[hsl(var(--elevated))] border-border" />
        </div>
        <div>
          <Label>Stock mín.</Label>
          <Input type="number" min="0" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: parseInt(e.target.value) || 0 })} className="bg-[hsl(var(--elevated))] border-border" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.track_inventory} onCheckedChange={v => setForm({ ...form, track_inventory: v })} />
        <Label>Control de inventario</Label>
      </div>
    </div>
  );

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Inventario</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {products.length} producto{products.length !== 1 ? "s" : ""}
              {lowList.length > 0 && <span className="text-amber-400 ml-2">— {lowList.length} con stock bajo</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/inventory/categories">
              <Button variant="outline" size="sm"><Layers className="h-4 w-4 mr-1" />Categorías</Button>
            </Link>
            <Link href="/inventory/movements">
              <Button variant="outline" size="sm"><ChevronDown className="h-4 w-4 mr-1" />Movimientos</Button>
            </Link>
            <Button size="sm" onClick={() => { setForm({ ...EMPTY }); setCreating(true); }}>
              <Plus className="h-4 w-4 mr-1" />Nuevo producto
            </Button>
          </div>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o SKU..." className="pl-9 bg-[hsl(var(--elevated))] border-border" />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-48 bg-[hsl(var(--elevated))] border-border"><SelectValue placeholder="Todas las categorías" /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">Todas las categorías</SelectItem>
              {catList.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8"><Loader2 className="h-4 w-4 animate-spin" />Cargando...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Agrega tu primer producto para usarlo en facturas</p>
            <Button size="sm" className="mt-4" onClick={() => { setForm({ ...EMPTY }); setCreating(true); }}>
              <Plus className="h-4 w-4 mr-1" />Agregar producto
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[hsl(var(--elevated))]">
                <tr>
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Producto</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium hidden sm:table-cell">SKU</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium hidden md:table-cell">Cat.</th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium">Precio</th>
                  <th className="text-center px-4 py-2 text-muted-foreground font-medium">Stock</th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p: any) => {
                  const sc = stockColor(p.current_stock, p.min_stock, p.track_inventory, p.type);
                  const sbg = stockBg(p.current_stock, p.min_stock, p.track_inventory, p.type);
                  return (
                    <tr key={p.id} className="border-t border-border hover:bg-[hsl(var(--elevated))] transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-medium">{p.name}</span>
                          {p.type === "SERVICE" && <Badge variant="secondary" className="text-[10px]">Servicio</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs hidden sm:table-cell">{p.sku}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs hidden md:table-cell">{p.category?.name || "—"}</td>
                      <td className="px-4 py-2.5 text-right text-foreground text-xs">
                        ₡{parseFloat(p.unit_price).toLocaleString("es-CR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${sbg} ${sc}`}>
                          {p.track_inventory && p.type === "PRODUCT" ? p.current_stock : "—"}
                          {p.track_inventory && p.type === "PRODUCT" && p.current_stock <= p.min_stock && (
                            <span className="ml-1 text-[10px]">/ min {p.min_stock}</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          {p.track_inventory && p.type === "PRODUCT" && (
                            <Button variant="ghost" size="sm" onClick={() => setAdjusting(p)} title="Ajustar stock">
                              <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => { setForm({ ...p, category_id: p.category_id || "" }); setEditing(p); }}>
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { if (confirm("¿Archivar producto?")) archiveMut.mutate(p.id); }}>
                            <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader><DialogTitle>Nuevo Producto</DialogTitle></DialogHeader>
            {prodForm(false)}
            <Button className="w-full mt-2" disabled={createMut.isPending || !form.name || !form.sku} onClick={() => createMut.mutate({ ...form, category_id: form.category_id === "none" ? undefined : form.category_id || undefined })}>
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Crear
            </Button>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader><DialogTitle>Editar Producto</DialogTitle></DialogHeader>
            {editing && prodForm(true)}
            <Button className="w-full mt-2" disabled={updateMut.isPending} onClick={() => updateMut.mutate({ id: editing.id, ...form, category_id: form.category_id === "none" ? undefined : form.category_id || undefined })}>
              {updateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Guardar
            </Button>
          </DialogContent>
        </Dialog>

        <Dialog open={!!adjusting} onOpenChange={(o) => { if (!o) setAdjusting(null); }}>
          <DialogContent className="bg-card border-border max-w-sm">
            <DialogHeader><DialogTitle>Ajustar Stock — {adjusting?.name}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Stock actual: <span className="text-foreground font-medium">{adjusting?.current_stock}</span></p>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>Cantidad (+ entrada, - salida)</Label>
                  <Input type="number" value={adjustQty} onChange={e => setAdjustQty(parseInt(e.target.value) || 0)} className="bg-[hsl(var(--elevated))] border-border" />
                </div>
              </div>
              <div>
                <Label>Motivo</Label>
                <Input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Conteo físico, merma..." className="bg-[hsl(var(--elevated))] border-border" />
              </div>
              <p className="text-xs text-muted-foreground">Nuevo stock: <span className="text-foreground">{(adjusting?.current_stock || 0) + adjustQty}</span></p>
            </div>
            <Button className="w-full mt-2" disabled={adjustMut.isPending || adjustQty === 0} onClick={() => adjustMut.mutate({ id: adjusting.id, quantity: adjustQty, reason: adjustReason })}>
              {adjustMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Ajustar
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
