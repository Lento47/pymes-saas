import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useConversationSocket } from "@/hooks/use-conversation-socket";
import { ConversationHeader } from "./conversation/ConversationHeader";
import { MessageTimeline } from "./conversation/MessageTimeline";
import { MessageComposer } from "./conversation/MessageComposer";
import { InvoiceDialog } from "./conversation/InvoiceDialog";
import { DeleteConversationAlert } from "./conversation/DeleteConversationAlert";
import { normalizeMessage } from "@/features/inbox/message-adapters";
import type { UiMessage } from "@/features/inbox/message-types";

const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: "WhatsApp", EMAIL: "Email", TELEGRAM: "Telegram",
  FORM: "Formulario", API: "API", MANUAL: "Manual",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Abierto", RESOLVED: "Resuelto", PENDING: "Pendiente",
};

function getInitials(name: string) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
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
  const [showInvoice, setShowInvoice] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const id = conversationId || "";

  const { data: conv } = useQuery({
    queryKey: ["/api/conversations", id],
    queryFn: () => api.getConversation(id),
    enabled: !!id,
    staleTime: 30_000,
  });

  const { data: messages, isLoading: msgsLoading } = useQuery({
    queryKey: ["/api/conversations", id, "messages"],
    queryFn: () => api.getMessages(id),
    enabled: !!id,
    staleTime: 30_000,
  });

  const { data: members } = useQuery({
    queryKey: ["workspace-members"],
    queryFn: () => api.getMembers(),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });

  const sendMut = useMutation({
    mutationFn: (data: Record<string, any>) => api.sendMessage(id, data),
    onSuccess: (response: any) => {
      qc.invalidateQueries({ queryKey: ["/api/conversations", id, "messages"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
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

  const createInvMut = useMutation({
    mutationFn: (payload: { form: Record<string, any>; lines: Array<Record<string, any>> }) =>
      api.createInvoice({
        contact_id: conversation?.contact?.id,
        conversation_id: id,
        ...payload.form,
        lines: payload.lines.length > 0 ? payload.lines.map((l, i) => ({
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
      toast({ title: "Factura creada" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sendInvMut = useMutation({
    mutationFn: async (invoice: { id: string }) => {
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

  const msgList = useMemo(() => {
    return Array.isArray(messages) ? messages : messages?.data || [];
  }, [messages]);

  const memberList = useMemo(() => {
    return Array.isArray(members) ? members : members?.data || [];
  }, [members]);

  const conversation = conv;
  const contact = conversation?.contact;
  const contactName = contact?.full_name || "Desconocido";
  const channelType = conversation?.channel?.type || "";
  const canSendInvoice = ["EMAIL", "WHATSAPP", "TELEGRAM"].includes(channelType?.toUpperCase() ?? "");

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
    if (msgsLoading || !bottomRef.current) return;

    if (!initialLoaded) {
      const timer = setTimeout(() => {
        bottomRef.current?.scrollIntoView({ block: "end", behavior: "instant" });
        setNearBottom(true);
        setInitialLoaded(true);
      }, 300);
      return () => clearTimeout(timer);
    }

    if (nearBottom) {
      bottomRef.current.scrollIntoView({ block: "end", behavior: "instant" });
    }
  }, [msgsLoading, msgList.length, initialLoaded, nearBottom]);

  const uiMessages = useMemo(() => msgList.map(normalizeMessage), [msgList]);

  if (!id) return null;

  const channelLabel = CHANNEL_LABELS[channelType] || channelType;
  const statusLabel = conversation?.status ? STATUS_LABELS[conversation.status] ?? conversation.status : null;
  const assigneeName = (conversation as any)?.assigned_user?.name ?? null;
  const statusDotClass = conversation?.status === "OPEN"
    ? "bg-emerald-400"
    : conversation?.status === "PENDING"
      ? "bg-amber-400"
      : "bg-blue-400/50";
  const statusDotSize = "w-1.5 h-1.5 rounded-full";

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <ConversationHeader
        contactName={contactName}
        contactAvatarInitials={getInitials(contactName)}
        channelType={channelType || undefined}
        statusLabel={statusLabel ?? undefined}
        assigneeName={assigneeName}
        statusDotClass={`${statusDotClass} ${statusDotSize}`}
        onBack={onBack}
        onAssign={(userId) => assignMut.mutate(userId)}
        onResolve={() => resolveMut.mutate()}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["/api/conversations", id, "messages"] })}
        onInvoice={() => setShowInvoice(true)}
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

      <InvoiceDialog
        open={showInvoice}
        onOpenChange={setShowInvoice}
        conversationId={id}
        contactId={conversation?.contact?.id}
        canSendInvoice={canSendInvoice}
        createInvMut={createInvMut}
        sendInvMut={sendInvMut}
      />

      <DeleteConversationAlert
        open={showDelete}
        onOpenChange={setShowDelete}
        onDelete={() => deleteMut.mutate()}
        deletePending={deleteMut.isPending}
      />
    </div>
  );
}
