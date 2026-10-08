import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { apiErrorDescription } from "@/lib/api-error";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type InvoiceActionKind =
  | "delete"
  | "cancel"
  | "credit"
  | "approve"
  | "reject"
  | "submit";
export type InvoiceAction = {
  kind: InvoiceActionKind;
  invoice: Record<string, any>;
};
const copy: Record<
  InvoiceActionKind,
  { title: string; description: string; button: string; success: string }
> = {
  delete: {
    title: "Eliminar factura",
    description:
      "La factura y sus pagos registrados se eliminarán permanentemente. Esta acción no se puede deshacer.",
    button: "Eliminar factura",
    success: "Factura eliminada",
  },
  cancel: {
    title: "Cancelar factura",
    description:
      "La factura pasará a estado cancelado. Esta acción no se puede deshacer.",
    button: "Sí, cancelar factura",
    success: "Factura cancelada",
  },
  credit: {
    title: "Crear nota de crédito",
    description:
      "Se creará un borrador por el importe de esta factura. Podrás revisarlo antes de enviarlo a Hacienda.",
    button: "Crear borrador",
    success: "Nota de crédito creada. Revisa el borrador antes de enviarlo.",
  },
  approve: {
    title: "Aprobar factura",
    description: "El borrador quedará aprobado y listo para enviar.",
    button: "Aprobar factura",
    success: "Factura aprobada",
  },
  reject: {
    title: "Descartar borrador",
    description:
      "El borrador será descartado por revisión. Confirma que has seleccionado la factura correcta.",
    button: "Descartar borrador",
    success: "Borrador descartado",
  },
  submit: {
    title: "Enviar a Hacienda",
    description:
      "El comprobante se pondrá en cola para su emisión fiscal. Verifica sus datos antes de continuar.",
    button: "Confirmar envío",
    success: "Comprobante en cola para Hacienda",
  },
};

export function InvoiceActionDialog({
  action,
  onClose,
  onSuccess,
  restoreFocus,
}: {
  action: InvoiceAction;
  onClose: () => void;
  onSuccess: (message: string) => void;
  restoreFocus: (deleted: boolean) => void;
}) {
  const { kind, invoice } = action;
  const text = copy[kind];
  const [number, setNumber] = useState(`NC-${invoice.number}`.slice(0, 50));
  const locked = useRef(false);
  const completed = useRef(false);
  const operation = useMutation({
    mutationFn: async () => {
      switch (kind) {
        case "delete":
          return api.deleteInvoice(invoice.id);
        case "cancel":
          return api.updateInvoice(invoice.id, { status: "CANCELLED" });
        case "approve":
          return api.approveInvoice(invoice.id);
        case "reject":
          return api.rejectInvoice(invoice.id, "Descartado por revisión");
        case "submit":
          return api.submitInvoiceToHacienda(invoice.id);
        case "credit":
          return api.createCreditNote(invoice.id, {
            number: number.trim(),
            contact_id: invoice.contact_id ?? invoice.contact?.id,
            amount: Math.round(Number(invoice.amount) * 100) / 100,
            currency: invoice.currency,
            due_date: new Date().toISOString().slice(0, 10),
          });
      }
    },
    onSuccess: () => {
      completed.current = true;
      onSuccess(text.success);
      onClose();
    },
    onSettled: () => {
      locked.current = false;
    },
  });
  const destructive = ["delete", "cancel", "reject"].includes(kind);
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !locked.current) onClose();
      }}
    >
      <AlertDialogContent
        className="app-overlay invoice-confirm w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-2xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus(kind === "delete" && completed.current);
        }}
        aria-busy={operation.isPending}
      >
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle>{text.title}</AlertDialogTitle>
          <AlertDialogDescription>{text.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1 rounded-xl border border-border p-3 break-words">
          <p className="font-semibold">{invoice.number}</p>
          <p className="text-sm text-muted-foreground">
            {invoice.contact?.full_name}
          </p>
          <p>
            {new Intl.NumberFormat("es", {
              style: "currency",
              currency: invoice.currency,
              currencyDisplay: "code",
            }).format(Number(invoice.amount))}
          </p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (locked.current) return;
            locked.current = true;
            operation.mutate();
          }}
          className="space-y-4"
        >
          {kind === "credit" && (
            <div className="space-y-2">
              <Input
                label="Número de la nota"
                required
                maxLength={50}
                pattern={".*\\S.*"}
                className="h-12 text-base"
                value={number}
                disabled={operation.isPending}
                onChange={(event) => setNumber(event.target.value)}
              />
            </div>
          )}
          {operation.isError && (
            <div role="alert" className="text-sm text-destructive">
              {apiErrorDescription(
                operation.error,
                "No se pudo completar la operación. Vuelve a intentar.",
              )}
            </div>
          )}
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              type="button"
              className="min-h-12"
              disabled={operation.isPending}
            >
              Volver
            </AlertDialogCancel>
            <Button
              type="submit"
              variant={destructive ? "danger" : "primary"}
              className="min-h-12 whitespace-normal"
              disabled={operation.isPending}
            >
              {operation.isPending && (
                <Loader2
                  aria-hidden="true"
                  className="mr-2 h-4 w-4 animate-spin"
                />
              )}
              {operation.isPending ? "Procesando…" : text.button}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
