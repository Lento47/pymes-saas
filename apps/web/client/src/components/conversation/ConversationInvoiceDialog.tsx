import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ConversationInvoiceDialog({
  open,
  onOpenChange,
  contact,
  invoiceForm,
  setInvoiceForm,
  createInvoiceMutation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: any;
  invoiceForm: { number: string; amount: string; currency: string; due_date: string; description: string };
  setInvoiceForm: (updater: (prev: { number: string; amount: string; currency: string; due_date: string; description: string }) => { number: string; amount: string; currency: string; due_date: string; description: string }) => void;
  createInvoiceMutation: { isPending: boolean; mutate: () => void };
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-sm">Crear factura desde este chat</DialogTitle>
        </DialogHeader>
        {!contact ? (
          <p className="text-sm text-muted-foreground">Necesitas vincular un contacto antes de crear la factura.</p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-background px-3 py-2">
              <div className="text-xs text-muted-foreground">Cliente</div>
              <div className="text-sm text-foreground">{contact.full_name}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Número</Label>
                <Input
                  value={invoiceForm.number}
                  onChange={(e) => setInvoiceForm((prev) => ({ ...prev, number: e.target.value }))}
                  className="h-8 text-xs bg-background border-border"
                  placeholder="FAC-001"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Moneda</Label>
                <Input
                  value={invoiceForm.currency}
                  onChange={(e) => setInvoiceForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                  className="h-8 text-xs bg-background border-border"
                  placeholder="USD"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Monto total</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={invoiceForm.amount}
                  onChange={(e) => setInvoiceForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="h-8 text-xs bg-background border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Vencimiento</Label>
                <Input
                  type="date"
                  value={invoiceForm.due_date}
                  onChange={(e) => setInvoiceForm((prev) => ({ ...prev, due_date: e.target.value }))}
                  className="h-8 text-xs bg-background border-border"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Descripción</Label>
              <Textarea
                value={invoiceForm.description}
                onChange={(e) => setInvoiceForm((prev) => ({ ...prev, description: e.target.value }))}
                className="min-h-[90px] text-xs bg-background border-border"
                placeholder="Concepto o detalle de la factura"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => createInvoiceMutation.mutate()}
            disabled={
              !contact ||
              createInvoiceMutation.isPending ||
              !invoiceForm.number.trim() ||
              !invoiceForm.amount ||
              !invoiceForm.due_date
            }
          >
            {createInvoiceMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Guardar factura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
