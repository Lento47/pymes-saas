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
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useRoute, useLocation, Link } from "wouter";
import { useConversationSocket } from "@/hooks/use-conversation-socket";
import { ArrowLeft, Send, UserPlus, CheckCircle2, RefreshCw, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function ConversationPage() {
  useRequireAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/inbox/:id");
  const id = params?.id || "";
  const [message, setMessage] = useState("");
  const [showDelete, setShowDelete] = useState(false);

  // Real-time messages via WebSocket
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
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    },
  });

  const assignMutation = useMutation({
    mutationFn: (userId: string) => api.assignConversation(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", id] });
      toast({ title: "Conversation assigned" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: () => api.resolveConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({ title: "Conversation resolved" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({ title: "Conversation deleted" });
      setLocation("/inbox");
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete conversation", description: err.message, variant: "destructive" });
    },
  });

  const msgList = Array.isArray(messages) ? messages : messages?.data || [];
  const memberList = Array.isArray(members) ? members : members?.data || [];
  const contact = conversation?.contact;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgList.length]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate({ body_text: message, direction: "OUTBOUND" });
  };

  if (convLoading) return <PageLoader />;
  if (!conversation) return <div className="text-center text-muted-foreground py-12">Conversation not found</div>;

  return (
    <div className="flex gap-4 h-[calc(100vh-80px)]">
      {/* Main conversation area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-border mb-4">
          <Link href="/inbox">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground truncate">{conversation.subject || "No subject"}</h2>
              <StatusBadge status={conversation.status} type="conversation" />
              <PriorityDot priority={conversation.priority} showLabel />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Select onValueChange={(val) => assignMutation.mutate(val)}>
              <SelectTrigger className="h-8 w-8 p-0 border-0 bg-transparent" data-testid="button-assign">
                <UserPlus className="w-4 h-4 text-muted-foreground" />
              </SelectTrigger>
              <SelectContent>
                {memberList.map((m: any) => (
                  <SelectItem key={m.id || m.userId} value={m.id || m.userId}>
                    {m.firstName || m.user?.firstName || m.email} {m.lastName || m.user?.lastName || ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => resolveMutation.mutate()}
              disabled={conversation.status === "RESOLVED"}
              data-testid="button-resolve"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => refetchMessages()} data-testid="button-refresh">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setShowDelete(true)} data-testid="button-delete-conv">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 pb-4">
          {msgsLoading ? (
            <PageLoader />
          ) : msgList.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-12">No messages yet</div>
          ) : (
            msgList.map((msg: any) => {
              const isOutbound = msg.direction === "OUTBOUND";
              return (
                <div key={msg.id} className={cn("flex", isOutbound ? "justify-end" : "justify-start")} data-testid={`message-${msg.id}`}>
                  <div className={cn(
                    "max-w-[70%] rounded-lg px-3 py-2",
                    isOutbound ? "bg-primary/15 text-foreground" : "bg-muted text-foreground"
                  )}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.body_text || msg.body_html || msg.content || msg.body}</p>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {msg.createdAt || msg.created_at
                        ? format(new Date(msg.createdAt || msg.created_at), "MMM d, h:mm a")
                        : ""}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message input */}
        <div className="border-t border-border pt-3">
          <div className="flex gap-2">
            <Textarea
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="min-h-[60px] max-h-[120px] text-sm bg-card border-border resize-none"
              data-testid="input-message"
            />
            <Button
              className="h-auto px-4"
              onClick={handleSend}
              disabled={!message.trim() || sendMutation.isPending}
              data-testid="button-send"
            >
              {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Right panel — Contact info */}
      <Card className="w-[260px] shrink-0 bg-card border-border p-4 h-fit" data-testid="contact-info-panel">
        <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Contact</h3>
        {contact ? (
          <div className="space-y-2.5">
            <div>
              <div className="text-sm font-medium text-foreground">{contact.name || `${contact.firstName || ""} ${contact.lastName || ""}`.trim()}</div>
              {contact.company && <div className="text-xs text-muted-foreground">{contact.company}</div>}
            </div>
            {contact.email && (
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Email</div>
                <div className="text-xs text-foreground">{contact.email}</div>
              </div>
            )}
            {contact.phone && (
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Phone</div>
                <div className="text-xs text-foreground">{contact.phone}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No contact linked</div>
        )}

        {/* Conversation tasks */}
        {conversation.tasks && conversation.tasks.length > 0 && (
          <div className="mt-5">
            <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Tasks</h3>
            <div className="space-y-1.5">
              {conversation.tasks.map((task: any) => (
                <div key={task.id} className="flex items-center gap-2 text-xs">
                  <StatusBadge status={task.status} type="task" className="text-[9px]" />
                  <span className="truncate text-foreground">{task.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              This action cannot be undone. This will permanently delete the conversation, all its messages, and remove it from your inbox.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} className="h-8 text-xs bg-destructive hover:bg-destructive/90">
              {deleteMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
