import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useConversationSocket } from "@/hooks/use-conversation-socket";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/status-badge";
import { PriorityDot } from "@/components/shared/priority-dot";
import { ProductPicker } from "@/components/inventory/ProductPicker";
import { Loader2, Plus, X, Send } from "lucide-react";
import { ConversationHeader } from "./conversation/ConversationHeader";
import { MessageTimeline } from "./conversation/MessageTimeline";
import { MessageComposer } from "./conversation/MessageComposer";
import { normalizeMessage } from "@/features/inbox/message-adapters";
import type { UiMessage } from "@/features/inbox/message-types";

interface Invoice {
  id: string;
  number?: string;
  amount?: number;
  balance_due?: number;
  currency?: string;
  status?: string;
  lines?: InvoiceLine[];
}

interface InvoiceLine {
  product?: { name?: string };
  description?: string;
}

const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: "WhatsApp", EMAIL: "Email", TELEGRAM: "Telegram",
  FORM: "Formulario", API: "API", MANUAL: "Manual",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Abierto", RESOLVED: "Resuelto", PENDING: "Pendiente",
};

function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

interface Props {
  conversationId: string | null;
  onBack?: () => void;
  embedded?: boolean;
}

export function ConversationPanel({ conversationId, onBack, embedded }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  useConversationSocket(conversationId || '');

  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<{ file: File; url: string; type: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const id = conversationId || "";

  const { data: conv } = useQuery({
    queryKey: ["/api/conversations", id],
    queryFn: () => api.getConversation(id),
    enabled: !!id,
  });

  const { data: messages, isLoading: msgsLoading } = useQuery({
    queryKey: ["/api/conversations", id, "messages"],
    queryFn: () => api.getMessages(id),
    enabled: !!id,
  });

  const { data: members } = useQuery({
    queryKey: ["workspace-members"],
    queryFn: () => api.getMembers(),
    enabled: !!id,
  });

  const sendMut = useMutation({
    mutationFn: (data: Record<string, any>) => api.sendMessage(id, data),
    onSuccess: (response: any) => {
      qc.invalidateQueries({ queryKey: ["/api/conversations", id, "messages"] });
      qc.invalidateQueries({ queryKey: ["/api/conversations"] });
      setMessage("");
      setAttachment(null);
      if (response?.delivery_status === "dispatch_failed") {
        toast({
          title: "Mensaje guardado, envío falló",
          description: response.dispatch_error ?? "No se pudo enviar al canal externo.",
          variant: "destructive",
        });
      }
    },
    onError: (e) => toast({ title: "Error al enviar", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.deleteConversation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({ title: "Conversación eliminada" });
      if (onBack) onBack();
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resolveMut = useMutation({
    mutationFn: () => api.resolveConversation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/conversations", id] }),
  });

  const assignMut = useMutation({
    mutationFn: (userId: string) => api.assignConversation(id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/conversations", id] }),
  });

  const [showInvoice, setShowInvoice] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ number: "", currency: "USD", due_date: "", description: "" });
  const [lines, setLines] = useState<Array<{ product_id?: string; name: string; description: string; quantity: number; unit_price: number; tax_rate: number }>>([]);

  const { data: invoicesData } = useQuery({
    queryKey: ["conversation-invoices", id],
    queryFn: () => api.getInvoices({ conversation_id: id, limit: "10" }),
    enabled: !!id,
  });
  const invoiceList: Invoice[] = Array.isArray(invoicesData) ? invoicesData : invoicesData?.data || [];

  const lineSubtotals = lines.map(l => l.quantity * l.unit_price);
  const lineTaxes = lines.map((l, i) => lineSubtotals[i] * (l.tax_rate / 100));
  const totalAmount = lineSubtotals.reduce((s, v) => s + v, 0) + lineTaxes.reduce((s, v) => s + v, 0);

  const createInvMut = useMutation({
    mutationFn: () => api.createInvoice({
      contact_id: conversation?.contact?.id,
      conversation_id: id,
      number: invoiceForm.number,
      amount: totalAmount,
      currency: invoiceForm.currency,
      due_date: invoiceForm.due_date,
      description: invoiceForm.description,
      lines: lines.length > 0 ? lines.map((l, i) => ({
        line_number: i + 1,
        description: l.description || l.name,
        quantity: l.quantity,
        unit_price: l.unit_price,
        tax_rate: l.tax_rate > 0 ? l.tax_rate : undefined,
        product_id: l.product_id || undefined,
      })) : undefined,
      notes: [],
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation-invoices", id] });
      setShowInvoice(false);
      setLines([]);
      setInvoiceForm({ number: "", currency: "USD", due_date: "", description: "" });
      toast({ title: "Factura creada" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sendInvMut = useMutation({
    mutationFn: async (invoice: Invoice) => {
      const channelId = conversation?.channel?.id;
      if (!channelId) throw new Error("Canal no válido");
      const reminder = await api.generateInvoiceReminder(invoice.id);
      return api.sendInvoiceReminder(invoice.id, { channel_id: channelId, draft_text: reminder?.draft_text });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation-invoices", id] });
      qc.invalidateQueries({ queryKey: ["/api/conversations", id, "messages"] });
      toast({ title: "Factura enviada" });
    },
    onError: (e) => toast({ title: "Error al enviar", description: e.message, variant: "destructive" }),
  });

  const handleSend = useCallback(() => {
    if (sendMut.isPending || uploading) return;
    if (!message.trim() && !attachment) return;
    if (attachment) {
      sendMut.mutate({ body_text: message, direction: "OUTBOUND", media_url: attachment.url, media_type: attachment.type });
    } else {
      sendMut.mutate({ body_text: message, direction: "OUTBOUND" });
    }
  }, [message, attachment, sendMut, uploading]);

  const handleAttach = useCallback(async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    setUploading(true);
    try {
      const { url } = await api.uploadAttachment(form);
      const type = file.type.startsWith("image/") ? "image"
        : file.type.startsWith("video/") ? "video"
        : file.type.startsWith("audio/") ? "audio"
        : "document";
      setAttachment({ file, url, type });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "No se pudo subir el archivo", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [toast]);

  const msgList: Record<string, any>[] = Array.isArray(messages) ? messages : messages?.data || [];
  const memberList: Record<string, any>[] = Array.isArray(members) ? members : members?.data || [];
  const conversation = conv;
  const contact = conversation?.contact;
  const contactName = contact?.full_name || "Desconocido";
  const channelType = conversation?.channel?.type || "";
  const canSendInvoice = ["EMAIL", "WHATSAPP", "TELEGRAM"].includes(channelType.toUpperCase());

  const [nearBottom, setNearBottom] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setNearBottom(scrollHeight - scrollTop - clientHeight < 150);
  }, []);

  const scrollToBottom = useCallback(() => {
    setNearBottom(true);
    if (bottomRef.current) bottomRef.current.scrollIntoView({ block: "end", behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (msgsLoading || initialLoaded || !bottomRef.current) return;
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ block: "end", behavior: "instant" });
      setNearBottom(true);
      setInitialLoaded(true);
    }, 200);
    return () => clearTimeout(timer);
  }, [msgsLoading, msgList.length]);

  useEffect(() => {
    if (!initialLoaded) return;
    if (nearBottom && bottomRef.current) {
      bottomRef.current.scrollIntoView({ block: "end", behavior: "instant" });
    }
  }, [msgList.length, nearBottom, initialLoaded]);

  if (!id) return null;

  const channelLabel = CHANNEL_LABELS[channelType] || channelType;
  const statusLabel = conversation?.status ? STATUS_LABELS[conversation.status] ?? conversation.status : null;
  const assigneeName = (conversation as any)?.assigned_user?.name ?? null;
  const statusDotClass = conversation?.status === "OPEN"
    ? "bg-emerald-400"
    : conversation?.status === "PENDING"
      ? "bg-amber-400"
      : "bg-blue-400/50";

  const uiMessages: UiMessage[] = msgList.map(normalizeMessage);

  return (
    <div className="flex flex-col min-h-0 h-full max-h-dvh bg-background">
      <ConversationHeader
        contactName={contactName}
        contactAvatarInitials={getInitials(contactName)}
        channelType={channelType || undefined}
        statusLabel={statusLabel ?? undefined}
        assigneeName={assigneeName}
        statusDotClass={statusDotClass}
        onBack={onBack}
        onAssign={(userId) => assignMut.mutate(userId)}
        onResolve={() => resolveMut.mutate()}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["/api/conversations", id, "messages"] })}
        onInvoice={() => { setInvoiceForm({ number: "", currency: "USD", due_date: "", description: "" }); setLines([]); setShowInvoice(true); }}
        onDelete={() => setShowDelete(true)}
        members={memberList as Array<{ user?: { id: string; name?: string }; id: string; name?: string; email?: string }>}
        canResolve={conversation?.status !== "RESOLVED"}
        canSendInvoice={canSendInvoice}
      />

      <MessageTimeline
        messages={uiMessages}
        isLoading={msgsLoading}
        contactName={contactName}
        contactAvatarInitials={getInitials(contactName)}
        scrollRef={scrollRef}
        bottomRef={bottomRef}
        nearBottom={nearBottom}
        onScrollToBottom={scrollToBottom}
        onScroll={handleScroll}
      />

      <MessageComposer
        value={message}
        onChange={setMessage}
        onSend={handleSend}
        onAttach={handleAttach}
        onRemoveAttachment={() => setAttachment(null)}
        attachment={attachment}
        uploading={uploading}
        isPending={sendMut.isPending}
        channelLabel={channelLabel}
        disabled={!id}
      />

      <Dialog open={showInvoice} onOpenChange={setShowInvoice}>
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
                          {inv.lines!.map((l: InvoiceLine) => l.product?.name || l.description).join(", ")}
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

          {!conversation?.contact?.id ? (
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
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowInvoice(false)}>Cancelar</Button>
            {conversation?.contact?.id && (
              <Button size="sm" className="h-8 text-xs"
                onClick={() => createInvMut.mutate()}
                disabled={!invoiceForm.number.trim() || totalAmount <= 0 || !invoiceForm.due_date || createInvMut.isPending}>
                {createInvMut.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                Guardar factura
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">¿Eliminar conversación?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Esta acción no se puede deshacer. Se eliminarán la conversación y todos sus mensajes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="h-8 text-xs bg-destructive hover:bg-destructive/90"
              onClick={() => deleteMut.mutate()}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
