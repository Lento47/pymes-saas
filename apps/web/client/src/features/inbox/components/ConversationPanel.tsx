import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useConversationSocket } from "@/hooks/use-conversation-socket";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft, Send, Loader2, MessageCircle, CheckCircle2, RefreshCw,
  Trash2, UserPlus, Info, Receipt, Plus, X, Paperclip,
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
import { useMediaBlobUrl } from "@/hooks/use-media-blob-url";
import { StatusBadge } from "@/components/shared/status-badge";
import { PriorityDot } from "@/components/shared/priority-dot";
import { ProductPicker } from "@/components/inventory/ProductPicker";

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
      <span className="text-[10px] text-muted-foreground/80 shrink-0">
        {format(date, "d MMM yyyy", { locale: es })}
      </span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}

function MediaRenderer({ messageId, mediaType, caption }: {
  messageId: string;
  mediaType: "image" | "video" | "audio" | "document";
  caption?: string;
}) {
  const blobUrl = useMediaBlobUrl(`/api/conversations/messages/${messageId}/media`);

  if (!blobUrl) {
    const label = mediaType === "image" ? "imagen"
      : mediaType === "video" ? "video"
      : mediaType === "audio" ? "audio"
      : "documento";
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-3">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-[11px]">Cargando {label}...</span>
      </div>
    );
  }

  if (mediaType === "image" || mediaType === "video") {
    return (
      <div>
        {mediaType === "video" ? (
          <video controls src={blobUrl} className="rounded-lg max-w-full max-h-64" />
        ) : (
          <img src={blobUrl} alt={caption || "Imagen"} className="rounded-lg max-w-full max-h-64 object-contain" />
        )}
        {caption && <p className="text-[11px] text-muted-foreground/80 mt-1.5">{caption}</p>}
        <a href={blobUrl} download={caption || mediaType}
          className="inline-block mt-1 text-[11px] text-blue-400 hover:text-blue-300 underline underline-offset-2">
          Descargar
        </a>
      </div>
    );
  }

  if (mediaType === "audio") {
    return (
      <div className="space-y-1">
        {caption && <p className="text-[12px] font-medium text-foreground">{caption}</p>}
        <audio controls src={blobUrl} className="h-8 w-full max-w-[240px]" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-lg">📄</span>
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-foreground truncate">{caption || "Documento"}</p>
        <a href={blobUrl} download={caption || "documento"}
          className="text-[11px] text-blue-400 hover:text-blue-300 underline underline-offset-2">
          Descargar
        </a>
      </div>
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/conversations", id, "messages"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setMessage("");
    },
    onError: (e) => toast({ title: "Error al enviar", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.deleteConversation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
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

  const handleSend = () => {
    if (!message.trim() && !attachment) return;
    if (attachment) {
      sendMut.mutate({ body_text: message, direction: "OUTBOUND", media_url: attachment.url, media_type: attachment.type });
    } else {
      sendMut.mutate({ body_text: message, direction: "OUTBOUND" });
    }
    setAttachment(null);
    setMessage("");
  };

  const msgList: Record<string, any>[] = Array.isArray(messages) ? messages : messages?.data || [];
  const memberList: Record<string, any>[] = Array.isArray(members) ? members : members?.data || [];
  const conversation = conv;
  const contact = conversation?.contact;
  const contactName = contact?.full_name || "Desconocido";
  const channelType = conversation?.channel?.type || "";
  const canSendInvoice = ["EMAIL", "WHATSAPP", "TELEGRAM"].includes(channelType.toUpperCase());

  const [nearBottom, setNearBottom] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setNearBottom(scrollHeight - scrollTop - clientHeight < 150);
  };

  // Scroll to bottom on initial load (after DOM renders)
  useEffect(() => {
    if (msgsLoading || initialLoaded || !bottomRef.current) return;
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ block: "end", behavior: "instant" });
      setNearBottom(true);
      setInitialLoaded(true);
    }, 200);
    return () => clearTimeout(timer);
  }, [msgsLoading, msgList.length]);

  // Keep scrolled to bottom on new messages
  useEffect(() => {
    if (!initialLoaded) return;
    if (nearBottom && bottomRef.current) {
      bottomRef.current.scrollIntoView({ block: "end", behavior: "instant" });
    }
  }, [msgList.length, nearBottom, initialLoaded]);

  if (!id) return null;

  return (
    <div className="flex flex-col min-h-0 h-full max-h-dvh bg-background">
      {/* Header toolbar */}
      <div className="flex items-center gap-2 border-b border-border px-3 sm:px-4 py-2 shrink-0">
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
              {memberList.map((m) => (
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
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hidden sm:inline-flex"
                  onClick={() => qc.invalidateQueries({ queryKey: ["/api/conversations", id, "messages"] })}>
                  <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refrescar</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hidden sm:inline-flex"
                  onClick={() => { setInvoiceForm({ number: "", currency: "USD", due_date: "", description: "" }); setLines([]); setShowInvoice(true); }}
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 min-h-0" onScroll={handleScroll}>
        {!nearBottom && msgList.length > 0 && (
          <div className="sticky bottom-2 flex justify-center z-10 mb-2">
            <button
              onClick={() => {
                setNearBottom(true);
                if (bottomRef.current) bottomRef.current.scrollIntoView({ block: "end", behavior: "smooth" });
              }}
              className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-medium shadow-lg hover:opacity-90 transition-opacity"
            >
              ↓ Nuevos mensajes
            </button>
          </div>
        )}
        {msgsLoading ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : msgList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <MessageCircle className="w-8 h-8 opacity-20" />
            <p className="text-xs">Sin mensajes</p>
          </div>
        ) : (
          msgList.map((msg: Record<string, any>, idx: number) => {
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
                  <div className={cn("max-w-[85%] sm:max-w-[68%] rounded-2xl px-3.5 py-2", isOutbound ? "bg-primary/20 rounded-tr-sm" : "bg-muted rounded-tl-sm")}>
                    {isFirst && !isOutbound && <div className="text-[10px] font-medium text-muted-foreground mb-1">{contactName}</div>}
                    {(() => {
                      const text = msg.body_text || msg.body_html || msg.content || "";
                      const API_BASE = import.meta.env.VITE_PymesHub_API_URL ?? "";

                      // Media messages: use DTO fields, not emoji parsing
                      if (msg.has_media && msg.media_type && msg.id) {
                        const caption = msg.media_caption || (
                          !text.startsWith("🖼️") && !text.startsWith("📄") &&
                          !text.startsWith("🎬") && !text.startsWith("🎧") &&
                          !text.startsWith("💬") && text !== "🖼️ Imagen" &&
                          text !== "📄 Documento" && text !== "🎬 Video" &&
                          text !== "🎧 Audio" && text !== "💬 Sticker"
                        ) ? text : undefined;

                        if (msg.media_type === 'image' || msg.media_type === 'sticker') {
                          return <MediaRenderer messageId={msg.id} mediaType="image" caption={caption} />;
                        }
                        if (msg.media_type === 'video') {
                          return <MediaRenderer messageId={msg.id} mediaType="video" caption={caption} />;
                        }
                        if (msg.media_type === 'audio') {
                          return <MediaRenderer messageId={msg.id} mediaType="audio" caption={caption} />;
                        }
                        return <MediaRenderer messageId={msg.id} mediaType="document" caption={caption} />;
                      }

                      if (text.startsWith("📍 ")) {
                        const lines = text.split("\n");
                        const label = lines[0].replace("📍 ", "");
                        const coordsLine = lines.find((l: string) => l.includes(","));
                        const [lat, lng] = coordsLine ? coordsLine.split(",").map((s: string) => s.trim()) : [];
                        const mapsUrl = lat && lng ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : null;
                        return (
                          <div>
                            <p className="text-sm font-medium text-foreground">📍 {label}</p>
                            {lines.slice(1).filter((l: string) => !l.includes(",")).map((l: string, i: number) => (
                              <p key={i} className="text-[11px] text-muted-foreground/80 mt-0.5">{l}</p>
                            ))}
                            {mapsUrl && (
                              <a href={mapsUrl} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 mt-2 text-[11px] text-blue-400 hover:text-blue-300 underline underline-offset-2">
                                Ver en Google Maps →
                              </a>
                            )}
                          </div>
                        );
                      }

                      const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g;
                      const parts = text.split(urlRegex);
                      if (parts.length > 1) {
                        return (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                            {parts.map((part: string, i: number) =>
                              urlRegex.test(part) ? (
                                <a key={i} href={part} target="_blank" rel="noreferrer"
                                  className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
                                  {part}
                                </a>
                              ) : (
                                <span key={i}>{part}</span>
                              )
                            )}
                          </p>
                        );
                      }

                      return <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{text}</p>;
                    })()}
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
        {attachment && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="flex-1 text-[11px] text-muted-foreground truncate">
              📎 {attachment.file.name}
              {uploading && <Loader2 className="w-3 h-3 animate-spin inline ml-1" />}
            </div>
            <button onClick={() => setAttachment(null)} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <label className="cursor-pointer text-muted-foreground hover:text-foreground p-1.5 shrink-0">
            <Paperclip className="w-4 h-4" />
            <input
              type="file"
              accept="image/*,video/mp4,video/quicktime,audio/mpeg,audio/ogg,audio/wav,.pdf,.docx,.xlsx"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const form = new FormData();
                form.append('file', file);
                setUploading(true);
                try {
                  const { url } = await api.uploadAttachment(form);
                  const type = file.type.startsWith('image/') ? 'image'
                    : file.type.startsWith('video/') ? 'video'
                    : file.type.startsWith('audio/') ? 'audio'
                    : 'document';
                  setAttachment({ file, url, type });
                } catch (err: unknown) {
                  toast({ title: "Error", description: err instanceof Error ? err.message : "No se pudo subir el archivo", variant: "destructive" });
                } finally {
                  setUploading(false);
                  e.target.value = '';
                }
              }}
            />
          </label>
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
          <Button type="submit" size="sm" className="h-9 shrink-0" disabled={(!message.trim() && !attachment) || sendMut.isPending || uploading}>
            {sendMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/80 mt-1 ml-1">Enter para enviar · Shift+Enter para nueva línea</p>
      </div>

      {/* Invoice dialog */}
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

              {/* Line items */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px]">Productos / Líneas</Label>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setShowProductPicker(true)}>
                    <Plus className="w-3 h-3" />Agregar
                  </Button>
                </div>

                {/* Product picker panel */}
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

                {/* Line items table */}
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
