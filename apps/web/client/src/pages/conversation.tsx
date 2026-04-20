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
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useRoute, useLocation, Link } from "wouter";
import { useConversationSocket } from "@/hooks/use-conversation-socket";
import { ArrowLeft, Send, UserPlus, CheckCircle2, RefreshCw, Loader2, Trash2, Mail, MessageCircle, Globe, Phone, ExternalLink, Plus } from "lucide-react";
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

  useConversationSocket(id);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const msgList = Array.isArray(messages) ? messages : messages?.data || [];
  const memberList = Array.isArray(members) ? members : members?.data || [];
  const contact = conversation?.contact;
  const assignedMember = memberList.find(
    (m: any) => (m.id || m.userId) === (conversation?.assignedTo?.id || conversation?.assigned_to_id)
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgList.length]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate({ body_text: message, direction: "OUTBOUND" });
  };

  if (convLoading) return <PageLoader />;
  if (!conversation) return <div className="text-center text-muted-foreground py-12">Conversación no encontrada</div>;

  const contactName = contact
    ? (contact.name || `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || contact.email || "?")
    : "Desconocido";

  return (
    <TooltipProvider>
      <div className="flex gap-4 h-[calc(100vh-80px)]">
        {/* Main conversation area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
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
                  {assignedMember.firstName || assignedMember.user?.firstName || assignedMember.email}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Select onValueChange={(val) => assignMutation.mutate(val)}>
                    <SelectTrigger className="h-8 w-8 p-0 border-0 bg-transparent" data-testid="button-assign">
                      <UserPlus className="w-4 h-4 text-muted-foreground" />
                    </SelectTrigger>
                    <SelectContent>
                      {memberList.map((m: any) => (
                        <SelectItem key={m.id || m.userId} value={m.id || m.userId}>
                          {m.firstName || m.user?.firstName || m.email}{" "}
                          {m.lastName || m.user?.lastName || ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TooltipTrigger>
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

          {/* Messages */}
          <div className="flex-1 overflow-y-auto pb-4 pr-1">
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

          {/* Input area */}
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

        {/* Right panel */}
        <div className="w-[240px] shrink-0 flex flex-col gap-3 overflow-y-auto" data-testid="contact-info-panel">
          {/* Contact card */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Contacto</h3>
              {contact && (
                <Link href={`/contacts/${contact.id}`}>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground">
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </Link>
              )}
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
              <p className="text-xs text-muted-foreground">Sin contacto vinculado</p>
            )}
          </div>

          {/* Conversation details */}
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
                  <span className="text-[11px] text-foreground truncate max-w-[110px]">
                    {assignedMember.firstName || assignedMember.user?.firstName || assignedMember.email}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tasks */}
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

        {/* Delete Confirmation */}
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
      </div>
    </TooltipProvider>
  );
}
