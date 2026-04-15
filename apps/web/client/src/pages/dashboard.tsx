import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useRequireAuth, useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { PriorityDot } from "@/components/shared/priority-dot";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  MessageSquare,
  Mail,
  CheckSquare,
  FileText,
  RefreshCw,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function DashboardPage() {
  useRequireAuth();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: summaries } = useQuery({
    queryKey: ["/api/summaries/daily"],
    queryFn: () => api.getDailySummaries(),
  });

  const { data: todayStats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/workspaces/current/stats/today"],
    queryFn: () => api.getTodayStats(),
    refetchInterval: 60000,
  });

  const { data: conversations, isLoading: convsLoading } = useQuery({
    queryKey: ["/api/conversations", "dashboard"],
    queryFn: () => api.getConversations({ limit: "5" }),
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["/api/tasks", "dashboard"],
    queryFn: () => api.getTasks({ limit: "5" }),
  });

  const generateMutation = useMutation({
    mutationFn: () => api.generateSummary(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/summaries/daily"] });
      toast({ title: "Resumen generado" });
    },
    onError: (err: any) => {
      toast({ title: "Error al generar resumen", description: err.message, variant: "destructive" });
    },
  });

  const lastSummary = Array.isArray(summaries) ? summaries[0] : summaries?.data?.[0] ?? null;
  const convList    = Array.isArray(conversations) ? conversations : conversations?.data ?? [];
  const taskList    = Array.isArray(tasks) ? tasks : tasks?.data ?? [];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  const statCards = [
    { label: "Conversaciones",  value: todayStats?.new_conversations  ?? "—", icon: MessageSquare, accent: "text-primary" },
    { label: "Mensajes",        value: todayStats?.received_messages   ?? "—", icon: Mail,          accent: "text-primary" },
    { label: "Tareas creadas",  value: todayStats?.created_tasks       ?? "—", icon: CheckSquare,   accent: "text-primary" },
    { label: "Documentos",      value: todayStats?.uploaded_documents  ?? "—", icon: FileText,      accent: "text-primary" },
  ];

  return (
    <div className="min-h-full">
      <PageHeader
        title="Dashboard"
        description={format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
      >
        <Button
          size="sm"
          variant="outline"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="h-8 text-[12px] gap-1.5"
          data-testid="button-generate-summary"
        >
          {generateMutation.isPending
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <RefreshCw className="w-3 h-3" />
          }
          Resumen IA
        </Button>
      </PageHeader>

      <div className="p-6 space-y-6">

        {/* Greeting */}
        <div>
          <p className="text-[22px] font-semibold text-foreground tracking-tight leading-none">
            {greeting()}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.
          </p>
          <p className="text-[13px] text-muted-foreground mt-1">Aquí está el resumen de hoy.</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCards.map((s) => (
            <div
              key={s.label}
              className="bg-[hsl(var(--card))] border border-border rounded-lg px-4 py-3.5"
              data-testid={`stat-${s.label}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{s.label}</span>
                <s.icon className={`w-3.5 h-3.5 ${s.accent} opacity-60`} strokeWidth={1.8} />
              </div>
              {statsLoading
                ? <Skeleton className="h-7 w-10" />
                : <span className="text-[26px] font-semibold text-foreground leading-none tabular-nums">{s.value}</span>
              }
            </div>
          ))}
        </div>

        {/* AI Summary */}
        {(lastSummary?.generated_text || lastSummary?.summary) && (
          <div className="bg-[hsl(var(--card))] border border-border rounded-lg p-4" data-testid="summary-text">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Resumen IA
            </div>
            <p className="text-[13px] text-foreground leading-relaxed">
              {lastSummary.generated_text || lastSummary.summary}
            </p>
          </div>
        )}

        {/* Two-column feed */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Recent conversations */}
          <div className="bg-[hsl(var(--card))] border border-border rounded-lg overflow-hidden" data-testid="recent-conversations">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-[13px] font-medium text-foreground">Conversaciones recientes</span>
              <Link href="/inbox">
                <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  Ver todo <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </div>
            <div className="divide-y divide-border">
              {convsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 space-y-1.5">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))
              ) : convList.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">Sin conversaciones</div>
              ) : (
                convList.slice(0, 5).map((conv: any) => (
                  <Link key={conv.id} href={`/inbox/${conv.id}`}>
                    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.025] cursor-pointer transition-colors">
                      <PriorityDot priority={conv.priority} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-foreground truncate leading-snug">
                          {conv.subject || "Sin asunto"}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {conv.contact?.full_name || "—"}
                          {conv.updated_at && ` · ${format(new Date(conv.updated_at), "d MMM", { locale: es })}`}
                        </p>
                      </div>
                      <StatusBadge status={conv.status} type="conversation" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Recent tasks */}
          <div className="bg-[hsl(var(--card))] border border-border rounded-lg overflow-hidden" data-testid="recent-tasks">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-[13px] font-medium text-foreground">Tareas recientes</span>
              <Link href="/tasks">
                <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  Ver todo <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </div>
            <div className="divide-y divide-border">
              {tasksLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 space-y-1.5">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))
              ) : taskList.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">Sin tareas</div>
              ) : (
                taskList.slice(0, 5).map((task: any) => (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.025] transition-colors">
                    <PriorityDot priority={task.priority} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-foreground truncate leading-snug">{task.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {task.due_date
                          ? `Vence ${format(new Date(task.due_date), "d MMM", { locale: es })}`
                          : "Sin fecha"}
                      </p>
                    </div>
                    <StatusBadge status={task.status} type="task" />
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
