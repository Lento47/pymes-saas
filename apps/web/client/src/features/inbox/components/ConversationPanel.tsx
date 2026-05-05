import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft, Send, Loader2, MessageCircle, CheckCircle2, RefreshCw,
  Trash2, UserPlus, Info, Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";
import { PriorityDot } from "@/components/shared/priority-dot";

function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

const CHANNEL_ICONS: Record<string, any> = {
  WHATSAPP: MessageCircle, EMAIL: Info, TELEGRAM: Send, FORM: Info, API: Info, MANUAL: Info,
};

function DateSeparator({ date }: { date: Date }) {
  return (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 h-px bg-border/60" />
      <span className="text-[10px] text-muted-foreground/50 shrink-0">
        {format(date, "d MMM yyyy", { locale: es })}
      </span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
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
  const [message, setMessage] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const id = conversationId || "";

  const { data: conv } = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => api.getConversation(id),
    enabled: !!id,
  });

  const { data: messages, isLoading: msgsLoading } = useQuery({
    queryKey: ["conversation-messages", id],
    queryFn: () => api.getMessages(id),
    enabled: !!id,
  });

  const { data: members } = useQuery({
    queryKey: ["workspace-members"],
    queryFn: () => api.getMembers(),
    enabled: !!id,
  });

  const sendMut = useMutation({
    mutationFn: (data: any) => api.sendMessage(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation-messages", id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setMessage("");
    },
    onError: (e: any) => toast({ title: "Error al enviar", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.deleteConversation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast({ title: "Conversación eliminada" });
      if (onBack) onBack();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resolveMut = useMutation({
    mutationFn: () => api.resolveConversation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversation", id] }),
  });

  const assignMut = useMutation({
    mutationFn: (userId: string) => api.assignConversation(id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversation", id] }),
  });

  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ number: "", amount: "", currency: "USD", due_date: "", description: "", subtotal: "", tax_rate: "13", tax_amount: "" });

  const taxRate = Number(invoiceForm.tax_rate) || 0;
  const subtotalNum = Number(invoiceForm.subtotal) || Number(invoiceForm.amount) || 0;
  const autoTax = taxRate > 0 ? (subtotalNum * taxRate / 100).toFixed(2) : "0.00";
  const autoTotal = taxRate > 0 ? (subtotalNum + Number(autoTax)).toFixed(2) : subtotalNum.toFixed(2);

  const { data: invoicesData } = useQuery({
    queryKey: ["conversation-invoices", id],
    queryFn: () => api.getInvoices({ conversation_id: id, limit: "10" }),
    enabled: !!id,
  });
  const invoiceList: any[] = Array.isArray(invoicesData) ? invoicesData : invoicesData?.data || [];

  const createInvMut = useMutation({
    mutationFn: () => api.createInvoice({
      contact_id: conversation?.contact?.id,
      conversation_id: id,
      number: invoiceForm.number,
      amount: Number(taxRate > 0 ? autoTotal : (invoiceForm.amount || "0")),
      currency: invoiceForm.currency,
      due_date: invoiceForm.due_date,
      description: invoiceForm.description,
      subtotal: taxRate > 0 ? subtotalNum : undefined,
      tax_rate: taxRate > 0 ? taxRate : undefined,
      tax_amount: taxRate > 0 ? Number(autoTax) : undefined,
      notes: [],
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation-invoices", id] });
      setShowInvoice(false);
      setInvoiceForm({ number: "", amount: "", currency: "USD", due_date: "", description: "", subtotal: "", tax_rate: "13", tax_amount: "" });
      toast({ title: "Factura creada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sendInvMut = useMutation({
    mutationFn: async (invoice: any) => {
      const channelId = conversation?.channel?.id;
      if (!channelId) throw new Error("Canal no válido");
      const reminder = await api.generateInvoiceReminder(invoice.id);
      return api.sendInvoiceReminder(invoice.id, { channel_id: channelId, draft_text: reminder?.draft_text });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation-invoices", id] });
      qc.invalidateQueries({ queryKey: ["conversation-messages", id] });
      toast({ title: "Factura enviada" });
    },
    onError: (e: any) => toast({ title: "Error al enviar", description: e.message, variant: "destructive" }),
  });

  const canSendInvoice = ["EMAIL", "WHATSAPP"].includes(channelType.toUpperCase());

  const handleSend = () => {
    if (!message.trim()) return;
    sendMut.mutate({ body_text: message, direction: "OUTBOUND" });
  };

  const msgList: any[] = Array.isArray(messages) ? messages : messages?.data || [];
  const memberList: any[] = Array.isArray(members) ? members : members?.data || [];
  const conversation = conv;
  const contact = conversation?.contact;
  const contactName = contact?.full_name || "Desconocido";
  const channelType = conversation?.channel?.type || "";

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "auto" });
  }, [msgList.length]);

  if (!id) return null;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header toolbar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 shrink-0">
        {onBack && (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
          {getInitials(contactName)}
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-[13px] font-medium text-foreground truncate">{contactName}</span>
          {conversation?.status && <StatusBadge status={conversation.status} type="conversation" />}
        </div>
        <div className="flex items-center gap-0.5">
          <Select onValueChange={(v) => assignMut.mutate(v)}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SelectTrigger className="h-7 w-7 p-0 border-0 bg-transparent">
                    <UserPlus className="w-3.5 h-3.5 text-muted-foreground" />
                  </SelectTrigger>
                </TooltipTrigger>
                <TooltipContent>Asignar</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <SelectContent>
              {memberList.map((m: any) => (
                <SelectItem key={m.user?.id || m.id} value={m.user?.id || m.id}>
                  {m.user?.name || m.name || m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                  onClick={() => resolveMut.mutate()}
                  disabled={conversation?.status === "RESOLVED"}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Resolver</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                  onClick={() => qc.invalidateQueries({ queryKey: ["conversation-messages", id] })}>
                  <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refrescar</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                  onClick={() => { setInvoiceForm({ number: "", amount: "", currency: "USD", due_date: "", description: "" }); setShowInvoice(true); }}
                  title="Factura">
                  <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Factura</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => setShowDelete(true)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Eliminar</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
        {msgsLoading ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : msgList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <MessageCircle className="w-8 h-8 opacity-20" />
            <p className="text-xs">Sin mensajes</p>
          </div>
        ) : (
          msgList.map((msg: any, idx: number) => {
            const isOutbound = msg.direction === "OUTBOUND";
            const msgDate = msg.createdAt || msg.created_at ? new Date(msg.createdAt || msg.created_at) : null;
            const prevMsg = idx > 0 ? msgList[idx - 1] : null;
            const prevDate = prevMsg?.createdAt || prevMsg?.created_at ? new Date(prevMsg.createdAt || prevMsg.created_at) : null;
            const showSep = msgDate && (!prevDate || !isSameDay(msgDate, prevDate));
            const prevOutbound = prevMsg?.direction === "OUTBOUND";
            const isFirst = !prevMsg || prevOutbound !== isOutbound;

            return (
              <div key={msg.id}>
                {showSep && msgDate && <DateSeparator date={msgDate} />}
                <div className={cn("flex gap-2 mb-0.5", isOutbound ? "justify-end" : "justify-start", isFirst && idx > 0 && "mt-3")}>
                  {!isOutbound && (
                    <div className={cn("w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-semibold text-muted-foreground shrink-0 mt-auto", !isFirst && "invisible")}>
                      {getInitials(contactName)}
                    </div>
                  )}
                  <div className={cn("max-w-[68%] rounded-2xl px-3.5 py-2", isOutbound ? "bg-primary/20 rounded-tr-sm" : "bg-muted rounded-tl-sm")}>
                    {isFirst && !isOutbound && <div className="text-[10px] font-medium text-muted-foreground mb-1">{contactName}</div>}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{msg.body_text || msg.body_html || msg.content || ""}</p>
                    <div className={cn("text-[10px] text-muted-foreground mt-1", isOutbound ? "text-right" : "text-left")}>
                      {msgDate ? format(msgDate, "h:mm a") : ""}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Message input */}
      <div className="border-t border-border p-3 shrink-0">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-end gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Escribe un mensaje..."
            className="min-h-[40px] max-h-[120px] text-sm bg-background border-border resize-none"
            rows={1}
          />
          <Button type="submit" size="sm" className="h-9 shrink-0" disabled={!message.trim() || sendMut.isPending}>
            {sendMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground/50 mt-1 ml-1">Enter para enviar · Shift+Enter para nueva línea</p>
      </div>

      {/* Invoice dialog */}
      <Dialog open={showInvoice} onOpenChange={setShowInvoice}>
        <DialogContent className="bg-card border-border sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-sm">Facturación</DialogTitle>
          </DialogHeader>

          {invoiceList.length > 0 && (
            <div className="space-y-2">
              {invoiceList.map((inv: any) => (
                <div key={inv.id} className="rounded-lg border border-border bg-background px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium">{inv.number}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Intl.NumberFormat("es-CR", { style: "currency", currency: inv.currency, maximumFractionDigits: 0 }).format(inv.amount || 0)} · <StatusBadge status={inv.status} type="invoice" className="inline" />
                      </div>
                    </div>
                    {Number(inv.balance_due ?? 0) > 0 && canSendInvoice && (
                      <Button size="sm" className="h-7 text-[11px] gap-1" onClick={() => sendInvMut.mutate(inv)} disabled={sendInvMut.isPending}>
                        {sendInvMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Enviar
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px]">Subtotal</Label>
                  <Input type="number" step="0.01" value={invoiceForm.subtotal} onChange={e => setInvoiceForm(p => ({ ...p, subtotal: e.target.value }))} className="h-7 text-xs bg-background border-border" placeholder={invoiceForm.amount || "0"} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">IVA %</Label>
                  <Input type="number" step="0.01" value={invoiceForm.tax_rate} onChange={e => setInvoiceForm(p => ({ ...p, tax_rate: e.target.value }))} className="h-7 text-xs bg-background border-border" placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px]">Impuesto</Label>
                  <Input value={autoTax} disabled className="h-7 text-xs bg-muted border-border" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Total</Label>
                  <Input value={autoTotal} disabled className="h-7 text-xs bg-muted border-border font-medium" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px]">Vencimiento</Label>
                  <Input type="date" value={invoiceForm.due_date} onChange={e => setInvoiceForm(p => ({ ...p, due_date: e.target.value }))} className="h-7 text-xs bg-background border-border" />
                </div>
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
                disabled={!invoiceForm.number.trim() || (!Number(autoTotal) && !Number(invoiceForm.amount)) || !invoiceForm.due_date || createInvMut.isPending}>
                {createInvMut.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                Guardar factura
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
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
