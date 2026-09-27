import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { api } from "@/lib/api";
import { apiErrorDescription } from "@/lib/api-error";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";

export function InvoiceReminderSheet({ invoice, onClose, onSent, restoreFocus }: {
  invoice: Record<string, any>; onClose: () => void; onSent: () => void; restoreFocus: () => void;
}) {
  const mobile = useIsMobile();
  const { user } = useAuth();
  const [draft, setDraft] = useState(invoice.reminders?.[0]?.draft_text ?? "");
  const baseline = useRef(draft);
  const edited = useRef(false);
  const started = useRef(false);
  const locked = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const keepEditing = useRef<HTMLButtonElement>(null);
  const [discard, setDiscard] = useState(false);
  const [channelId, setChannelId] = useState("");
  const channelsQuery = useQuery({
    queryKey: ["/api/channels", user?.workspace.id, "invoice-reminders"], queryFn: api.getChannels, retry: false,
  });
  const rows = Array.isArray(channelsQuery.data) ? channelsQuery.data : channelsQuery.data?.data ?? [];
  const channels = rows.filter((channel: any) => channel.status === "ACTIVE" &&
    ((channel.type === "EMAIL" && invoice.contact?.email) || (channel.type === "WHATSAPP" && invoice.contact?.phone?.replace(/\D/g, ""))));
  const channel = channels.find((item: any) => item.id === channelId);
  useEffect(() => {
    setChannelId(current => channels.some((item: any) => item.id === current) ? current : channels[0]?.id ?? "");
  }, [channelsQuery.data, invoice]);
  const generate = useMutation({
    mutationFn: () => api.generateInvoiceReminder(invoice.id),
    onSuccess: result => {
      // A retry must not replace text the user has already written.
      if (!edited.current) { const text = result.draft_text ?? ""; baseline.current = text; setDraft(text); }
    },
  });
  useEffect(() => { if (!started.current) { started.current = true; generate.mutate(); } }, [generate.mutate]);
  const send = useMutation({
    mutationFn: () => api.sendInvoiceReminder(invoice.id, { channel_id: channelId, draft_text: draft.trim() }),
    onSuccess: () => { onSent(); onClose(); },
    onSettled: () => { locked.current = false; },
  });
  const dirty = draft !== baseline.current;
  useEffect(() => {
    if (!dirty && !send.isPending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, send.isPending]);
  useEffect(() => { if (discard) { keepEditing.current?.scrollIntoView({ block: "center", behavior: "instant" }); keepEditing.current?.focus(); } }, [discard]);
  const close = () => { if (locked.current) return; if (dirty) setDiscard(true); else onClose(); };
  const canSend = generate.isSuccess && !generate.isPending && !channelsQuery.isError && !!channel && !!draft.trim() && !send.isPending && !discard;
  return <Sheet open onOpenChange={open => { if (!open) close(); }}>
    <SheetContent side={mobile ? "bottom" : "right"} closeLabel="Cerrar" closeDisabled={send.isPending}
      className="app-overlay invoice-editor flex h-[92dvh] w-full flex-col gap-0 overflow-hidden rounded-t-3xl p-0 sm:h-full sm:max-w-xl sm:rounded-none"
      onOpenAutoFocus={event => { event.preventDefault(); title.current?.focus(); }}
      onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(); }}
      onEscapeKeyDown={event => { if (locked.current) event.preventDefault(); }}>
      <SheetHeader className="shrink-0 border-b px-5 pb-4 pt-6 text-left">
        <SheetTitle ref={title} tabIndex={-1} className="pr-10">Recordatorio de pago</SheetTitle>
        <SheetDescription>Revisa el destinatario y el contenido antes de enviar.</SheetDescription>
      </SheetHeader>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={event => { event.preventDefault(); if (!canSend || locked.current) return; locked.current = true; send.mutate(); }}>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <fieldset disabled={send.isPending} className="min-w-0 space-y-5">
            <div className="rounded-2xl border bg-muted/30 p-4 break-words">
              <p className="font-semibold">{invoice.number}</p><p className="text-sm text-muted-foreground">{invoice.contact?.full_name}</p>
              <p className="mt-2">{new Intl.NumberFormat("es", { style: "currency", currency: invoice.currency, currencyDisplay: "code" }).format(Number(invoice.balance_due))} pendientes</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder-channel">Canal de envío</Label>
              {channelsQuery.isLoading ? <p role="status" className="text-sm">Cargando canales…</p>
                : channelsQuery.isError ? <div role="alert" className="space-y-2 text-sm"><p>No se pudieron cargar los canales.</p><Button type="button" variant="outline" className="min-h-12" disabled={channelsQuery.isFetching} onClick={() => channelsQuery.refetch()}>Reintentar canales</Button></div>
                : channels.length === 0 ? <p role="status" className="text-sm text-muted-foreground">No hay canales activos compatibles con los datos de este cliente. Revisa su correo o teléfono y la configuración del canal.</p>
                : <select id="reminder-channel" className="h-12 w-full min-w-0 rounded-xl border bg-background px-3 text-base" value={channelId} onChange={event => setChannelId(event.target.value)}>
                  {channels.map((item: any) => <option key={item.id} value={item.id}>{item.name} · {item.type === "EMAIL" ? "Correo" : "WhatsApp"}</option>)}
                </select>}
              {channel && <p className="break-words text-sm text-muted-foreground">Destinatario: {channel.type === "EMAIL" ? invoice.contact.email : invoice.contact.phone}</p>}
              {channel?.type === "WHATSAPP" && <p className="rounded-xl border p-3 text-sm text-muted-foreground">WhatsApp envía la plantilla de factura aprobada con cliente, número, saldo pendiente, vencimiento y productos. El texto libre del borrador se utiliza para correo.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder-draft">Borrador del recordatorio</Label>
              {generate.isPending && <p role="status" className="text-sm">Preparando borrador…</p>}
              {generate.isError && <div role="alert" className="space-y-2 text-sm"><p>{apiErrorDescription(generate.error, "No se pudo preparar el borrador.")}</p><Button type="button" variant="outline" className="min-h-12" onClick={() => generate.mutate()}>Reintentar borrador</Button></div>}
              <Textarea id="reminder-draft" className="min-h-[200px] rounded-xl text-base" value={draft} disabled={generate.isPending} required onChange={event => { edited.current = true; setDraft(event.target.value); }} />
            </div>
            {send.isError && <div role="alert" className="text-sm text-destructive">{apiErrorDescription(send.error, "No se pudo enviar el recordatorio. Conservamos tu borrador.")}</div>}
            {discard && <div role="group" aria-label="Cambios sin enviar" className="space-y-3 rounded-xl border p-4"><p className="text-sm">Tienes cambios sin enviar. ¿Quieres descartarlos?</p><div className="flex flex-wrap gap-2"><Button ref={keepEditing} type="button" variant="outline" className="min-h-12" onClick={() => setDiscard(false)}>Seguir editando</Button><Button type="button" variant="destructive" className="min-h-12" onClick={onClose}>Descartar cambios</Button></div></div>}
          </fieldset>
        </div>
        <SheetFooter className="shrink-0 gap-2 border-t px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button type="button" variant="outline" className="min-h-12" disabled={send.isPending} onClick={close}>Cancelar</Button>
          <Button type="submit" className="min-h-12" disabled={!canSend}>{send.isPending ? <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" /> : <Send aria-hidden className="mr-2 h-4 w-4" />}{send.isPending ? "Enviando…" : "Enviar recordatorio"}</Button>
        </SheetFooter>
      </form>
    </SheetContent>
  </Sheet>;
}
