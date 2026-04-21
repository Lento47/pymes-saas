import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge } from "@/components/shared/status-badge";
import { PriorityDot } from "@/components/shared/priority-dot";
import { PageLoader } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRoute, useLocation, Link } from "wouter";
import { useConversationSocket } from "@/hooks/use-conversation-socket";
import { ArrowLeft, Coins, ExternalLink, CheckCircle2, Loader2, Mail, MessageCircle, Globe, Phone, Plus, Receipt, RefreshCw, Send, Trash2, UserPlus, UserPlus2 } from "lucide-react";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function getChannelIcon(type?: string) {
  switch (type?.toUpperCase()) {
    case "WHATSAPP": return <MessageCircle className="w-3.5 h-3.5" />;
    case "EMAIL": return <Mail className="w-3.5 h-3.5" />;
    case "FORM": return <Globe className="w-3.5 h-3.5" />;
    default: return <Phone className="w-3.5 h-3.5" />;
  }
}

function formatMoney(amount: unknown, currency = "USD") {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function DateSeparator({ date }: { date: Date }) {
  const label = isToday(date) ? "Hoy" : isYesterday(date) ? "Ayer" : format(date, "d 'de' MMMM, yyyy");
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

export default function ConversationPage() {
  useRequireAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/inbox/:id");
  const id = params?.id || "";
  const [message, setMessage] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showCreateInvoiceDialog, setShowCreateInvoiceDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [newContact, setNewContact] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    type: "CUSTOMER",
  });
  const [invoiceForm, setInvoiceForm] = useState({
    number: "",
    amount: "",
    currency: "USD",
    due_date: "",
    description: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paid_at: "",
    method: "",
    reference: "",
    notes: "",
  });

  useConversationSocket(id);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { data: conversation, isLoading: convLoading } = useQuery({
    queryKey: ["/api/conversations", id],
    queryFn: () => api.getConversation(id),
    enabled: !!id,
  });

  const { data: messages, isLoading: msgsLoading, refetch: refetchMessages } = useQuery({
    queryKey: ["/api/conversations", id, "messages"],
    queryFn: () => api.getMessages(id),
    enabled: !!id,
    refetchInterval: 3000,
  });

  const { data: members } = useQuery({
    queryKey: ["/api/workspaces/current/members"],
    queryFn: () => api.getMembers(),
  });

  const { data: contactsData } = useQuery({
    queryKey: ["/api/contacts", "conversation-linker"],
    queryFn: () => api.getContacts({ limit: "100" }),
    enabled: showContactDialog,
  });

  const { data: invoicesData } = useQuery({
    queryKey: ["/api/invoices", "conversation", id],
    queryFn: () => api.getInvoices({ conversation_id: id, limit: "20" }),
    enabled: !!id,
  });

  const sendMutation = useMutation({
    mutationFn: (data: any) => api.sendMessage(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setMessage("");
    },
    onError: (err: any) => {
      toast({ title: "Error al enviar", description: err.message, variant: "destructive" });
    },
  });

  const assignMutation = useMutation({
    mutationFn: (userId: string) => api.assignConversation(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", id] });
      toast({ title: "Conversación asignada" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: () => api.resolveConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({ title: "Conversación resuelta" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({ title: "Conversación eliminada" });
      setLocation("/inbox");
    },
    onError: (err: any) => {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
    },
  });

  const linkContactMutation = useMutation({
    mutationFn: (contactId: string) => api.updateConversation(id, { contact_id: contactId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setShowContactDialog(false);
      setSelectedContactId("");
      toast({ title: "Contacto vinculado" });
    },
    onError: (err: any) => {
      toast({ title: "Error al vincular contacto", description: err.message, variant: "destructive" });
    },
  });

  const createAndLinkContactMutation = useMutation({
    mutationFn: async () => {
      const fullName = [newContact.firstName, newContact.lastName].filter(Boolean).join(" ").trim();
      const created = await api.createContact({
        type: newContact.type,
        full_name: fullName || conversation?.contact?.full_name || conversation?.subject || "Sin nombre",
        ...(newContact.email.trim() ? { email: newContact.email.trim() } : {}),
        ...(newContact.phone.trim() ? { phone: newContact.phone.trim() } : {}),
        ...(newContact.company.trim() ? { company_name: newContact.company.trim() } : {}),
      });
      await api.updateConversation(id, { contact_id: created.id });
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setShowContactDialog(false);
      setSelectedContactId("");
      setNewContact({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        company: "",
        type: "CUSTOMER",
      });
      toast({ title: "Contacto creado y vinculado" });
    },
    onError: (err: any) => {
      toast({ title: "Error al crear contacto", description: err.message, variant: "destructive" });
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: () =>
      api.createInvoice({
        contact_id: conversation.contact.id,
        conversation_id: id,
        number: invoiceForm.number,
        amount: Number(invoiceForm.amount),
        currency: invoiceForm.currency,
        due_date: invoiceForm.due_date,
        description: invoiceForm.description,
        notes: [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", "conversation", id] });
      setShowCreateInvoiceDialog(false);
      setInvoiceForm({
        number: "",
        amount: "",
        currency: "USD",
        due_date: "",
        description: "",
      });
      toast({ title: "Factura creada y guardada" });
    },
    onError: (err: any) => {
      toast({ title: "Error al crear factura", description: err.message, variant: "destructive" });
    },
  });

  const registerPaymentMutation = useMutation({
    mutationFn: () =>
      api.registerInvoicePayment(selectedInvoice.id, {
        amount: Number(paymentForm.amount),
        paid_at: paymentForm.paid_at || undefined,
        method: paymentForm.method || undefined,
        reference: paymentForm.reference || undefined,
        notes: paymentForm.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", "conversation", id] });
      setShowPaymentDialog(false);
      setSelectedInvoice(null);
      setPaymentForm({
        amount: "",
        paid_at: "",
        method: "",
        reference: "",
        notes: "",
      });
      toast({ title: "Pago registrado" });
    },
    onError: (err: any) => {
      toast({ title: "Error al registrar pago", description: err.message, variant: "destructive" });
    },
  });

  const msgList = Array.isArray(messages) ? messages : messages?.data || [];
  const memberList = Array.isArray(members) ? members : members?.data || [];
  const contactList = Array.isArray(contactsData) ? contactsData : contactsData?.data || [];
  const invoiceList = Array.isArray(invoicesData) ? invoicesData : invoicesData?.data || [];
  const contact = conversation?.contact;
  const assignedMember = memberList.find(
    (m: any) => (m.user?.id || m.userId || m.id) === (conversation?.assigned_user?.id || conversation?.assigned_to_id || conversation?.assigned_user_id)
  );

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    else messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const prevLengthRef = useRef(0);
  useEffect(() => {
    if (msgList.length === 0) return;
    const isInitial = prevLengthRef.current === 0;
    scrollToBottom(isInitial ? "auto" : "smooth");
    prevLengthRef.current = msgList.length;
  }, [msgList.length]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate({ body_text: message, direction: "OUTBOUND" });
  };

  const openPaymentDialog = (invoice: any) => {
    setSelectedInvoice(invoice);
    setPaymentForm({
      amount: String(Number(invoice.balance_due ?? 0).toFixed(2)),
      paid_at: new Date().toISOString().slice(0, 10),
      method: "",
      reference: "",
      notes: "",
    });
    setShowPaymentDialog(true);
  };

  if (convLoading) return <PageLoader />;
  if (!conversation) return <div className="text-center text-muted-foreground py-12">Conversación no encontrada</div>;

  const contactName = contact
    ? (contact.name || `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || contact.email || "?")
    : "Desconocido";
  const inferredEmail = contact?.email || (msgList.find((msg: any) => typeof msg.sender_ref === "string" && msg.sender_ref.includes("@"))?.sender_ref ?? "");
  const inferredPhone = contact?.phone || (msgList.find((msg: any) => typeof msg.sender_ref === "string" && !msg.sender_ref.includes("@"))?.sender_ref ?? "");

  return (
    <TooltipProvider>
      <div className="flex gap-4 h-[calc(100vh-80px)]">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-3 pb-3 border-b border-border mb-3">
            <Link href="/inbox">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>

            {conversation.channel?.type && (
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-muted text-muted-foreground shrink-0">
                {getChannelIcon(conversation.channel.type)}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-foreground truncate">
                  {conversation.subject || "Sin asunto"}
                </h2>
                <StatusBadge status={conversation.status} type="conversation" />
                <PriorityDot priority={conversation.priority} showLabel />
              </div>
              {assignedMember && (
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Asignado a{" "}
                  {assignedMember.user?.name || assignedMember.name || assignedMember.email}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Tooltip>
                <Select onValueChange={(val) => assignMutation.mutate(val)}>
                  <TooltipTrigger asChild>
                    <SelectTrigger className="h-8 w-8 p-0 border-0 bg-transparent" data-testid="button-assign">
                      <UserPlus className="w-4 h-4 text-muted-foreground" />
                    </SelectTrigger>
                  </TooltipTrigger>
                  <SelectContent>
                    {memberList.map((m: any) => (
                      <SelectItem key={m.user?.id || m.userId || m.id} value={m.user?.id || m.userId || m.id}>
                        {m.user?.name || m.name || m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <TooltipContent>Asignar agente</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => resolveMutation.mutate()}
                    disabled={conversation.status === "RESOLVED" || resolveMutation.isPending}
                    data-testid="button-resolve"
                  >
                    {resolveMutation.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Marcar como resuelta</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => refetchMessages()}
                    data-testid="button-refresh"
                  >
                    <RefreshCw className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Actualizar mensajes</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setShowDelete(true)}
                    data-testid="button-delete-conv"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Eliminar conversación</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pb-4 pr-1">
            {msgsLoading ? (
              <PageLoader />
            ) : msgList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                <MessageCircle className="w-8 h-8 opacity-30" />
                <p className="text-xs">Sin mensajes aún</p>
              </div>
            ) : (
              msgList.map((msg: any, index: number) => {
                const isOutbound = msg.direction === "OUTBOUND";
                const msgDate = msg.createdAt || msg.created_at
                  ? new Date(msg.createdAt || msg.created_at)
                  : null;
                const prevMsg = index > 0 ? msgList[index - 1] : null;
                const prevDate = prevMsg?.createdAt || prevMsg?.created_at
                  ? new Date(prevMsg.createdAt || prevMsg.created_at)
                  : null;
                const showDateSep = msgDate && (!prevDate || !isSameDay(msgDate, prevDate));
                const prevIsOutbound = prevMsg?.direction === "OUTBOUND";
                const isFirstInGroup = !prevMsg || prevIsOutbound !== isOutbound;

                return (
                  <div key={msg.id}>
                    {showDateSep && msgDate && <DateSeparator date={msgDate} />}
                    <div
                      className={cn(
                        "flex gap-2 mb-0.5",
                        isOutbound ? "justify-end" : "justify-start",
                        isFirstInGroup && index > 0 && "mt-3"
                      )}
                      data-testid={`message-${msg.id}`}
                    >
                      {!isOutbound && (
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-semibold text-muted-foreground shrink-0 mt-auto",
                            !isFirstInGroup && "invisible"
                          )}
                        >
                          {getInitials(contactName)}
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[68%] rounded-2xl px-3.5 py-2",
                          isOutbound
                            ? "bg-primary/20 text-foreground rounded-tr-sm"
                            : "bg-muted text-foreground rounded-tl-sm"
                        )}
                      >
                        {isFirstInGroup && !isOutbound && (
                          <div className="text-[10px] font-medium text-muted-foreground mb-1">
                            {contactName}
                          </div>
                        )}
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.body_text || msg.body_html || msg.content || msg.body}
                        </p>
                        <div className={cn("text-[10px] text-muted-foreground mt-1", isOutbound ? "text-right" : "text-left")}>
                          {msgDate ? format(msgDate, "h:mm a") : ""}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border border-border rounded-xl bg-card overflow-hidden">
            <Textarea
              placeholder="Escribe un mensaje..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="min-h-[72px] max-h-[160px] text-sm bg-transparent border-0 focus-visible:ring-0 resize-none rounded-none px-4 pt-3"
              data-testid="input-message"
            />
            <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
              <span className="text-[10px] text-muted-foreground/50">Shift+Enter para nueva línea</span>
              <Button
                size="sm"
                className="h-7 px-3 gap-1.5 text-xs"
                onClick={handleSend}
                disabled={!message.trim() || sendMutation.isPending}
                data-testid="button-send"
              >
                {sendMutation.isPending
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Send className="w-3 h-3" />}
                Enviar
              </Button>
            </div>
          </div>
        </div>

        <div className="w-[280px] shrink-0 flex flex-col gap-3 overflow-y-auto" data-testid="contact-info-panel">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Contacto</h3>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSelectedContactId(contact?.id ?? "");
                    setNewContact((prev) => ({
                      ...prev,
                      email: prev.email || inferredEmail,
                      phone: prev.phone || inferredPhone,
                    }));
                    setShowContactDialog(true);
                  }}
                  data-testid="button-link-contact"
                >
                  <UserPlus2 className="w-3 h-3" />
                </Button>
                {contact && (
                  <Link href={`/contacts/${contact.id}`}>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground">
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            {contact ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                    {getInitials(contactName)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground leading-tight">{contactName}</div>
                    {contact.company && (
                      <div className="text-[11px] text-muted-foreground truncate">{contact.company}</div>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {contact.email && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="w-3 h-3 shrink-0" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3 shrink-0" />
                      <span>{contact.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Sin contacto vinculado</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    setSelectedContactId("");
                    setNewContact((prev) => ({
                      ...prev,
                      email: inferredEmail,
                      phone: inferredPhone,
                    }));
                    setShowContactDialog(true);
                  }}
                >
                  <UserPlus2 className="w-3 h-3 mr-1.5" />
                  Vincular o crear contacto
                </Button>
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Facturación</h3>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCreateInvoiceDialog(true)}
                  disabled={!contact}
                >
                  <Plus className="w-3 h-3" />
                </Button>
                <Link href="/invoices">
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground">
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </div>
            {!contact ? (
              <p className="text-[11px] text-muted-foreground">Vincula primero un contacto para crear facturas desde este chat.</p>
            ) : invoiceList.length === 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">Todavía no hay facturas ligadas a esta conversación.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => setShowCreateInvoiceDialog(true)}
                >
                  <Receipt className="w-3 h-3 mr-1.5" />
                  Crear factura
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {invoiceList.map((invoice: any) => (
                  <div key={invoice.id} className="rounded-lg border border-border bg-background px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">{invoice.number}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {formatMoney(invoice.amount, invoice.currency)} total
                        </div>
                      </div>
                      <StatusBadge status={invoice.status} type="invoice" className="text-[10px]" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]">
                      <div>
                        <div className="text-muted-foreground">Pagado</div>
                        <div className="text-foreground">{formatMoney(invoice.amount_paid, invoice.currency)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Saldo</div>
                        <div className="text-foreground">{formatMoney(invoice.balance_due, invoice.currency)}</div>
                      </div>
                    </div>
                    {Number(invoice.balance_due ?? 0) > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 mt-2 text-[11px] w-full"
                        onClick={() => openPaymentDialog(invoice)}
                      >
                        <Coins className="w-3 h-3 mr-1.5" />
                        Registrar pago
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Detalles</h3>
            <div className="space-y-2">
              {conversation.channel?.type && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Canal</span>
                  <div className="flex items-center gap-1 text-[11px] text-foreground">
                    {getChannelIcon(conversation.channel.type)}
                    <span>{conversation.channel.name || conversation.channel.type}</span>
                  </div>
                </div>
              )}
              {conversation.createdAt && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Creada</span>
                  <span className="text-[11px] text-foreground">
                    {format(new Date(conversation.createdAt), "dd MMM, yyyy")}
                  </span>
                </div>
              )}
              {assignedMember && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Asignada a</span>
                  <span className="text-[11px] text-foreground truncate max-w-[140px]">
                    {assignedMember.user?.name || assignedMember.name || assignedMember.email}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tareas</h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground">
                    <Plus className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Nueva tarea</TooltipContent>
              </Tooltip>
            </div>
            {conversation.tasks && conversation.tasks.length > 0 ? (
              <div className="space-y-2">
                {conversation.tasks.map((task: any) => (
                  <div key={task.id} className="flex items-center gap-2">
                    <StatusBadge status={task.status} type="task" className="text-[9px]" />
                    <span className="text-xs text-foreground truncate">{task.title}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">Sin tareas vinculadas</p>
            )}
          </div>
        </div>

        <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-sm">¿Eliminar conversación?</AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground">
                Esta acción no se puede deshacer. Se eliminarán permanentemente la conversación y todos sus mensajes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="h-8 text-xs">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate()}
                className="h-8 text-xs bg-destructive hover:bg-destructive/90"
              >
                {deleteMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
          <DialogContent className="bg-card border-border sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle className="text-sm">
                {contact ? "Cambiar contacto vinculado" : "Vincular contacto"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Contacto existente</Label>
                <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                  <SelectTrigger className="h-9 text-xs bg-background border-border">
                    <SelectValue placeholder="Seleccioná un contacto existente" />
                  </SelectTrigger>
                  <SelectContent>
                    {contactList.map((existing: any) => (
                      <SelectItem key={existing.id} value={existing.id}>
                        {existing.full_name}
                        {existing.email ? ` · ${existing.email}` : existing.phone ? ` · ${existing.phone}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={!selectedContactId || linkContactMutation.isPending}
                  onClick={() => linkContactMutation.mutate(selectedContactId)}
                >
                  {linkContactMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  Vincular contacto existente
                </Button>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <div className="text-xs text-muted-foreground">O crear un contacto nuevo</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nombre</Label>
                    <Input
                      value={newContact.firstName}
                      onChange={(e) => setNewContact({ ...newContact, firstName: e.target.value })}
                      className="h-8 text-xs bg-background border-border"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Apellido</Label>
                    <Input
                      value={newContact.lastName}
                      onChange={(e) => setNewContact({ ...newContact, lastName: e.target.value })}
                      className="h-8 text-xs bg-background border-border"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input
                    type="email"
                    value={newContact.email}
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    className="h-8 text-xs bg-background border-border"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Teléfono</Label>
                  <Input
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    className="h-8 text-xs bg-background border-border"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Empresa</Label>
                  <Input
                    value={newContact.company}
                    onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                    className="h-8 text-xs bg-background border-border"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tipo</Label>
                  <Select value={newContact.type} onValueChange={(value) => setNewContact({ ...newContact, type: value })}>
                    <SelectTrigger className="h-8 text-xs bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["CUSTOMER", "VENDOR", "LEAD", "OTHER"].map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowContactDialog(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={createAndLinkContactMutation.isPending}
                onClick={() => createAndLinkContactMutation.mutate()}
              >
                {createAndLinkContactMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Crear y vincular
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showCreateInvoiceDialog} onOpenChange={setShowCreateInvoiceDialog}>
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
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowCreateInvoiceDialog(false)}>
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

        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="bg-card border-border sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-sm">Registrar pago</DialogTitle>
            </DialogHeader>
            {!selectedInvoice ? null : (
              <div className="space-y-3">
                <div className="rounded-md border border-border bg-background px-3 py-2 space-y-1">
                  <div className="text-xs text-muted-foreground">
                    {selectedInvoice.number} · {selectedInvoice.contact?.full_name}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <div className="text-muted-foreground">Total</div>
                      <div className="text-foreground">{formatMoney(selectedInvoice.amount, selectedInvoice.currency)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Pagado</div>
                      <div className="text-foreground">{formatMoney(selectedInvoice.amount_paid, selectedInvoice.currency)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Saldo</div>
                      <div className="text-foreground">{formatMoney(selectedInvoice.balance_due, selectedInvoice.currency)}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Monto abonado</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                      className="h-8 text-xs bg-background border-border"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Fecha de pago</Label>
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
                    <Label className="text-xs text-muted-foreground">Método</Label>
                    <Input
                      value={paymentForm.method}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, method: e.target.value }))}
                      className="h-8 text-xs bg-background border-border"
                      placeholder="Pago móvil, transferencia..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Referencia</Label>
                    <Input
                      value={paymentForm.reference}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, reference: e.target.value }))}
                      className="h-8 text-xs bg-background border-border"
                      placeholder="Comprobante"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Notas</Label>
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
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowPaymentDialog(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => registerPaymentMutation.mutate()}
                disabled={!selectedInvoice || !paymentForm.amount || registerPaymentMutation.isPending}
              >
                {registerPaymentMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Coins className="w-3.5 h-3.5 mr-1.5" />}
                Guardar pago
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
