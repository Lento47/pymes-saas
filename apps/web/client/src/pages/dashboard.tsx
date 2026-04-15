import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { PriorityDot } from "@/components/shared/priority-dot";
import { PageLoader } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  MessageSquare,
  Mail,
  CheckSquare,
  FileText,
  Sparkles,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

export default function DashboardPage() {
  useRequireAuth();
  const { toast } = useToast();

  const { data: summaries, isLoading: summariesLoading } = useQuery({
    queryKey: ["/api/summaries/daily"],
    queryFn: () => api.getDailySummaries(),
  });

  const { data: conversations, isLoading: convsLoading } = useQuery({
    queryKey: ["/api/conversations", "dashboard"],
    queryFn: () => api.getConversations({ limit: "5", sort: "desc" }),
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["/api/tasks", "dashboard"],
    queryFn: () => api.getTasks({ limit: "5", sort: "desc" }),
  });

  const generateMutation = useMutation({
    mutationFn: () => api.generateSummary(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/summaries/daily"] });
      toast({ title: "Summary generated successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to generate summary", description: err.message, variant: "destructive" });
    },
  });

  const lastSummary = Array.isArray(summaries) ? summaries[0] : summaries?.data?.[0] || null;
  const metrics = lastSummary?.metrics || lastSummary || {};
  const convList = Array.isArray(conversations) ? conversations : conversations?.data || [];
  const taskList = Array.isArray(tasks) ? tasks : tasks?.data || [];

  const statCards = [
    { label: "New Conversations", value: metrics.newConversations ?? metrics.new_conversations ?? "—", icon: MessageSquare, color: "text-blue-400" },
    { label: "Messages Received", value: metrics.messagesReceived ?? metrics.messages_received ?? "—", icon: Mail, color: "text-emerald-400" },
    { label: "Tasks Created", value: metrics.tasksCreated ?? metrics.tasks_created ?? "—", icon: CheckSquare, color: "text-amber-400" },
    { label: "Documents Uploaded", value: metrics.documentsUploaded ?? metrics.documents_uploaded ?? "—", icon: FileText, color: "text-purple-400" },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of your workspace activity">
        <Button
          size="sm"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="h-8 text-xs"
          data-testid="button-generate-summary"
        >
          {generateMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          )}
          Generate Summary
        </Button>
      </PageHeader>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {statCards.map((stat) => (
          <Card key={stat.label} className="bg-card border-border p-4" data-testid={`metric-card-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center">
                <stat.icon className={`w-4.5 h-4.5 ${stat.color}`} />
              </div>
              <div>
                {summariesLoading ? (
                  <Skeleton className="h-6 w-10 mb-1" />
                ) : (
                  <div className="text-xl font-semibold text-foreground">{stat.value}</div>
                )}
                <div className="text-[11px] text-muted-foreground">{stat.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Summary text */}
      {lastSummary?.summary && (
        <Card className="bg-card border-border p-4 mb-6" data-testid="summary-text">
          <div className="text-xs font-medium text-muted-foreground mb-2">AI Summary</div>
          <p className="text-sm text-foreground leading-relaxed">{lastSummary.summary}</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Recent conversations */}
        <Card className="bg-card border-border" data-testid="recent-conversations">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-foreground">Recent Conversations</h3>
            <Link href="/inbox" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-border">
            {convsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-4 py-3">
                  <Skeleton className="h-4 w-48 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))
            ) : convList.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">No conversations yet</div>
            ) : (
              convList.slice(0, 5).map((conv: any) => (
                <Link key={conv.id} href={`/inbox/${conv.id}`}>
                  <div className="px-4 py-2.5 hover:bg-white/[0.02] cursor-pointer transition-colors" data-testid={`conversation-row-${conv.id}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm text-foreground truncate flex-1">{conv.subject || "No subject"}</span>
                      <StatusBadge status={conv.status} type="conversation" />
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <PriorityDot priority={conv.priority} />
                      <span>{conv.contact?.name || conv.contactName || "Unknown"}</span>
                      {conv.updatedAt && <span>· {format(new Date(conv.updatedAt || conv.updated_at), "MMM d")}</span>}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>

        {/* Recent tasks */}
        <Card className="bg-card border-border" data-testid="recent-tasks">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-foreground">Recent Tasks</h3>
            <Link href="/tasks" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-border">
            {tasksLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-4 py-3">
                  <Skeleton className="h-4 w-48 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))
            ) : taskList.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">No tasks yet</div>
            ) : (
              taskList.slice(0, 5).map((task: any) => (
                <div key={task.id} className="px-4 py-2.5 hover:bg-white/[0.02] transition-colors" data-testid={`task-row-${task.id}`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm text-foreground truncate flex-1">{task.title}</span>
                    <StatusBadge status={task.status} type="task" />
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {task.dueDate || task.due_date
                      ? `Due ${format(new Date(task.dueDate || task.due_date), "MMM d")}`
                      : "No due date"}
                    {task.assignedTo?.firstName && ` · ${task.assignedTo.firstName}`}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
