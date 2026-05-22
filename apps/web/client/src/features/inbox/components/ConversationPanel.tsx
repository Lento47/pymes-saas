import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useConversationSocket } from "@/hooks/use-conversation-socket";
import { getSocket } from "@/hooks/use-socket";
import { ConversationHeader } from "./conversation/ConversationHeader";
import { MessageTimeline } from "./conversation/MessageTimeline";
import { MessageComposer } from "./conversation/MessageComposer";
import { AgentRunCard, type AgentRun } from "./conversation/AgentRunCard";
import { InvoiceDialog } from "./conversation/InvoiceDialog";
import { DeleteConversationAlert } from "./conversation/DeleteConversationAlert";
import { ContactFromConversationDialog } from "./ContactFromConversationDialog";
import { useAvatarUrl } from "@/hooks/use-avatar-url";
import { normalizeMessage } from "@/features/inbox/message-adapters";
import type { UiMessage } from "@/features/inbox/message-types";
import type { InteractiveState } from "./composer/InteractiveToolbar";

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
  const [showAddContact, setShowAddContact] = useState(false);
  const [isUserTyping, setIsUserTyping] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = conversationId || "";

  const { data: conv } = useQuery({
    queryKey: ["/api/conversations", id],
    queryFn: () => api.getConversation(id),
    enabled: !!id,
    staleTime: 30_000,
  });

  const { data: workspace } = useQuery({
    queryKey: ["/api/workspaces/current"],
    queryFn: () => api.getWorkspace(),
    staleTime: 5 * 60_000,
  });

  // ── Read receipt when conversation opens ──
  useEffect(() => {
    if (!id || !conv?.channel?.type || String(conv.channel.type).toUpperCase() !== "WHATSAPP") return;
    api.sendReadReceipt(id).catch(() => { /* best-effort */ });
  }, [id, conv?.channel?.type]);

  // ── Typing indicator with debounce ──
  useEffect(() => {
    if (!id || !conv?.channel?.type || String(conv.channel.type).toUpperCase() !== "WHATSAPP") return;

    if (message.length > 0) {
      api.sendTypingIndicator(id, "typing_on").catch(() => {});
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        api.sendTypingIndicator(id, "typing_off").catch(() => {});
      }, 3000);
    }

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [id, message, conv?.channel?.type]);

  // ── Listen for WhatsApp user typing ──
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !id) return;

    const handleUserTyping = (data: { conversationId: string; from: string }) => {
      if (data.conversationId !== id) return;
      setIsUserTyping(true);
      if (userTypingTimerRef.current) clearTimeout(userTypingTimerRef.current);
      // Auto-clear after 5s if no message arrives
      userTypingTimerRef.current = setTimeout(() => setIsUserTyping(false), 5000);
    };

    socket.on('user:typing', handleUserTyping);
    return () => {
      socket.off('user:typing', handleUserTyping);
      if (userTypingTimerRef.current) clearTimeout(userTypingTimerRef.current);
    };
  }, [id]);

  const { data: messages, isLoading: msgsLoading } = useQuery({
    queryKey: ["/api/conversations", id, "messages"],
    queryFn: () => api.getMessages(id),
    enabled: !!id,
    staleTime: 3_000,
    refetchInterval: 2_000,
  });

  const { data: members } = useQuery({
    queryKey: ["workspace-members"],
    queryFn: () => api.getMembers(),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });

  const sendMut = useMutation({
    mutationFn: (data: Record<string, any>) => api.sendMessage(id, data),
    onMutate: async (newMessage) => {
      // Cancel refetches so they don't overwrite our optimistic update
      await qc.cancelQueries({ queryKey: ["/api/conversations", id, "messages"] });

      // Snapshot for rollback
      const previousMessages = qc.getQueryData(["/api/conversations", id, "messages"]);

      // Optimistic insert
      const optimisticId = `temp-${Date.now()}`;
      const optimistic = {
        id: optimisticId,
        body_text: newMessage.body_text,
        direction: "OUTBOUND",
        sender_name: user?.name ?? "Yo",
        sender_user_id: user?.id,
        sent_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        message_type: "TEXT",
        delivery_status: "PENDING",
        has_media: false,
        media_type: null,
        media_status: "none",
        attachments: [],
        conversation_id: id,
      };

      qc.setQueryData(["/api/conversations", id, "messages"], (old: any) => {
        const dataArray = Array.isArray(old) ? old : old?.data ?? [];
        return Array.isArray(old)
          ? [...dataArray, optimistic]
          : { ...old, data: [...dataArray, optimistic], meta: { ...old?.meta, total: (old?.meta?.total ?? 0) + 1 } };
      });

      // Clear input immediately
      setMessage("");
      setAttachment(null);

      return { previousMessages, optimisticId };
    },
    onError: (err: any, _newMessage, context: any) => {
      // Rollback on failure
      if (context?.previousMessages) {
        qc.setQueryData(["/api/conversations", id, "messages"], context.previousMessages);
      }
      toast({ title: "Error al enviar", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
      // Replace optimistic with real data from server
      qc.invalidateQueries({ queryKey: ["/api/conversations", id, "messages"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
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

  const handleSend = useCallback((interactive?: InteractiveState) => {
    if (sendMut.isPending || uploading) return;
    if (!message.trim() && !attachment && !interactive) return;

    const basePayload: Record<string, any> = { direction: "OUTBOUND" };

    if (interactive) {
      basePayload.body_text = message;

      if (interactive.type === "buttons") {
        basePayload.interactive = {
          type: "button",
          body: interactive.body ?? message,
          footer: interactive.footer,
          buttons: interactive.buttons ?? [],
        };
      } else if (interactive.type === "list") {
        basePayload.interactive = {
          type: "list",
          body: interactive.body ?? message,
          footer: interactive.footer,
          buttonText: interactive.listButtonText ?? "Ver opciones",
          sections: interactive.sections ?? [],
        };
      } else if (interactive.type === "location_request") {
        basePayload.interactive = {
          type: "location_request",
          body: interactive.locationBody ?? message,
        };
      }
    } else if (attachment) {
      basePayload.body_text = message;
      basePayload.media_url = attachment.url;
      basePayload.media_type = attachment.type;
    } else {
      basePayload.body_text = message;
    }

    sendMut.mutate(basePayload);
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

  const EMPRENDE_PLANS = ["EMPRENDE", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE", "BUSINESS_PLUS"];
  const plan = (workspace as any)?.plan ?? "FREE";
  const isEmprendePlus = EMPRENDE_PLANS.includes(plan);
  const aiState = (conv as any)?.metadata_json?.ai_state ?? "IDLE";

  const delegateToAiMut = useMutation({
    mutationFn: () => api.delegateConversationToAi(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/conversations", id] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const { data: agentRun } = useQuery({
    queryKey: ["agent-run", id],
    queryFn: () => api.getAgentRun(id),
    enabled: !!id && isEmprendePlus,
    staleTime: 10_000,
  });

  const startAgentMut = useMutation({
    mutationFn: () => {
      const lastInbound = [...msgList].reverse().find((m: any) => m.direction === "INBOUND");
      return api.startAgentRun(id, lastInbound?.body_text ?? "");
    },
    onSuccess: (data) => {
      if (data?.run) qc.setQueryData(["agent-run", id], data.run);
      else toast({ title: "No se detectó intención", description: "El agente no pudo interpretar el último mensaje.", variant: "destructive" });
    },
    onError: (e: any) => toast({ title: "Error al iniciar agente", description: e.message, variant: "destructive" }),
  });

  // Clear typing indicator when a new inbound message arrives
  // NOTE: must come AFTER msgList declaration (TDZ constraint in JS)
  useEffect(() => {
    if (msgList.length > 0) {
      const last = msgList[msgList.length - 1];
      if (last.direction === 'INBOUND') {
        setIsUserTyping(false);
        if (userTypingTimerRef.current) clearTimeout(userTypingTimerRef.current);
      }
    }
  }, [msgList.length]);

  const memberList = useMemo(() => {
    return Array.isArray(members) ? members : members?.data || [];
  }, [members]);

  const conversation = conv;
  const contact = conversation?.contact;
  const contactName = contact?.full_name || "Desconocido";
  const contactIdentity = contact?.email ?? contact?.phone ?? contact?.id ?? contactName;
  const contactAvatarUrl = useAvatarUrl(contactIdentity);
  const channelType = conversation?.channel?.type || "";

  // Compute service window status
  const isServiceWindowOpen = conversation?.service_window_expires_at
    ? new Date(conversation.service_window_expires_at).getTime() > Date.now()
    : true; // default to open for non-WhatsApp or when field is null
  const canSendInvoice = ["EMAIL", "WHATSAPP", "TELEGRAM"].includes(channelType?.toUpperCase() ?? "");

  const [nearBottom, setNearBottom] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const prevMsgCountRef = useRef(0);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [animatingMsgId, setAnimatingMsgId] = useState<string | null>(null);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setNearBottom(scrollHeight - scrollTop - clientHeight < 150);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    setNearBottom(true);
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ block: "end", behavior: smooth ? "smooth" : "instant" });
    }
  }, []);

  useEffect(() => {
    if (msgsLoading || !bottomRef.current) return;

    if (!initialLoaded) {
      const timer = setTimeout(() => {
        scrollToBottom(false);
        prevMsgCountRef.current = msgList.length;
        setInitialLoaded(true);
      }, 300);
      return () => clearTimeout(timer);
    }

    const newMessages = msgList.length - prevMsgCountRef.current;
    prevMsgCountRef.current = msgList.length;

    if (newMessages > 0) {
      const lastNew = msgList[msgList.length - 1];
      if (lastNew?.id) {
        if (animationTimerRef.current) {
          clearTimeout(animationTimerRef.current);
        }
        setAnimatingMsgId(lastNew.id);
        animationTimerRef.current = setTimeout(() => {
          setAnimatingMsgId(null);
          animationTimerRef.current = null;
        }, 520);
      }
      // Always scroll for outbound (user sent it), or if already near bottom
      if (lastNew?.direction === "OUTBOUND" || nearBottom) {
        scrollToBottom(true);
      }
    }
  }, [msgsLoading, msgList.length, initialLoaded, nearBottom, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
    };
  }, []);

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
        contactAvatarUrl={contactAvatarUrl}
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
        onAddContact={() => setShowAddContact(true)}
        members={memberList as Array<{ user?: { id: string; name?: string }; id: string; name?: string; email?: string }>}
        canResolve={conversation?.status !== "RESOLVED"}
        canSendInvoice={canSendInvoice}
        canAddContact={!conversation?.contact?.id}
        onDelegateToAi={isEmprendePlus && aiState === "HUMAN_ACTIVE" ? () => delegateToAiMut.mutate() : undefined}
        isDelegatingToAi={delegateToAiMut.isPending}
        onStartAgent={isEmprendePlus && (agentRun as AgentRun | null | undefined)?.status !== "RUNNING" ? () => startAgentMut.mutate() : undefined}
        isStartingAgent={startAgentMut.isPending}
      />

      {agentRun && (agentRun as AgentRun).status !== "CANCELLED" && (
        <AgentRunCard run={agentRun as AgentRun} conversationId={id} />
      )}

      <MessageTimeline
        messages={uiMessages}
        isLoading={msgsLoading}
        contactName={contactName}
        contactAvatarInitials={getInitials(contactName)}
        contactAvatarUrl={contactAvatarUrl}
        scrollRef={scrollRef}
        bottomRef={bottomRef}
        nearBottom={nearBottom}
        isUserTyping={isUserTyping}
        animatingMsgId={animatingMsgId}
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
        channelType={channelType}
        isServiceWindowOpen={isServiceWindowOpen}
        disabled={!id}
        onAiSuggest={isEmprendePlus ? async () => {
          const lastInbound = [...msgList].reverse().find((m: any) => m.direction === "INBOUND");
          const result = await api.emprendeReply(id, lastInbound?.body_text ?? "");
          return result.reply;
        } : undefined}
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

      <ContactFromConversationDialog
        open={showAddContact}
        onOpenChange={setShowAddContact}
        conversationId={id}
        conversation={conversation ?? null}
      />
    </div>
  );
}
