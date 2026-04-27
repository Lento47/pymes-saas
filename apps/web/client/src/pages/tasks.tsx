import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useRequireAuth } from "@/hooks/use-auth";
import { useI18n } from "@/components/providers/i18n-provider";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { PriorityDot } from "@/components/shared/priority-dot";
import { EmptyState } from "@/components/shared/empty-state";
import { PageLoader } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CheckSquare, Plus, AlertTriangle, Check, Loader2, MoreHorizontal, Pencil, Trash, Search, Calendar, Clock } from "lucide-react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { cn } from "@/lib/utils";

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function DueDateLabel({ dateStr }: { dateStr?: string }) {
  if (!dateStr) return <span className="text-muted-foreground">—</span>;
  const date = new Date(dateStr);
  const overdue = isPast(date) && !isToday(date);
  const today = isToday(date);
  const tomorrow = isTomorrow(date);
  const label = today ? "Hoy" : tomorrow ? "Mañana" : format(date, "dd MMM");
  return (
    <span className={cn("flex items-center gap-1 text-xs", overdue ? "text-red-400" : today ? "text-amber-400" : "text-muted-foreground")}>
      {overdue ? <AlertTriangle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
      {label}
    </span>
  );
}

function toCreateTaskPayload(form: { title: string; description: string; priority: string; dueDate: string }) {
  const body: Record<string, string> = { title: form.title.trim() };
  if (form.description?.trim()) body.description = form.description.trim();
  if (form.priority) body.priority = form.priority;
  if (form.dueDate) body.due_at = `${form.dueDate}T12:00:00.000Z`;
  return body;
}

const PRIORITY_LABELS: Record<string, string> = { LOW: "Baja", MEDIUM: "Media", HIGH: "Alta", URGENT: "Urgente" };
const STATUS_OPTIONS = ["ALL", "TODO", "IN_PROGRESS", "BLOCKED", "DONE"];
const PRIORITY_OPTIONS = ["ALL", "LOW", "MEDIUM", "HIGH", "URGENT"];

export default function TasksPage() {
  useRequireAuth();
  const { messages } = useI18n();
  const t = messages.tasks;
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", priority: "MEDIUM", dueDate: "" });

  const params: Record<string, string> = {};
  if (statusFilter !== "ALL") params.status = statusFilter;
  if (priorityFilter !== "ALL") params.priority = priorityFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/tasks", statusFilter, priorityFilter],
    queryFn: () => api.getTasks(Object.keys(params).length ? params : undefined),
  });

  const { data: overdueTasks } = useQuery({
    queryKey: ["/api/tasks/overdue"],
    queryFn: () => api.getOverdueTasks(),
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof toCreateTaskPayload>[0]) =>
      editingId ? api.updateTask(editingId, toCreateTaskPayload(data)) : api.createTask(toCreateTaskPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/overdue"] });
      setShowCreate(false);
      setEditingId(null);
      setForm({ title: "", description: "", priority: "MEDIUM", dueDate: "" });
      toast({ title: editingId ? "Tarea actualizada" : "Tarea creada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/overdue"] });
      toast({ title: "Tarea eliminada" });
    },
    onError: (err: any) => {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.completeTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/overdue"] });
      toast({ title: "Tarea completada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const allTasks = Array.isArray(data) ? data : data?.data || [];
  const overdueList = Array.isArray(overdueTasks) ? overdueTasks : overdueTasks?.data || [];

  const taskList = search.trim()
    ? allTasks.filter((t: any) => t.title?.toLowerCase().includes(search.toLowerCase()))
    : allTasks;

  const openEdit = (task: any) => {
    setEditingId(task.id);
    setForm({
      title: task.title || "",
      description: task.description || "",
      priority: task.priority || "MEDIUM",
      dueDate: task.dueDate || task.due_date
        ? format(new Date(task.dueDate || task.due_date), "yyyy-MM-dd")
        : "",
    });
    setShowCreate(true);
  };

  return (
    <TooltipProvider>
      <div>
        <PageHeader title={t.title} description="Gestiona y da seguimiento a tus tareas">
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setEditingId(null);
              setForm({ title: "", description: "", priority: "MEDIUM", dueDate: "" });
              setShowCreate(true);
            }}
            data-testid="button-create-task"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Nueva tarea
          </Button>
        </PageHeader>

        {/* Overdue banner */}
        {overdueList.length > 0 && (
          <div className="flex items-center gap-2.5 mb-4 px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400" data-testid="alert-overdue">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs">
              Tienes <strong>{overdueList.length}</strong> tarea{overdueList.length > 1 ? "s" : ""} vencida{overdueList.length > 1 ? "s" : ""} que requieren atención.
            </span>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-[280px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar tareas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs bg-card border-border pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs bg-card border-border" data-testid="select-task-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "ALL" ? "Todo estado" : s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs bg-card border-border" data-testid="select-task-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p === "ALL" ? "Toda prioridad" : PRIORITY_LABELS[p] || p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(statusFilter !== "ALL" || priorityFilter !== "ALL" || search) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => { setStatusFilter("ALL"); setPriorityFilter("ALL"); setSearch(""); }}
            >
              Limpiar
            </Button>
          )}
        </div>

        {isLoading ? (
          <PageLoader />
        ) : taskList.length === 0 ? (
          <EmptyState icon={CheckSquare} title={t.noTasks} description="Crea una tarea para empezar." />
        ) : (
          <div className="rounded-lg border border-border overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-8" />
                  <TableHead className="text-[11px] text-muted-foreground font-medium">Título</TableHead>
                  <TableHead className="text-[11px] text-muted-foreground font-medium">Estado</TableHead>
                  <TableHead className="text-[11px] text-muted-foreground font-medium">Prioridad</TableHead>
                  <TableHead className="text-[11px] text-muted-foreground font-medium">Vencimiento</TableHead>
                  <TableHead className="text-[11px] text-muted-foreground font-medium">Asignado a</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {taskList.map((task: any) => {
                  const dueStr = task.dueDate || task.due_date || task.due_at;
                  const isOverdue = dueStr && isPast(new Date(dueStr)) && !isToday(new Date(dueStr)) && task.status !== "DONE";
                  const assigneeName = task.assignedTo?.firstName
                    ? `${task.assignedTo.firstName} ${task.assignedTo.lastName || ""}`.trim()
                    : task.assigned_to?.firstName
                    ? `${task.assigned_to.firstName} ${task.assigned_to.lastName || ""}`.trim()
                    : null;

                  return (
                    <TableRow
                      key={task.id}
                      className={cn("border-border hover:bg-white/[0.02]", isOverdue && "bg-red-500/5")}
                      data-testid={`task-row-${task.id}`}
                    >
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              disabled={task.status === "DONE" || completeMutation.isPending}
                              onClick={() => completeMutation.mutate(task.id)}
                              className={cn(
                                "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                                task.status === "DONE"
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                                  : "border-border hover:border-emerald-500/60 hover:bg-emerald-500/10 text-transparent hover:text-emerald-400"
                              )}
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{task.status === "DONE" ? "Completada" : "Marcar como completada"}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start gap-2">
                          <PriorityDot priority={task.priority} />
                          <div>
                            <div className={cn("text-sm font-medium", task.status === "DONE" ? "line-through text-muted-foreground" : "text-foreground")}>
                              {task.title}
                            </div>
                            {task.description && (
                              <div className="text-[11px] text-muted-foreground truncate max-w-[240px]">{task.description}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={task.status} type="task" />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {PRIORITY_LABELS[task.priority] || task.priority?.toLowerCase() || "—"}
                      </TableCell>
                      <TableCell>
                        <DueDateLabel dateStr={dueStr} />
                      </TableCell>
                      <TableCell>
                        {assigneeName ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-semibold text-muted-foreground shrink-0">
                              {getInitials(assigneeName)}
                            </div>
                            <span className="text-xs text-muted-foreground truncate max-w-[80px]">{assigneeName}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">Sin asignar</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-task-options-${task.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(task)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            {task.status !== "DONE" && (
                              <DropdownMenuItem onClick={() => completeMutation.mutate(task.id)}>
                                <Check className="w-4 h-4 mr-2" />
                                Marcar como completada
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => deleteMutation.mutate(task.id)}
                            >
                              <Trash className="w-4 h-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Create / Edit Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="bg-card border-border sm:max-w-[420px]" data-testid="dialog-create-task">
            <DialogHeader>
              <DialogTitle className="text-sm">{editingId ? "Editar tarea" : "Nueva tarea"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Título</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="h-8 text-xs bg-background border-border"
                  placeholder="¿Qué hay que hacer?"
                  data-testid="input-task-title"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Descripción <span className="text-muted-foreground/50">(opcional)</span></Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="h-8 text-xs bg-background border-border"
                  placeholder="Detalles adicionales..."
                  data-testid="input-task-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Prioridad</Label>
                  <Select value={form.priority} onValueChange={(val) => setForm({ ...form, priority: val })}>
                    <SelectTrigger className="h-8 text-xs bg-background border-border" data-testid="select-new-task-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                        <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Fecha límite</Label>
                  <Input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="h-8 text-xs bg-background border-border"
                    data-testid="input-task-due-date"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setShowCreate(false)} className="h-8 text-xs">
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => createMutation.mutate(form)}
                disabled={createMutation.isPending || !form.title.trim()}
                data-testid="button-save-task"
              >
                {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {editingId ? "Guardar cambios" : "Crear tarea"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
