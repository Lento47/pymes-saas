import { Coins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/utils";

interface PaymentForm {
  amount: string;
  paid_at: string;
  method: string;
  reference: string;
  notes: string;
}

export function InvoicePaymentDialog({
  open,
  onOpenChange,
  invoice,
  paymentForm,
  setPaymentForm,
  saveMutation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
  paymentForm: PaymentForm;
  setPaymentForm: (updater: (prev: PaymentForm) => PaymentForm) => void;
  saveMutation: { isPending: boolean; mutate: () => void };
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-sm">Registrar pago</DialogTitle>
        </DialogHeader>
        {!invoice ? null : (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-background px-3 py-2 space-y-1">
              <div className="text-xs text-white/40">
                {invoice.number} · {invoice.contact?.full_name}
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-white/40">Total</div>
                  <div className="text-foreground">{formatMoney(invoice.amount, invoice.currency)}</div>
                </div>
                <div>
                  <div className="text-white/40">Pagado</div>
                  <div className="text-foreground">{formatMoney(invoice.amount_paid, invoice.currency)}</div>
                </div>
                <div>
                  <div className="text-white/40">Saldo</div>
                  <div className="text-foreground">{formatMoney(invoice.balance_due, invoice.currency)}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-white/40">Monto abonado</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="h-8 text-xs bg-background border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-white/40">Fecha de pago</Label>
                <Input
                  type="date"
                  value={paymentForm.paid_at}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, paid_at: e.target.value }))}
                  className="h-8 text-xs bg-background border-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-white/40">Método</Label>
                <Input
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, method: e.target.value }))}
                  className="h-8 text-xs bg-background border-border"
                  placeholder="Pago móvil, transferencia..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-white/40">Referencia</Label>
                <Input
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, reference: e.target.value }))}
                  className="h-8 text-xs bg-background border-border"
                  placeholder="Comprobante"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-white/40">Notas</Label>
              <Textarea
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="min-h-[90px] text-xs bg-background border-border"
                placeholder="Detalle opcional del pago"
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
            onClick={() => saveMutation.mutate()}
            disabled={!invoice || !paymentForm.amount || saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Coins className="w-3.5 h-3.5 mr-1.5" />}
            Guardar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
