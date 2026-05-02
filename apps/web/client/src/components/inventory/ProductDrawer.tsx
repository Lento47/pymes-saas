import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  isSaving: boolean;
  product?: any;
  categories: any[];
}

const EMPTY = { name: "", sku: "", description: "", type: "PRODUCT", unit_price: 0, cost_price: 0, min_stock: 0, unit_of_measure: "", track_inventory: true, category_id: "" };

export function ProductDrawer({ open, onClose, onSave, isSaving, product, categories }: Props) {
  const [form, setForm] = useState({ ...EMPTY });

  useEffect(() => {
    if (open) {
      if (product) {
        setForm({
          name: product.name || "",
          sku: product.sku || "",
          description: product.description || "",
          type: product.type || "PRODUCT",
          unit_price: parseFloat(product.unit_price) || 0,
          cost_price: parseFloat(product.cost_price) || 0,
          min_stock: product.min_stock || 0,
          unit_of_measure: product.unit_of_measure || "",
          track_inventory: product.track_inventory ?? true,
          category_id: product.category_id || "",
        });
      } else {
        setForm({ ...EMPTY });
      }
    }
  }, [open, product]);

  const isValid = form.name && form.sku;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] p-0 gap-0 flex flex-col h-full">
        <SheetHeader className="px-6 py-4 border-b border-border/60 space-y-1 shrink-0">
          <SheetTitle className="text-sm font-semibold">
            {product ? "Editar producto" : "Nuevo producto"}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px]">Nombre <span className="text-red-400">*</span></Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-9 text-xs bg-background border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">SKU <span className="text-red-400">*</span></Label>
              <Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} className="h-9 text-xs bg-background border-border" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px]">Categoría</Label>
            <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
              <SelectTrigger className="h-9 text-xs bg-background border-border"><SelectValue placeholder="Sin categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin categoría</SelectItem>
                {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px]">Descripción</Label>
            <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="h-9 text-xs bg-background border-border" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px]">Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger className="h-9 text-xs bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRODUCT">Producto</SelectItem>
                  <SelectItem value="SERVICE">Servicio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Unidad</Label>
              <Input value={form.unit_of_measure} onChange={e => setForm({ ...form, unit_of_measure: e.target.value })} placeholder="unidad, kg, h" className="h-9 text-xs bg-background border-border" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px]">Precio venta</Label>
              <Input type="number" min="0" step="0.01" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })} className="h-9 text-xs bg-background border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Costo</Label>
              <Input type="number" min="0" step="0.01" value={form.cost_price || ""} onChange={e => setForm({ ...form, cost_price: parseFloat(e.target.value) || 0 })} className="h-9 text-xs bg-background border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Stock mín.</Label>
              <Input type="number" min="0" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: parseInt(e.target.value) || 0 })} className="h-9 text-xs bg-background border-border" />
            </div>
          </div>

          {form.type !== "SERVICE" && (
            <div className="flex items-center gap-2">
              <Switch checked={form.track_inventory} onCheckedChange={v => setForm({ ...form, track_inventory: v })} />
              <Label className="text-[11px]">Control de inventario</Label>
            </div>
          )}
        </div>

        <SheetFooter className="px-6 py-3 border-t border-border/60 shrink-0 flex-row justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving} className="h-8 text-xs">Cancelar</Button>
          <Button size="sm" onClick={() => onSave({ ...form, category_id: form.category_id === "none" ? undefined : form.category_id || undefined })} disabled={isSaving || !isValid} className="h-8 text-xs gap-1.5">
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {product ? "Guardar" : "Crear"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
