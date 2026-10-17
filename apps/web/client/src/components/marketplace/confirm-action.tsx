import { type ReactElement, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** Keep failures in context and hold focus until the requested action finishes. */
export function ConfirmAction({
  children,
  title,
  description,
  confirmLabel,
  cancelLabel,
  errorMessage,
  onConfirm,
}: {
  children: ReactElement;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  errorMessage: string;
  onConfirm: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) {
          setOpen(value);
          setFailed(false);
        }
      }}
    >
      <AlertDialogTrigger asChild ref={trigger}>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent
        className="storefront max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-2xl border-border p-6 shadow-none"
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          if (!trigger.current?.isConnected) {
            event.preventDefault();
            document.querySelector<HTMLElement>("main")?.focus();
          }
        }}
      >
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle className="text-xl tracking-tight">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {failed ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive/25 bg-destructive/[0.07] p-3 text-sm text-destructive"
          >
            {errorMessage}
          </p>
        ) : null}
        <AlertDialogFooter className="gap-2 sm:space-x-0">
          <AlertDialogCancel
            disabled={busy}
            className="min-h-11 whitespace-normal rounded-xl border-border bg-card px-4 py-3 text-sm text-foreground hover:bg-bg-hover"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <Button
            type="button"
            disabled={busy}
            aria-busy={busy || undefined}
            className="min-h-11 whitespace-normal rounded-xl border border-destructive/40 bg-destructive/[0.07] px-4 py-3 text-sm text-destructive hover:bg-destructive/10"
            onClick={async () => {
              setBusy(true);
              setFailed(false);
              try {
                await onConfirm();
                setOpen(false);
              } catch {
                setFailed(true);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Procesando…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
