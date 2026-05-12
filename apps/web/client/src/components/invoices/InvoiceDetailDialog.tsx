import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney } from "@/lib/utils";

export function InvoiceDetailDialog({
  open,
  onOpenChange,
  invoice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
}) {
  return (
    <Dialog open={open} onOpenChange={(open) => { onOpenChange(open); }}>
      <DialogContent className="bg-card border-border sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-sm">Detalle de factura</DialogTitle>
        </DialogHeader>
        {invoice && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-white/40">Número</span><div className="text-foreground font-medium mt-0.5">{invoice.number}</div></div>
              <div><span className="text-white/40">Estado</span><div className="mt-0.5"><StatusBadge status={invoice.status} type="invoice" /></div></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-white/40">Contacto</span><div className="text-foreground mt-0.5">{invoice.contact?.full_name ?? "—"}</div></div>
              <div><span className="text-white/40">Empresa</span><div className="text-foreground mt-0.5">{invoice.contact?.company_name ?? "—"}</div></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><span className="text-white/40">Total</span><div className="text-foreground font-medium mt-0.5">{formatMoney(invoice.amount, invoice.currency)}</div></div>
              <div><span className="text-white/40">Pagado</span><div className="text-green-400 font-medium mt-0.5">{formatMoney(invoice.amount_paid, invoice.currency)}</div></div>
              <div><span className="text-white/40">Saldo</span><div className="text-foreground font-medium mt-0.5">{formatMoney(invoice.balance_due, invoice.currency)}</div></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-white/40">Emisión</span><div className="text-foreground mt-0.5">{invoice.issue_date ? format(new Date(invoice.issue_date), "d MMM yyyy", { locale: es }) : "—"}</div></div>
              <div><span className="text-white/40">Vencimiento</span><div className="text-foreground mt-0.5">{invoice.due_date ? format(new Date(invoice.due_date), "d MMM yyyy", { locale: es }) : "—"}</div></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-white/40">Modo</span><div className="text-foreground mt-0.5">{invoice.issuance_mode}</div></div>
              <div><span className="text-white/40">Hacienda</span><div className="mt-0.5"><StatusBadge status={invoice.hacienda_status} type="invoice" /></div></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-white/40">Moneda</span><div className="text-foreground mt-0.5">{invoice.currency}</div></div>
              <div><span className="text-white/40">Tipo documento</span><div className="text-foreground mt-0.5">{invoice.document_type}</div></div>
            </div>
            {invoice.description && (
              <div><span className="text-white/40">Descripción</span><div className="text-foreground mt-0.5 whitespace-pre-wrap">{invoice.description}</div></div>
            )}
            {invoice.payments?.length > 0 && (
              <div>
                <span className="text-white/40">Pagos registrados</span>
                <div className="mt-1 space-y-1">
                  {invoice.payments.map((p: any) => (
                    <div key={p.id} className="flex justify-between rounded border border-border bg-background px-2 py-1">
                      <span className="text-foreground">{formatMoney(p.amount, invoice.currency)}</span>
                      <span className="text-white/40">{p.paid_at ? format(new Date(p.paid_at), "d MMM yyyy", { locale: es }) : "—"}</span>
                      <span className="text-white/40">{p.method ?? "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
