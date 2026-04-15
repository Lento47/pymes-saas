import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { PriorityDot } from "@/components/shared/priority-dot";
import { EmptyState } from "@/components/shared/empty-state";
import { PageLoader } from "@/components/shared/loading-spinner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { Inbox as InboxIcon, Search, MoreHorizontal, Trash } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";

const STATUS_OPTIONS = ["ALL", "NEW", "OPEN", "PENDING", "RESOLVED"];

export default function InboxPage() {
  useRequireAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const params: Record<string, string> = {};
  if (search) params.search = search;
  if (statusFilter !== "ALL") params.status = statusFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/conversations", statusFilter, search],
    queryFn: () => api.getConversations(Object.keys(params).length ? params : undefined),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({ title: "Conversation deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete conversation", description: err.message, variant: "destructive" });
    },
  });

  const convList = Array.isArray(data) ? data : data?.data || [];

  return (
    <div>
      <PageHeader title="Inbox" description="Manage your conversations" />

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-card border-border"
            data-testid="input-search-conversations"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs bg-card border-border" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s === "ALL" ? "All Status" : s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : convList.length === 0 ? (
        <EmptyState icon={InboxIcon} title="No conversations" description="When conversations arrive, they'll show up here." />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <div className="divide-y divide-border">
            {convList.map((conv: any) => (
              <div
                key={conv.id}
                className="group flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] cursor-pointer transition-colors relative"
                data-testid={`inbox-item-${conv.id}`}
              >
                <Link href={`/inbox/${conv.id}`}>
                  <span className="absolute inset-0 z-0"></span>
                </Link>
                <div className="z-10">
                  <PriorityDot priority={conv.priority} />
                </div>
                <div className="flex-1 min-w-0 z-10 pointer-events-none">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-foreground truncate">{conv.subject || "No subject"}</span>
                    <StatusBadge status={conv.status} type="conversation" />
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {conv.contact?.name || conv.contactName || "Unknown contact"}
                    {conv.lastMessage && ` — ${conv.lastMessage.substring(0, 60)}...`}
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground shrink-0 z-10 group-hover:hidden">
                  {conv.updatedAt || conv.updated_at
                    ? formatDistanceToNow(new Date(conv.updatedAt || conv.updated_at), { addSuffix: true })
                    : ""}
                </div>
                <div className="hidden group-hover:flex items-center z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-conv-options-${conv.id}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteMutation.mutate(conv.id);
                      }}>
                        <Trash className="w-4 h-4 mr-2" />
                        Delete Conversation
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
