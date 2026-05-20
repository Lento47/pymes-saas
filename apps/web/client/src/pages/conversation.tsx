import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
import { ArrowLeft, Coins, ExternalLink, CheckCircle2, CheckCheck, Check, Loader2, Mail, MessageCircle, Globe, Phone, Plus, Receipt, RefreshCw, Send, Trash2, UserPlus, UserPlus2, FileText, Paperclip, Image, X, Smile, Play, Volume2, Upload, FileIcon, ChevronDown, AlertCircle } from "lucide-react";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { ImageLightbox } from "@/components/shared/image-lightbox";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { EmojiPicker } from "@/components/shared/emoji-picker";
import { useMediaBlobUrl } from "@/hooks/use-media-blob-url";

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function getChannelIcon(type?: string) {
  switch (type?.toUpperCase()) {
    case "WHATSAPP": return <MessageCircle className="w-3.5 h-3.5" />;
    case "TELEGRAM": return <Send className="w-3.5 h-3.5" />;
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

function MessageMediaContent({
  msg,
  onImageClick,
}: {
  msg: Record<string, any>;
  onImageClick: (url: string) => void;
}) {
  const { blobUrl, error: mediaError, loading: mediaLoading } = useMediaBlobUrl(msg.has_media ? msg.media_download_url : null);

  if (!msg.has_media) return null;

  if (msg.media_status === "processing" || msg.media_status === "pending") {
    return (
      <div className="flex items-center gap-2 text-xs mt-1.5 p-3 bg-black/10 dark:bg-white/10 rounded-xl animate-pulse">
        <Loader2 className="w-4 h-4 animate-spin shrink-0 text-[#8774e1]" />
        <span className="text-muted-foreground">Descargando media...</span>
      </div>
    );
  }

  if (mediaLoading) {
    return (
      <div className="flex items-center gap-2 text-xs mt-1.5 p-3 bg-black/10 dark:bg-white/10 rounded-xl animate-pulse">
        <Loader2 className="w-4 h-4 animate-spin shrink-0 text-[#8774e1]" />
        <span className="text-muted-foreground">Cargando media...</span>
      </div>
    );
  }

  if (mediaError || !blobUrl) {
    return (
      <div className="flex items-center gap-2 text-xs mt-1.5 p-3 bg-black/10 dark:bg-white/10 rounded-xl">
        <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
        <span className="text-muted-foreground">Error al cargar media</span>
      </div>
    );
  }

  if (msg.media_type === "image" || msg.media_mime_type?.startsWith("image/")) {
    return (
      <div className="mt-1.5 max-w-full">
        <div className="relative rounded-xl overflow-hidden bg-black/5 dark:bg-white/5" style={{ aspectRatio: "16/9", maxHeight: 280 }}>
          <img
            src={blobUrl}
            alt={msg.media_filename || "Imagen"}
            className="w-full h-full object-cover cursor-pointer transition-transform hover:scale-[1.02]"
            loading="lazy"
            onClick={() => onImageClick(blobUrl)}
          />
        </div>
        {msg.media_caption && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap mt-1.5 opacity-80">
            {msg.media_caption}
          </p>
        )}
      </div>
    );
  }

  if (msg.media_type === "video" || msg.media_mime_type?.startsWith("video/")) {
    return (
      <div className="mt-1.5 max-w-full">
        <div className="relative rounded-xl overflow-hidden bg-black/5 dark:bg-white/5" style={{ aspectRatio: "16/9", maxHeight: 280 }}>
          <video src={blobUrl} controls className="w-full h-full object-contain" preload="metadata">
            Tu navegador no soporta video.
          </video>
        </div>
        {msg.media_caption && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap mt-1.5 opacity-80">
            {msg.media_caption}
          </p>
        )}
      </div>
    );
  }

  if (msg.media_type === "audio" || msg.media_type === "voice" || msg.media_mime_type?.startsWith("audio/")) {
    return (
      <div className="mt-1.5 flex items-center gap-3 rounded-xl bg-black/5 dark:bg-white/5 px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-[#8774e1]/20 flex items-center justify-center">
          <Volume2 className="w-4 h-4 text-[#8774e1]" />
        </div>
        <audio src={blobUrl} controls className="flex-1 h-9" preload="none">
          Tu navegador no soporta audio.
        </audio>
      </div>
    );
  }

  return (
    <div className="mt-1.5">
      <a
        href={blobUrl}
        download={msg.media_filename || "archivo"}
        className="flex items-center gap-3 text-sm text-[#8774e1] hover:underline bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
      >
        <FileText className="w-5 h-5 shrink-0" />
        <span className="truncate flex-1">{msg.media_filename || "Archivo adjunto"}</span>
        <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-50" />
      </a>
      {msg.media_caption && (
        <p className="text-sm leading-relaxed whitespace-pre-wrap mt-1.5 opacity-80">
          {msg.media_caption}
        </p>
      )}
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFile?.type.startsWith("image/")) { setFilePreviewUrl(null); return; }
    const url = URL.createObjectURL(selectedFile);
    setFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const messageAnimStyles = useMemo(() => ({
    "--slide-in": "0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
  } as React.CSSProperties), []);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
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

  // ── Typing indicator ───────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const socket = (window as any).__socket;
    if (!socket) return;

    const handler = (payload: { userId: string; name: string }) => {
      if (payload.userId) {
        setTypingUsers((prev) => prev.includes(payload.name) ? prev : [...prev, payload.name]);
        // Auto-clear after 4 seconds
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((n) => n !== payload.name));
        }, 4000);
      }
    };
    const stopHandler = () => setTypingUsers([]);

    socket.on("conversation:typing", handler);
    socket.on("conversation:typing-stop", stopHandler);
    return () => {
      socket.off("conversation:typing", handler);
      socket.off("conversation:typing-stop", stopHandler);
    };
  }, [id]);

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
    mutationFn: (data: Record<string, any>) => api.sendMessage(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setMessage("");
    },
    onError: (err) => {
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
    onError: (err) => {
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
    onError: (err) => {
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
    onError: (err) => {
      toast({ title: "Error al crear contacto", description: err.message, variant: "destructive" });
    },
  });

  const updateLinkedContactMutation = useMutation({
    mutationFn: async () => {
      if (!conversation?.contact?.id) throw new Error("No hay contacto vinculado.");
      const fullName = [newContact.firstName, newContact.lastName].filter(Boolean).join(" ").trim();
      return api.updateContact(conversation.contact.id, {
        type: newContact.type,
        full_name: fullName || conversation.contact.full_name || conversation.subject || "Sin nombre",
        email: newContact.email.trim() || undefined,
        phone: newContact.phone.trim() || undefined,
        company_name: newContact.company.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setShowContactDialog(false);
      toast({ title: "Contacto actualizado" });
    },
    onError: (err) => {
      toast({ title: "Error al actualizar contacto", description: err.message, variant: "destructive" });
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: () =>
      api.createInvoice({
        contact_id: conversation?.contact?.id,
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
    onError: (err) => {
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
    onError: (err) => {
      toast({ title: "Error al registrar pago", description: err.message, variant: "destructive" });
    },
  });

  const sendInvoiceMutation = useMutation({
    mutationFn: async (invoice: Record<string, any>) => {
      const channelId = conversation?.channel?.id;
      if (!channelId) {
        throw new Error("Esta conversación no tiene un canal válido para enviar la factura.");
      }

      const reminder = await api.generateInvoiceReminder(invoice.id);
      return api.sendInvoiceReminder(invoice.id, {
        channel_id: channelId,
        draft_text: reminder?.draft_text,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", "conversation", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", id, "messages"] });
      toast({ title: "Factura enviada desde este chat" });
    },
    onError: (err) => {
      toast({ title: "Error al enviar factura", description: err.message, variant: "destructive" });
    },
  });

  const msgList = Array.isArray(messages) ? messages : messages?.data || [];
  const memberList = Array.isArray(members) ? members : members?.data || [];
  const contactList = Array.isArray(contactsData) ? contactsData : contactsData?.data || [];
  const invoiceList = Array.isArray(invoicesData) ? invoicesData : invoicesData?.data || [];
  const canSendInvoiceFromConversation = ["EMAIL", "WHATSAPP", "TELEGRAM"].includes(String(conversation?.channel?.type ?? "").toUpperCase());
  const contact = conversation?.contact;
  const assignedMember = memberList.find(
    (m: Record<string, any>) => (m.user?.id || m.userId || m.id) === (conversation?.assigned_user?.id || conversation?.assigned_to_id || conversation?.assigned_user_id)
  );

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    else messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const [isNearBottom, setIsNearBottom] = useState(true);
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 150;
    setIsNearBottom(el.scrollHeight - el.scrollTop - el.clientHeight < threshold);
  }, []);

  const prevLengthRef = useRef(0);
  useEffect(() => {
    if (msgList.length === 0) return;
    const isInitial = prevLengthRef.current === 0;
    if (isInitial || isNearBottom) {
      scrollToBottom(isInitial ? 'auto' : 'smooth');
    }
    prevLengthRef.current = msgList.length;
  }, [msgList.length, isNearBottom]);

  const handleSend = async () => {
    if (!message.trim() && !selectedFile) return;

    let mediaPayload: { media_url?: string; media_type?: string } = {};

    if (selectedFile) {
      try {
        setUploading(true);
        const form = new FormData();
        form.append('file', selectedFile);
        const { url } = await api.uploadAttachment(form);
        const mt = selectedFile.type.startsWith('image/') ? 'image'
          : selectedFile.type.startsWith('video/') ? 'video'
          : selectedFile.type.startsWith('audio/') ? 'audio'
          : 'document';
        mediaPayload = { media_url: url, media_type: mt };
      } catch {
        toast({ title: 'Error', description: 'No se pudo subir el archivo.', variant: 'destructive' });
        return;
      } finally {
        setUploading(false);
        setSelectedFile(null);
      }
    }

    sendMutation.mutate({ body_text: message, direction: "OUTBOUND", ...mediaPayload });
    setMessage('');
  };

  const openPaymentDialog = (invoice: Record<string, any>) => {
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
  const openContactDialog = () => {
    const fullName = String(contact?.full_name ?? "").trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    setSelectedContactId(contact?.id ?? "");
    setNewContact({
      firstName: parts[0] ?? "",
      lastName: parts.slice(1).join(" "),
      email: contact?.email ?? inferredEmail,
      phone: contact?.phone ?? inferredPhone,
      company: contact?.company_name ?? "",
      type: contact?.type ?? "CUSTOMER",
    });
    setShowContactDialog(true);
  };

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

          <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto pb-4 pr-1 relative">
            {msgsLoading ? (
              <div className="space-y-4 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={cn("flex gap-3", i % 2 === 0 ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "animate-pulse rounded-2xl",
                      i % 2 === 0 ? "bg-[#8774e1]/30 rounded-br-sm" : "bg-card border border-border/50 rounded-bl-sm",
                      "px-3.5 py-2.5",
                      i % 2 === 0 ? "w-3/5" : "w-2/4"
                    )}>
                      <div className={cn(
                        "h-3 rounded",
                        i % 2 === 0 ? "bg-white/20" : "bg-foreground/10"
                      )} style={{ width: `${70 + Math.random() * 30}%` }} />
                      <div className={cn(
                        "h-3 rounded mt-2",
                        i % 2 === 0 ? "bg-white/20" : "bg-foreground/10"
                      )} style={{ width: `${40 + Math.random() * 30}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : msgList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                <MessageCircle className="w-8 h-8 opacity-30" />
                <p className="text-xs">Sin mensajes aún</p>
              </div>
            ) : (
              msgList.map((msg: Record<string, any>, index: number) => {
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
                          "max-w-[72%] rounded-2xl px-3.5 py-2.5",
                          isOutbound
                            ? "bg-[#8774e1] text-white rounded-br-sm"
                            : "bg-card border border-border/50 text-foreground rounded-bl-sm"
                        )}
                      >
                        {isFirstInGroup && !isOutbound && (
                          <div className="text-[10px] font-medium text-[#8774e1] mb-1">
                            {contactName}
                          </div>
                        )}
                        {msg.body_text || msg.body_html || msg.content || msg.body ? (
                          <div className={cn("text-sm leading-relaxed whitespace-pre-wrap", isOutbound && "text-white/90")}>
                            <MarkdownRenderer
                              content={msg.body_text || msg.body_html || msg.content || msg.body}
                            />
                          </div>
                        ) : null}

                        {/* ── Media rendering ── */}
                        <MessageMediaContent msg={msg} onImageClick={setLightboxUrl} />
                        <div className={cn("flex items-center gap-1.5 mt-1", isOutbound ? "justify-end" : "justify-start")}>
                          <span className="text-[10px] text-muted-foreground/60">
                            {msgDate ? format(msgDate, "h:mm a") : ""}
                          </span>
                          {isOutbound && (
                            <span title={msg.read_at ? "Leído" : msg.delivered_at ? "Entregado" : "Enviado"}>
                              {msg.read_at ? (
                                <CheckCheck className="w-3.5 h-3.5 text-[#8774e1]" />
                              ) : msg.delivered_at ? (
                                <CheckCheck className="w-3.5 h-3.5 text-muted-foreground/60" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-muted-foreground/40" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {!isNearBottom && (
            <button
              onClick={() => scrollToBottom('smooth')}
              className="absolute bottom-24 right-6 z-10 w-9 h-9 rounded-full bg-primary shadow-lg flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-all animate-in fade-in slide-in-from-bottom-1"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}

          {/* ── Typing indicator ── */}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-muted-foreground">
              <div className="flex gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span>{typingUsers.join(", ")} escribiendo...</span>
            </div>
          )}

          <div className="border border-border rounded-xl bg-card overflow-hidden">
            {selectedFile && (
              <div className="flex items-center gap-2 px-4 pt-2.5 pb-1 border-b border-border bg-muted/30">
                {selectedFile.type.startsWith("image/") && filePreviewUrl ? (
                  <img
                    src={filePreviewUrl}
                    alt="preview"
                    className="w-10 h-10 rounded object-cover"
                  />
                ) : (
                  <FileText className="w-5 h-5 text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground flex-1 truncate">
                  {selectedFile.name}
                </span>
                <button
                  onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className="p-0.5 hover:bg-muted rounded"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            )}
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
              <div className="flex items-center gap-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Adjuntar archivo</TooltipContent>
                </Tooltip>
                <div className="relative">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => setEmojiPickerOpen(o => !o)}
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Emojis</TooltipContent>
                  </Tooltip>
                  <EmojiPicker
                    open={emojiPickerOpen}
                    onOpenChange={setEmojiPickerOpen}
                    onSelect={(emoji) => {
                      setMessage((prev) => prev + emoji);
                    }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground/50 ml-1">Shift+Enter para nueva línea</span>
              </div>
              <Button
                size="sm"
                className="h-7 px-3 gap-1.5 text-xs"
                onClick={handleSend}
                disabled={(!message.trim() && !selectedFile) || sendMutation.isPending || uploading}
                data-testid="button-send"
              >
                {(sendMutation.isPending || uploading)
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
                  onClick={openContactDialog}
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
                  onClick={openContactDialog}
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
                      <div className="mt-2 grid grid-cols-1 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] w-full"
                          onClick={() => openPaymentDialog(invoice)}
                        >
                          <Coins className="w-3 h-3 mr-1.5" />
                          Registrar pago
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] w-full"
                          onClick={() => sendInvoiceMutation.mutate(invoice)}
                          disabled={!canSendInvoiceFromConversation || sendInvoiceMutation.isPending}
                        >
                          {sendInvoiceMutation.isPending ? (
                            <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3 mr-1.5" />
                          )}
                          Enviar factura
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {contact && !canSendInvoiceFromConversation && invoiceList.length > 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                El envío directo de factura desde el inbox solo está disponible en conversaciones de Email o WhatsApp.
              </p>
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
                {contact ? "Editar contacto vinculado" : "Vincular contacto"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {contact && (
                <div className="rounded-md border border-border bg-background px-3 py-2">
                  <div className="text-xs text-muted-foreground">Contacto actual</div>
                  <div className="text-sm text-foreground">{contact.full_name}</div>
                </div>
              )}

              <div className="space-y-3">
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

              <div className="border-t border-border pt-4 space-y-3">
                <div className="text-xs text-muted-foreground">
                  {contact ? "O vincular otro contacto existente" : "O vincular un contacto existente"}
                </div>
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
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowContactDialog(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={createAndLinkContactMutation.isPending || updateLinkedContactMutation.isPending}
                onClick={() => {
                  if (contact) {
                    updateLinkedContactMutation.mutate();
                    return;
                  }
                  createAndLinkContactMutation.mutate();
                }}
              >
                {(createAndLinkContactMutation.isPending || updateLinkedContactMutation.isPending) && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {contact ? "Guardar cambios" : "Crear y vincular"}
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

      {/* ── Image Lightbox ── */}
      {lightboxUrl && (
        <ImageLightbox
          src={lightboxUrl}
          alt="Imagen"
          onClose={() => setLightboxUrl(null)}
        />
      )}
    </TooltipProvider>
  );
}
