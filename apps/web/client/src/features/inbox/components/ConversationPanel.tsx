import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { hasPermission, Permission } from "@/lib/permissions";
import { Button } from "@/components/arc/button/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useConversationSocket } from "@/hooks/use-conversation-socket";
import { getSocket } from "@/hooks/use-socket";
import { ConversationHeader } from "./conversation/ConversationHeader";
import { MessageTimeline } from "./conversation/MessageTimeline";
import { MessageComposer } from "./conversation/MessageComposer";
import { type AgentRun } from "./conversation/AITypingBubble";
import { InvoiceDialog } from "./conversation/InvoiceDialog";
import { DeleteConversationAlert } from "./conversation/DeleteConversationAlert";
import { ContactFromConversationDialog } from "./ContactFromConversationDialog";
import { TaskSheet } from "@/components/tasks/TaskSheet";
import { emptyTask, type TaskFormData } from "@/lib/task-utils";
import { useAvatarUrl } from "@/hooks/use-avatar-url";
import { normalizeMessage } from "@/features/inbox/message-adapters";
import type { UiMessage } from "@/features/inbox/message-types";
import type { InteractiveState } from "./composer/InteractiveToolbar";

const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: "WhatsApp", EMAIL: "Email", TELEGRAM: "Telegram",
  FORM: "Formulario", API: "API", MANUAL: "Manual",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Abierto",
  RESOLVED: "Resuelto",
  PENDING: "Pendiente",
  NEW: "Nuevo",
  IN_PROGRESS: "En progreso",
  WAITING_CLIENT: "Esperando cliente",
  REQUIRES_HUMAN: "Requiere humano",
  IA_ATTENDING: "IA activa",
  BLOCKED: "Bloqueado",
  SPAM: "Spam",
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
  const can = (permission: Permission) => hasPermission(user?.role ?? "", permission, !!user?.is_platform_admin);
  const canReply = can(Permission.CONVERSATIONS_REPLY);
  const canAssign = can(Permission.CONVERSATIONS_ASSIGN);
  const canAi = can(Permission.AI_USE);
  useConversationSocket(conversationId || '');

  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<{ file: File; url: string; type: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [replyingTo, setReplyingTo] = useState<UiMessage | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = conversationId || "";

  const { data: conv, isLoading: conversationLoading, isError: conversationError, refetch: retryConversation } = useQuery({
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

  useEffect(() => {
    if (!canReply || !id || !conv?.channel?.type || String(conv.channel.type).toUpperCase() !== "WHATSAPP") return;
    api.sendReadReceipt(id).catch(() => { /* best-effort */ });
  }, [id, conv?.channel?.type, canReply]);

  useEffect(() => {
    if (!canReply || !id || !conv?.channel?.type || String(conv.channel.type).toUpperCase() !== "WHATSAPP") return;

    if (message.length > 0) {
      api.sendTypingIndicator(id).catch(() => {});
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        // typing stops automatically via timeout
      }, 3000);
    }

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [id, message, conv?.channel?.type, canReply]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !id) return;

    const handleUserTyping = (data: { conversationId: string; from: string }) => {
      if (data.conversationId !== id) return;
      setIsUserTyping(true);
      if (userTypingTimerRef.current) clearTimeout(userTypingTimerRef.current);
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
    queryKey: ["workspace-members", user?.workspace.id],
    queryFn: () => api.getMembers(),
    enabled: !!id && canAssign,
    staleTime: 5 * 60_000,
  });

  const sendMut = useMutation({
    mutationFn: (data: Record<string, any>) => api.sendMessage(id, data),
    onMutate: async (newMessage) => {
      await qc.cancelQueries({ queryKey: ["/api/conversations", id, "messages"] });
      const previousMessages = qc.getQueryData(["/api/conversations", id, "messages"]);
      const optimisticId = `temp-${Date.now()}`;
      const optimistic = {
        id: optimisticId,
        body_text: newMessage.body_text,
        direction: "OUTBOUND",
        sender_name: user?.name ?? "Yo",
        sender_ref: user?.id ?? "self",
        sender_user_id: user?.id,
        sender_user: user ? { id: user.id, name: user.name, avatar_url: null } : null,
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

      setMessage("");
      setAttachment(null);
      return { previousMessages, optimisticId };
    },
    onSuccess: (serverMessage: Record<string, any>, _newMessage, context: any) => {
      if (!context?.optimisticId || !serverMessage?.id) return;
      qc.setQueryData(["/api/conversations", id, "messages"], (old: any) => {
        if (!old) return old;
        const dataArray = Array.isArray(old) ? old : old?.data ?? [];
        const replaced = dataArray.map((m: any) =>
          m.id === context.optimisticId ? serverMessage : m,
        );
        if (!replaced.some((m: any) => m.id === serverMessage.id)) replaced.push(serverMessage);
        const byId = new Map<string, any>();
        for (const item of replaced) byId.set(String(item.id), item);
        const deduped = Array.from(byId.values());
        return Array.isArray(old) ? deduped : { ...old, data: deduped };
      });
      // Map temp animation ID → server ID so the slide-up animation survives replacement
      setAnimatingMsgId(serverMessage.id);
    },
    onError: (err: any, _newMessage, context: any) => {
      if (context?.previousMessages) qc.setQueryData(["/api/conversations", id, "messages"], context.previousMessages);
      toast({ title: "Error al enviar", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
      // Only invalidate conversation list (unread count, last message preview).
      // Message cache is already updated optimistically + in onSuccess — no refetch needed.
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const conversation = conv;

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

  const statusChangeMut = useMutation({
    mutationFn: (status: string) =>
      status === "RESOLVED"
        ? api.resolveConversation(id)
        : api.updateConversation(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/conversations", id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const assignMut = useMutation({
    mutationFn: (userId: string) => api.assignConversation(id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/conversations", id] }),
  });

  const createTaskMut = useMutation({
    mutationFn: (form: TaskFormData) => {
      const body: Record<string, string> = { title: form.title.trim() };
      if (form.description?.trim()) body.description = form.description.trim();
      if (form.priority) body.priority = form.priority;
      if (form.dueDate) body.due_at = `${form.dueDate}T12:00:00.000Z`;
      if (form.assignedUserId) body.assigned_user_id = form.assignedUserId;
      if (id) body.conversation_id = id;
      if (conversation?.contact?.id) body.contact_id = conversation.contact.id;
      return api.createTask(body);
    },
    onSuccess: () => {
      setShowCreateTask(false);
      toast({ title: "Tarea creada" });
      qc.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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

    if (replyingTo?.id) {
      basePayload.reply_to_message_id = replyingTo.id;
    }

    sendMut.mutate(basePayload);
    setReplyingTo(null);
  }, [message, attachment, sendMut, uploading, replyingTo]);

  const handleAttach = useCallback(async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    setUploading(true);
    try {
      const { url } = await api.uploadAttachment(form);
      const ext = file.name.split(".").pop()?.toLowerCase();
      const type = ext === "webp"
        ? "sticker"
        : file.type.startsWith("image/") ? "image"
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

  const msgList = useMemo(() => Array.isArray(messages) ? messages : messages?.data || [], [messages]);

  const EMPRENDE_PLANS = ["EMPRENDE", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE", "BUSINESS_PLUS"];
  const plan = (workspace as any)?.plan ?? "FREE";
  const isEmprendePlus = EMPRENDE_PLANS.includes(plan);
  const aiState = (conv as any)?.metadata_json?.ai_state ?? "IDLE";

  const delegateToAiMut = useMutation({
    mutationFn: () => api.delegateConversationToAi(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/conversations", id] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const stopAiMut = useMutation({
    mutationFn: () => api.stopAiControl(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/conversations", id] }),
    onError: (e: any) => toast({ title: "Error al pausar IA", description: e.message, variant: "destructive" }),
  });

  const { data: agentRun } = useQuery({
    queryKey: ["agent-run", id],
    queryFn: () => api.getAgentRun(id),
    enabled: !!id && isEmprendePlus && canAi,
    staleTime: 2_000,
    retry: 2,
    refetchInterval: (query) => {
      const run = query.state.data as AgentRun | null | undefined;
      return run?.status === "RUNNING" ? 2_000 : false;
    },
  });

  const { data: approvedTemplates } = useQuery({
    queryKey: ["approved-templates", conv?.channel?.type],
    queryFn: () => api.getApprovedTemplates((conv?.channel?.type as string)?.toUpperCase() || "WHATSAPP"),
    enabled: !!id && !!conv?.channel?.type && canReply,
    staleTime: 5 * 60_000,
  });

  const startAgentMut = useMutation({
    mutationFn: () => {
      const lastInbound = [...msgList].reverse().find(
        (m: any) => m.direction === "INBOUND" && (m.body_text || m.caption)
      );
      const text = lastInbound?.body_text || lastInbound?.caption || "";
      return api.startAgentRun(id, text);
    },
    onSuccess: (data) => {
      if (data?.run) {
        qc.setQueryData(["agent-run", id], data.run);
      } else {
        const REASON_MSGS: Record<string, string> = {
          QUOTA_EXCEEDED: "Límite diario de ejecuciones de agente alcanzado.",
          AI_NOT_CONFIGURED: "El agente IA no está configurado en este workspace.",
          CONVERSATION_NOT_FOUND: "No se encontró la conversación.",
          INTENT_NOT_DETECTED: "No se detectó una intención reconocible (pedido, cita, cotización o queja).",
        };
        const d = data as { ok?: boolean; run?: unknown; reason?: string };
        const description = d?.reason ? (REASON_MSGS[d.reason] ?? d.reason) : REASON_MSGS.INTENT_NOT_DETECTED;
        toast({ title: "No se pudo iniciar el agente", description, variant: "destructive" });
      }
      qc.invalidateQueries({ queryKey: ["/api/conversations", id, "messages"] });
    },
    onError: (e: any) => toast({ title: "Error al iniciar agente", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (msgList.length > 0) {
      const last = msgList[msgList.length - 1];
      if (last.direction === 'INBOUND') {
        setIsUserTyping(false);
        if (userTypingTimerRef.current) clearTimeout(userTypingTimerRef.current);
      }
    }
  }, [msgList.length]);

  const memberList = useMemo(() => Array.isArray(members) ? members : members?.data || [], [members]);
  const contact = conversation?.contact;
  const contactName = contact?.full_name || "Desconocido";
  const contactIdentity = contact?.email ?? contact?.phone ?? contact?.id ?? contactName;
  const contactAvatarUrl = useAvatarUrl(contactIdentity);
  const channelType = conversation?.channel?.type || "";

  const isServiceWindowOpen = conversation?.service_window_expires_at
    ? new Date(conversation.service_window_expires_at).getTime() > Date.now()
    : true;
  const canSendInvoice = ["EMAIL", "WHATSAPP", "TELEGRAM"].includes(channelType?.toUpperCase() ?? "");

  const [nearBottom, setNearBottom] = useState(true);
  const nearBottomRef = useRef(true);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const prevMsgCountRef = useRef(0);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [animatingMsgId, setAnimatingMsgId] = useState<string | null>(null);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isNear = scrollHeight - scrollTop - clientHeight < 150;
    nearBottomRef.current = isNear;
    setNearBottom(isNear);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    nearBottomRef.current = true;
    setNearBottom(true);
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      if (smooth) {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    });
  }, []);

  useEffect(() => {
    if (msgsLoading || !scrollRef.current) return;

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
        if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
        setAnimatingMsgId(lastNew.id);
        animationTimerRef.current = setTimeout(() => {
          setAnimatingMsgId(null);
          animationTimerRef.current = null;
        }, 520);
      }
      // Instant scroll for outbound (user sends) to avoid competing with virtualizer repositioning.
      // Smooth scroll for incoming messages (contact sends) for a gentler UX.
      const instant = lastNew?.direction === "OUTBOUND";
      if (lastNew?.direction === "OUTBOUND" || nearBottomRef.current) scrollToBottom(instant);
    }
  }, [msgsLoading, msgList.length, initialLoaded, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    };
  }, []);

  // Re-scroll when typing indicator appears/disappears near bottom.
  // Without this, the scroll height change causes a visible jump.
  useEffect(() => {
    if (nearBottomRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      });
    }
  }, [isUserTyping]);

  const uiMessages = useMemo(() => msgList.map(normalizeMessage), [msgList]);

  if (!id) return null;
  if (conversationLoading) return <div role="status" className="p-6">Cargando conversación…</div>;
  if (conversationError || !conv) return <div role="alert" className="space-y-4 p-6"><p>No se pudo cargar la conversación.</p><Button className="min-h-12" onClick={() => retryConversation()}>Reintentar conversación</Button>{onBack && <Button variant="secondary" className="min-h-12" onClick={onBack}>Volver a la bandeja</Button>}</div>;

  const channelLabel = CHANNEL_LABELS[channelType] || channelType;
  const statusLabel = conversation?.status ? STATUS_LABELS[conversation.status] ?? conversation.status : null;
  const assigneeName = (conversation as any)?.assigned_user?.name ?? null;
  const statusDotClass = conversation?.status === "OPEN"
    ? "bg-emerald-400"
    : conversation?.status === "PENDING"
      ? "bg-amber-400"
      : conversation?.status === "REQUIRES_HUMAN" || conversation?.status === "BLOCKED"
        ? "bg-red-500"
        : conversation?.status === "IA_ATTENDING"
          ? "bg-violet-500"
          : "bg-blue-400/50";
  const statusDotSize = "w-1.5 h-1.5 rounded-full";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background md:h-full">
      <ConversationHeader
        contactName={contactName}
        contactAvatarInitials={getInitials(contactName)}
        contactAvatarUrl={contactAvatarUrl}
        channelType={channelType || undefined}
        statusLabel={statusLabel ?? undefined}
        assigneeName={assigneeName}
        statusDotClass={`${statusDotClass} ${statusDotSize}`}
        onBack={onBack}
        onAssign={canAssign ? (userId) => assignMut.mutate(userId) : undefined}
        onResolve={canReply ? () => resolveMut.mutate() : undefined}
        currentStatus={conversation?.status}
        onStatusChange={canReply ? (status) => statusChangeMut.mutate(status) : undefined}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["/api/conversations", id, "messages"] })}
        onInvoice={can(Permission.INVOICES_MANAGE) ? () => setShowInvoice(true) : undefined}
        onDelete={["OWNER", "ADMIN"].includes(user?.role ?? "") ? () => setShowDelete(true) : undefined}
        onAddContact={can(Permission.CONTACTS_MANAGE) ? () => setShowAddContact(true) : undefined}
        members={memberList as Array<{ user?: { id: string; name?: string }; id: string; name?: string; email?: string }>}
        canResolve={conversation?.status !== "RESOLVED"}
        canSendInvoice={canSendInvoice}
        canAddContact={!conversation?.contact?.id}
        onCreateTask={can(Permission.TASKS_MANAGE) ? () => setShowCreateTask(true) : undefined}
        onDelegateToAi={canAi && isEmprendePlus && aiState === "HUMAN_ACTIVE" ? () => delegateToAiMut.mutate() : undefined}
        isDelegatingToAi={delegateToAiMut.isPending}
        onPauseAi={canAi && isEmprendePlus && aiState === "AI_ACTIVE" ? () => stopAiMut.mutate() : undefined}
        isPausingAi={stopAiMut.isPending}
        onStartAgent={canAi && isEmprendePlus && (agentRun as AgentRun | null | undefined)?.status !== "RUNNING" ? () => startAgentMut.mutate() : undefined}
        isStartingAgent={startAgentMut.isPending}
      />

      <MessageTimeline
        messages={uiMessages}
        isLoading={msgsLoading}
        agentRun={agentRun as AgentRun | null | undefined}
        agentRunConversationId={id}
        contactName={contactName}
        contactAvatarInitials={getInitials(contactName)}
        contactAvatarUrl={contactAvatarUrl}
        provider={channelType || undefined}
        scrollRef={scrollRef}
        bottomRef={bottomRef}
        nearBottom={nearBottom}
        isUserTyping={isUserTyping}
        animatingMsgId={animatingMsgId}
        onScrollToBottom={scrollToBottom}
        onScroll={handleScroll}
        onReply={canReply ? setReplyingTo : undefined}
      />

      {canReply ? <MessageComposer
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
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        availableTemplates={Array.isArray(approvedTemplates) ? approvedTemplates : []}
        onInsertTemplate={(body) => setMessage(body)}
        onInsertProduct={(text) => setMessage(text)}
        onAiSuggest={isEmprendePlus ? async () => {
          const lastInbound = [...msgList].reverse().find((m: any) => m.direction === "INBOUND");
          const result = await api.emprendeReply(id, lastInbound?.body_text ?? "");
          return result.reply;
        } : undefined}
      /> : <p className="shrink-0 border-t p-4 text-sm text-muted-foreground">Tu rol permite leer esta conversación. Necesitas permiso para responder.</p>}

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

      <TaskSheet
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        editingId={null}
        initialData={{
          ...emptyTask,
          description: contactName !== "Desconocido" ? `Seguimiento con ${contactName}` : "",
        }}
        onSave={(form) => createTaskMut.mutate(form)}
        isSaving={createTaskMut.isPending}
        members={memberList}
      />
    </div>
  );
}
