import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DOCUMENT_TYPES, ISSUANCE_MODES } from "@/data/invoices.data";

interface EditForm {
  number: string;
  amount: string;
  currency: string;
  due_date: string;
  issue_date: string;
  description: string;
  issuance_mode: string;
  document_type: string;
  sale_condition: string;
  payment_method: string;
  activity_code: string;
  contact_id: string;
}

export function InvoiceEditDialog({
  open,
  onOpenChange,
  editForm,
  setEditForm,
  contacts,
  updateMutation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editForm: EditForm;
  setEditForm: (updater: (prev: EditForm) => EditForm) => void;
  contacts: any[];
  updateMutation: { isPending: boolean; mutate: () => void };
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-sm">Editar factura</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-white/40">Modo</Label>
              <Select value={editForm.issuance_mode} onValueChange={(v) => setEditForm(f => ({ ...f, issuance_mode: v }))}>
                <SelectTrigger className="h-8 text-xs bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{ISSUANCE_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/40">Documento</Label>
              <Select value={editForm.document_type} onValueChange={(v) => setEditForm(f => ({ ...f, document_type: v }))}>
                <SelectTrigger className="h-8 text-xs bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{DOCUMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-white/40">Contacto</Label>
            <select
              value={editForm.contact_id}
              onChange={(e) => setEditForm(f => ({ ...f, contact_id: e.target.value }))}
              className="flex h-8 w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">Sin contacto</option>
              {contacts.map((c: any) => (
                <option key={c.id} value={c.id}>{c.full_name}{c.company_name ? ` · ${c.company_name}` : ""}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-white/40">Número</Label>
              <Input value={editForm.number} onChange={(e) => setEditForm(f => ({ ...f, number: e.target.value }))} className="h-8 text-xs bg-background border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/40">Moneda</Label>
              <Input value={editForm.currency} onChange={(e) => setEditForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} className="h-8 text-xs bg-background border-border" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-white/40">Monto total</Label>
              <Input type="number" step="0.01" value={editForm.amount} onChange={(e) => setEditForm(f => ({ ...f, amount: e.target.value }))} className="h-8 text-xs bg-background border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/40">Vencimiento</Label>
              <Input type="date" value={editForm.due_date} onChange={(e) => setEditForm(f => ({ ...f, due_date: e.target.value }))} className="h-8 text-xs bg-background border-border" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-white/40">Fecha emisión</Label>
              <Input type="date" value={editForm.issue_date} onChange={(e) => setEditForm(f => ({ ...f, issue_date: e.target.value }))} className="h-8 text-xs bg-background border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/40">Actividad</Label>
              <Input value={editForm.activity_code} onChange={(e) => setEditForm(f => ({ ...f, activity_code: e.target.value }))} className="h-8 text-xs bg-background border-border" placeholder="Código" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-white/40">Condición venta</Label>
              <Input value={editForm.sale_condition} onChange={(e) => setEditForm(f => ({ ...f, sale_condition: e.target.value }))} className="h-8 text-xs bg-background border-border" placeholder="01" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/40">Medio pago</Label>
              <Input value={editForm.payment_method} onChange={(e) => setEditForm(f => ({ ...f, payment_method: e.target.value }))} className="h-8 text-xs bg-background border-border" placeholder="01" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-white/40">Descripción</Label>
            <Textarea value={editForm.description} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} className="min-h-[80px] text-xs bg-background border-border" placeholder="Detalles opcionales" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || !editForm.number.trim() || !editForm.amount || !editForm.due_date}
          >
            {updateMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
