import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { PriorityDot } from "@/components/shared/priority-dot";
import { EmptyState } from "@/components/shared/empty-state";
import { PageLoader } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckSquare, Plus, AlertTriangle, Check, Loader2, MoreHorizontal, Pencil, Trash } from "lucide-react";
import { format } from "date-fns";

function toCreateTaskPayload(form: {
  title: string;
  description: string;
  priority: string;
  dueDate: string;
}) {
  const body: Record<string, string> = {
    title: form.title.trim(),
  };
  if (form.description?.trim()) body.description = form.description.trim();
  if (form.priority) body.priority = form.priority;
  if (form.dueDate) {
    body.due_at = `${form.dueDate}T12:00:00.000Z`;
  }
  return body;
}

const STATUS_OPTIONS = ["ALL", "TODO", "IN_PROGRESS", "BLOCKED", "DONE"];
const PRIORITY_OPTIONS = ["ALL", "LOW", "MEDIUM", "HIGH", "URGENT"];

export default function TasksPage() {
  useRequireAuth();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
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
      toast({ title: editingId ? "Task updated" : "Task created" });
    },
    onError: (err: any) => {
      toast({ title: editingId ? "Failed to update task" : "Failed to create task", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/overdue"] });
      toast({ title: "Task deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete task", description: err.message, variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.completeTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/overdue"] });
      toast({ title: "Task completed" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to complete task", description: err.message, variant: "destructive" });
    },
  });

  const taskList = Array.isArray(data) ? data : data?.data || [];
  const overdueList = Array.isArray(overdueTasks) ? overdueTasks : overdueTasks?.data || [];

  return (
    <div>
      <PageHeader title="Tasks" description="Track and manage your tasks">
        <Button size="sm" className="h-8 text-xs" onClick={() => {
          setEditingId(null);
          setForm({ title: "", description: "", priority: "MEDIUM", dueDate: "" });
          setShowCreate(true);
        }} data-testid="button-create-task">
          <Plus className="w-3.5 h-3.5 mr-1.5" /> New Task
        </Button>
      </PageHeader>

      {/* Overdue alert */}
      {overdueList.length > 0 && (
        <Alert className="mb-4 bg-red-500/10 border-red-500/20 text-red-400" data-testid="alert-overdue">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription className="text-xs">
            You have {overdueList.length} overdue task{overdueList.length > 1 ? "s" : ""} that need attention.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-2 mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs bg-card border-border" data-testid="select-task-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s === "ALL" ? "All Status" : s.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs bg-card border-border" data-testid="select-task-priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map((p) => (
              <SelectItem key={p} value={p}>{p === "ALL" ? "All Priority" : p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : taskList.length === 0 ? (
        <EmptyState icon={CheckSquare} title="No tasks" description="Create a task to get started." />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[11px] text-muted-foreground font-medium w-8"></TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium">Title</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium">Status</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium">Priority</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium">Due Date</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium">Assigned To</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taskList.map((task: any) => (
                <TableRow key={task.id} className="border-border hover:bg-white/[0.02]" data-testid={`task-row-${task.id}`}>
                  <TableCell>
                    <PriorityDot priority={task.priority} />
                  </TableCell>
                  <TableCell className="text-sm text-foreground font-medium">{task.title}</TableCell>
                  <TableCell>
                    <StatusBadge status={task.status} type="task" />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground capitalize">{task.priority?.toLowerCase()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {task.dueDate || task.due_date
                      ? format(new Date(task.dueDate || task.due_date), "MMM d, yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {task.assignedTo?.firstName || task.assigned_to?.firstName || "Unassigned"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-task-options-${task.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setEditingId(task.id);
                          setForm({
                            title: task.title || "",
                            description: task.description || "",
                            priority: task.priority || "MEDIUM",
                            dueDate: task.dueDate || task.due_date ? format(new Date(task.dueDate || task.due_date), "yyyy-MM-dd") : ""
                          });
                          setShowCreate(true);
                        }}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit Task
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteMutation.mutate(task.id)}>
                          <Trash className="w-4 h-4 mr-2" />
                          Delete Task
                        </DropdownMenuItem>
                        {task.status !== "DONE" && (
                          <DropdownMenuItem onClick={() => completeMutation.mutate(task.id)}>
                            <Check className="w-4 h-4 mr-2" />
                            Mark as Done
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit Task Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => {
        if (!open) {
          setShowCreate(false);
          // Don't clear immediately to avoid flashing, state reset on reopen
        } else {
          setShowCreate(true);
        }
      }}>
        <DialogContent className="bg-card border-border sm:max-w-[420px]" data-testid="dialog-create-task">
          <DialogHeader>
            <DialogTitle className="text-sm">{editingId ? "Edit Task" : "New Task"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-8 text-xs bg-background border-border" data-testid="input-task-title" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="h-8 text-xs bg-background border-border" data-testid="input-task-description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Priority</Label>
                <Select value={form.priority} onValueChange={(val) => setForm({ ...form, priority: val })}>
                  <SelectTrigger className="h-8 text-xs bg-background border-border" data-testid="select-new-task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Due Date</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="h-8 text-xs bg-background border-border" data-testid="input-task-due-date" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)} className="h-8 text-xs">Cancel</Button>
            <Button size="sm" className="h-8 text-xs" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.title} data-testid="button-save-task">
              {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {editingId ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
