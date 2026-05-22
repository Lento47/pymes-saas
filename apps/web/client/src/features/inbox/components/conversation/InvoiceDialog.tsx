import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProductPicker } from "@/components/inventory/ProductPicker";
import { Loader2, Plus, X, Send } from "lucide-react";

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  contactId?: string;
  canSendInvoice: boolean;
  createInvMut: { mutate: (payload: { form: Record<string, any>; lines: Array<Record<string, any>> }) => void; isPending: boolean };
  sendInvMut: { mutate: (invoice: { id: string }) => void; isPending: boolean };
}

export function InvoiceDialog({
  open,
  onOpenChange,
  conversationId,
  contactId,
  canSendInvoice,
  createInvMut,
  sendInvMut,
}: InvoiceDialogProps) {
  const [invoiceForm, setInvoiceForm] = useState({ number: "", currency: "USD", due_date: "", description: "" });
  const [lines, setLines] = useState<Array<{ product_id?: string; name: string; description: string; quantity: number; unit_price: number; tax_rate: number }>>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);

  const { data: invoicesData } = useQuery({
    queryKey: ["conversation-invoices", conversationId],
    queryFn: () => api.getInvoices({ conversation_id: conversationId, limit: "10" }),
    enabled: open && !!conversationId,
    staleTime: 30_000,
  });
  const invoiceList: Array<{ id: string; number?: string; amount?: number; balance_due?: number; currency?: string; status?: string; lines?: Array<{ product?: { name?: string }; description?: string }> }> = Array.isArray(invoicesData) ? invoicesData : invoicesData?.data || [];

  const lineSubtotals = useMemo(() => lines.map(l => l.quantity * l.unit_price), [lines]);
  const lineTaxes = useMemo(() => lines.map((l, i) => lineSubtotals[i] * (l.tax_rate / 100)), [lines, lineSubtotals]);
  const totalAmount = useMemo(() => lineSubtotals.reduce((s, v) => s + v, 0) + lineTaxes.reduce((s, v) => s + v, 0), [lineSubtotals, lineTaxes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-sm">Facturación</DialogTitle>
        </DialogHeader>

        {invoiceList.length > 0 && (
          <div className="space-y-2">
            {invoiceList.map((inv) => (
              <div key={inv.id} className="rounded-lg border border-border bg-background px-3 py-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium">{inv.number}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Intl.NumberFormat("es-CR", { style: "currency", currency: inv.currency ?? "USD", maximumFractionDigits: 0 }).format(inv.amount || 0)} · <StatusBadge status={inv.status ?? ""} type="invoice" className="inline" />
                    </div>
                    {(inv.lines?.length ?? 0) > 0 && (
                      <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {inv.lines!.map((l) => l.product?.name || l.description).join(", ")}
                      </div>
                    )}
                  </div>
                  {canSendInvoice && (
                    <Button size="sm" className="h-7 text-[11px] gap-1" onClick={() => sendInvMut.mutate(inv)} disabled={sendInvMut.isPending}>
                      {sendInvMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      {Number(inv.balance_due ?? 0) > 0 ? "Enviar" : "Reenviar"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!contactId ? (
          <p className="text-xs text-muted-foreground">Vincula un contacto primero para crear facturas.</p>
        ) : (
          <div className="space-y-3 border-t border-border pt-3 mt-2">
            <p className="text-xs font-medium text-muted-foreground">Nueva factura</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px]">Número</Label>
                <Input value={invoiceForm.number} onChange={e => setInvoiceForm(p => ({ ...p, number: e.target.value }))} className="h-7 text-xs bg-background border-border" placeholder="FAC-001" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Moneda</Label>
                <Input value={invoiceForm.currency} onChange={e => setInvoiceForm(p => ({ ...p, currency: e.target.value.toUpperCase() }))} className="h-7 text-xs bg-background border-border" placeholder="USD" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Vencimiento</Label>
              <Input type="date" value={invoiceForm.due_date} onChange={e => setInvoiceForm(p => ({ ...p, due_date: e.target.value }))} className="h-7 text-xs bg-background border-border" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px]">Productos / Líneas</Label>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setShowProductPicker(true)}>
                  <Plus className="w-3 h-3" />Agregar
                </Button>
              </div>

              {showProductPicker && (
                <ProductPicker
                  open={showProductPicker}
                  onOpenChange={setShowProductPicker}
                  onSelect={(product) => {
                    setLines(prev => [...prev, {
                      product_id: product.id,
                      name: product.name,
                      description: product.description,
                      quantity: 1,
                      unit_price: product.unit_price,
                      tax_rate: 13,
                    }]);
                  }}
                />
              )}

              {lines.length > 0 && (
                <div className="space-y-1 mt-2">
                  {lines.map((line, i) => {
                    const lineSubtotal = line.quantity * line.unit_price;
                    const lineTax = lineSubtotal * (line.tax_rate / 100);
                    return (
                      <div key={i} className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5">
                        <span className="text-[10px] text-muted-foreground shrink-0">{i + 1}.</span>
                        <span className="text-[10px] flex-1 truncate">{line.name}</span>
                        <input type="number" min="1" value={line.quantity} onChange={e => {
                          const q = Math.max(1, parseInt(e.target.value) || 1);
                          setLines(prev => prev.map((l, j) => j === i ? { ...l, quantity: q } : l));
                        }} className="w-9 h-6 text-[10px] text-center bg-background border border-border rounded" />
                        <span className="text-[9px] text-muted-foreground">×</span>
                        <input type="number" min="0" step="any" value={line.unit_price} onChange={e => {
                          setLines(prev => prev.map((l, j) => j === i ? { ...l, unit_price: Number(e.target.value) || 0 } : l));
                        }} className="w-14 h-6 text-[10px] text-right bg-background border border-border rounded" />
                        <input type="number" min="0" max="100" value={line.tax_rate} onChange={e => {
                          setLines(prev => prev.map((l, j) => j === i ? { ...l, tax_rate: Number(e.target.value) || 0 } : l));
                        }} className="w-9 h-6 text-[10px] text-center bg-background border border-border rounded" title="IVA %" />
                        <span className="text-[10px] text-muted-foreground w-[4.5rem] text-right truncate">
                          {new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC" }).format(lineSubtotal + lineTax)}
                        </span>
                        <button onClick={() => setLines(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-400 shrink-0 ml-0.5">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                  <div className="text-[10px] text-right px-1 pt-1 space-y-0.5">
                    {lineSubtotals.reduce((s, v) => s + v, 0) > 0 && (
                      <div className="flex justify-end gap-2">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span>{new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC" }).format(lineSubtotals.reduce((s, v) => s + v, 0))}</span>
                      </div>
                    )}
                    {lineTaxes.reduce((s, v) => s + v, 0) > 0 && (
                      <div className="flex justify-end gap-2">
                        <span className="text-muted-foreground">IVA:</span>
                        <span>{new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC" }).format(lineTaxes.reduce((s, v) => s + v, 0))}</span>
                      </div>
                    )}
                    <div className="flex justify-end gap-2 font-semibold text-[11px] pt-0.5 border-t border-border">
                      <span>Total:</span>
                      <span>{new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC" }).format(totalAmount)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Descripción</Label>
              <Input value={invoiceForm.description} onChange={e => setInvoiceForm(p => ({ ...p, description: e.target.value }))} className="h-7 text-xs bg-background border-border" placeholder="Concepto o detalle" />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {contactId && (
            <Button size="sm" className="h-8 text-xs"
              onClick={() => createInvMut.mutate({ form: { number: invoiceForm.number, currency: invoiceForm.currency, due_date: invoiceForm.due_date, description: invoiceForm.description }, lines })}
              disabled={!invoiceForm.number.trim() || totalAmount <= 0 || !invoiceForm.due_date || createInvMut.isPending}>
              {createInvMut.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
              Guardar factura
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
