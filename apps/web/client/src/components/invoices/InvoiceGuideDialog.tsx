import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HACIENDA_GUIDE } from "@/data/invoices.data";

export function InvoiceGuideDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="text-sm">Guía de conceptos de facturación y Hacienda</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-background px-4 py-3">
            <div className="text-sm font-medium text-foreground">Qué necesita una factura rigurosa para Hacienda</div>
            <p className="mt-1 text-xs leading-5 text-white/40">
              No basta con monto y cliente. Para que el sistema sea sólido se necesitan datos correctos del emisor,
              datos fiscales del receptor, líneas con CABYS e impuesto, catálogos tributarios, XML, firma, token,
              envío, callback o consulta de estado, y trazabilidad de aceptación o rechazo.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {HACIENDA_GUIDE.map((item) => (
              <div key={item.title} className="rounded-lg border border-border bg-background px-4 py-3">
                <div className="text-sm font-medium text-foreground">{item.title}</div>
                <p className="mt-1 text-xs leading-5 text-white/40">{item.meaning}</p>
                <div className="mt-2 rounded-md border border-border bg-card px-2.5 py-2 text-xs leading-5 text-foreground">
                  {item.example}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
            <div className="text-sm font-medium text-foreground">Pendiente importante</div>
            <p className="mt-1 text-xs leading-5 text-white/40">
              El flujo ya contempla la estructura de Hacienda, pero para operar en serio aún debes tener configurados
              el certificado real, la firma real, credenciales válidas, callback accesible y catálogos tributarios correctos.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
