import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useAuth, useRequireAuth } from "@/hooks/use-auth";
import { hasPermission, Permission } from "@/lib/permissions";
import { useI18n } from "@/components/providers/i18n-provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/arc/button/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskSheet } from "@/components/tasks/TaskSheet";
import {
  priorityLabels,
  statusLabels,
  taskForm,
  taskPayload,
  type TaskRecord,
  type TaskFormData,
} from "@/components/tasks/task-model";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { SearchInput } from "@/components/shared/search-input";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash,
} from "lucide-react";

type TaskPage = {
  data: TaskRecord[];
  meta: { total: number; page: number; pages: number };
};

export default function TasksPage() {
  useRequireAuth();
  const { user } = useAuth();
  const { locale } = useI18n();
  const es = locale === "es";
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(useSearch());
  const status = searchParams.get("status") ?? "ACTIVE";
  const priority = searchParams.get("priority") ?? "ALL";
  const query = searchParams.get("q") ?? "";
  const requestedPage = Number(searchParams.get("page"));
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const [search, setSearch] = useState(query);
  useEffect(() => setSearch(query), [query]);
  const canManage = hasPermission(
    user?.role ?? "",
    Permission.TASKS_MANAGE,
    !!user?.is_platform_admin,
  );
  const [editor, setEditor] = useState<{
    task: TaskRecord | null;
    key: number;
  } | null>(null);
  const [deleting, setDeleting] = useState<TaskRecord | null>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  function filters(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    next.delete("page");
    for (const [key, value] of Object.entries(changes)) {
      if (value && value !== "ACTIVE" && value !== "ALL") next.set(key, value);
      else next.delete(key);
    }
    navigate("/tasks" + (next.size ? "?" + next.toString() : ""));
  }

  const params: Record<string, string> = { page: String(page), limit: "20" };
  if (status === "OVERDUE") params.overdue = "true";
  else if (status !== "ACTIVE" && statusLabels[locale][status])
    params.status = status;
  if (priority in priorityLabels[locale]) params.priority = priority;
  if (query) params.q = query;

  const tasks = useQuery({
    queryKey: ["/api/tasks", user?.workspace.id, params],
    queryFn: () => api.getTasks(params) as unknown as Promise<TaskPage>,
    enabled: canManage,
  });
  const overdue = useQuery({
    queryKey: ["/api/tasks/overdue", user?.workspace.id],
    queryFn: () => api.getOverdueTasks(),
    enabled: canManage,
  });
  const members = useQuery({
    queryKey: ["/api/workspaces/current/members", user?.workspace.id],
    queryFn: api.getMembers,
    enabled: canManage && !!editor,
  });

  function refreshTasks() {
    void queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/tasks/overdue"] });
  }
  function restoreFocus() {
    requestAnimationFrame(() => {
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
      else createButton.current?.focus();
    });
  }
  const save = useMutation({
    mutationFn: (form: TaskFormData) =>
      editor?.task
        ? api.updateTask(editor.task.id, taskPayload(form, editor.task))
        : api.createTask(taskPayload(form)),
    onSuccess: () => {
      refreshTasks();
      setEditor(null);
      restoreFocus();
      toast({ title: es ? "Tarea guardada" : "Task saved" });
    },
  });
  const complete = useMutation({
    mutationFn: (id: string) => api.completeTask(id),
    onSuccess: () => {
      refreshTasks();
      toast({ title: es ? "Tarea completada" : "Task completed" });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => {
      refreshTasks();
      setDeleting(null);
      createButton.current?.focus();
      toast({ title: es ? "Tarea eliminada" : "Task deleted" });
    },
  });
  function openEditor(task: TaskRecord | null, trigger?: HTMLElement) {
    returnFocus.current = trigger ?? (document.activeElement as HTMLElement);
    save.reset();
    setEditor({ task, key: Date.now() });
  }

  const list = tasks.data?.data ?? [];
  const meta = tasks.data?.meta;
  const hasFilters = status !== "ACTIVE" || priority !== "ALL" || !!query;
  const memberList = Array.isArray(members.data)
    ? members.data
    : (members.data?.data ?? []);
  const priorityText = (value: string) =>
    priorityLabels[locale][value as keyof typeof priorityLabels.es] ?? value;

  function taskDate(task: TaskRecord) {
    if (!task.due_at) return es ? "Sin fecha" : "No due date";
    const date = new Date(task.due_at);
    if (!Number.isFinite(date.getTime()))
      return es ? "Fecha no disponible" : "Date unavailable";
    const label = new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
    const late =
      date.getTime() < Date.now() &&
      !["DONE", "ARCHIVED", "CANCELLED"].includes(task.status);
    return late ? (es ? "Vencida · " : "Overdue · ") + label : label;
  }
  function completeButton(task: TaskRecord) {
    const busy = complete.isPending && complete.variables === task.id;
    const done = task.status === "DONE";
    return (
      <Button
        type="button"
        variant="secondary"
        className="mobile-tab h-11 w-11 shrink-0 rounded-full p-0"
        aria-label={
          (done
            ? es
              ? "Completada: "
              : "Completed: "
            : es
              ? "Completar: "
              : "Complete: ") + task.title
        }
        disabled={
          done ||
          complete.isPending ||
          task.status === "ARCHIVED" ||
          task.status === "CANCELLED"
        }
        onClick={() => {
          complete.reset();
          complete.mutate(task.id);
        }}
      >
        {busy ? (
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
        ) : (
          <Check
            aria-hidden="true"
            className={
              "h-5 w-5 " + (done ? "text-foreground" : "text-muted-foreground")
            }
          />
        )}
      </Button>
    );
  }
  function options(task: TaskRecord) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-11 w-11 shrink-0 rounded-xl p-0"
            aria-label={(es ? "Opciones: " : "Options: ") + task.title}
            data-testid={"button-task-options-" + task.id}
          >
            <MoreHorizontal aria-hidden="true" className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="app-overlay min-w-48"
          align="end"
        >
          <DropdownMenuItem
            className="min-h-11"
            onSelect={() => openEditor(task)}
          >
            <Pencil aria-hidden="true" className="mr-2 h-4 w-4" />
            {es ? "Editar" : "Edit"}
          </DropdownMenuItem>
          {!["DONE", "ARCHIVED", "CANCELLED"].includes(task.status) && (
            <DropdownMenuItem
              disabled={complete.isPending}
              className="min-h-11"
              onSelect={() => complete.mutate(task.id)}
            >
              <Check aria-hidden="true" className="mr-2 h-4 w-4" />
              {es ? "Completar tarea" : "Complete task"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="min-h-11 text-destructive focus:text-destructive"
            onSelect={() => {
              remove.reset();
              setDeleting(task);
            }}
          >
            <Trash aria-hidden="true" className="mr-2 h-4 w-4" />
            {es ? "Eliminar" : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (!canManage)
    return (
      <div className="mx-auto max-w-xl space-y-3 px-4 py-8">
        <h1 className="text-2xl font-bold">{es ? "Tareas" : "Tasks"}</h1>
        <p>
          {es
            ? "Tu rol no permite gestionar tareas en este espacio. Consulta con quien lo administra."
            : "Your role cannot manage tasks in this workspace. Contact your workspace administrator."}
        </p>
      </div>
    );

  return (
    <div className="task-page mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {es ? "Tareas" : "Tasks"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {es ? "Lo que sigue para tu equipo." : "What's next for your team."}
          </p>
        </div>
        <Button
          ref={createButton}
          className="mobile-tab min-h-12 rounded-2xl"
          onClick={(event) => openEditor(null, event.currentTarget)}
          data-testid="button-create-task"
        >
          <Plus aria-hidden="true" className="h-5 w-5" />
          {es ? "Nueva tarea" : "New task"}
        </Button>
      </header>

      {Number(overdue.data?.total_overdue) > 0 && (
        <button
          type="button"
          className="mobile-tab flex min-h-14 w-full items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-left"
          onClick={() => filters({ status: "OVERDUE" })}
          data-testid="alert-overdue"
        >
          <AlertTriangle
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-destructive"
          />
          <span className="flex-1 text-sm">
            <strong>{overdue.data?.total_overdue}</strong>{" "}
            {es
              ? Number(overdue.data?.total_overdue) === 1
                ? "tarea vencida · Revisar"
                : "tareas vencidas · Revisar"
              : Number(overdue.data?.total_overdue) === 1
                ? "overdue task · Review"
                : "overdue tasks · Review"}
          </span>
          <ChevronRight aria-hidden="true" className="h-5 w-5" />
        </button>
      )}
      {overdue.isError && (
        <div role="status" className="text-sm text-muted-foreground">
          {es
            ? "No se pudieron comprobar las tareas vencidas."
            : "Overdue tasks could not be checked."}
          <Button
            variant="ghost"
            className="min-h-11"
            onClick={() => void overdue.refetch()}
          >
            {es ? "Revisar de nuevo" : "Check again"}
          </Button>
        </div>
      )}

      <section
        aria-label={es ? "Filtrar tareas" : "Filter tasks"}
        className="space-y-3"
      >
        <form
          className="flex gap-2"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            filters({ q: search.trim() });
          }}
        >
          <SearchInput
            name="search"
            autoComplete="off"
            aria-label={es ? "Buscar tareas" : "Search tasks"}
            placeholder={
              es
                ? "Buscar por título o descripción…"
                : "Search title or description…"
            }
            value={search}
            onValueChange={setSearch}
            wrapperClassName="min-w-0 flex-1"
            className="min-h-12 rounded-2xl bg-card pl-11 text-base"
            iconClassName="left-4 h-5 w-5"
            clearLabel={es ? "Limpiar búsqueda" : "Clear search"}
          />
          <Button
            type="submit"
            variant="secondary"
            className="min-h-12 rounded-2xl"
          >
            {es ? "Buscar" : "Search"}
          </Button>
        </form>
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          aria-label={es ? "Estados frecuentes" : "Common statuses"}
        >
          {["ACTIVE", "IN_PROGRESS", "DONE"].map((value) => (
            <Button
              key={value}
              type="button"
              variant={status === value ? "primary" : "secondary"}
              className="mobile-tab min-h-11 shrink-0 rounded-full px-4"
              aria-pressed={status === value}
              onClick={() => filters({ status: value })}
            >
              {statusLabels[locale][value]}
            </Button>
          ))}
        </div>
        <details
          className="rounded-xl border border-border px-3"
          open={
            priority !== "ALL" ||
            !["ACTIVE", "IN_PROGRESS", "DONE"].includes(status)
              ? true
              : undefined
          }
        >
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
            {es ? "Más filtros" : "More filters"}
            {priority !== "ALL" ? ` · ${priorityText(priority)}` : ""}
          </summary>
          <div className="grid grid-cols-2 gap-3 pb-3">
            <label className="space-y-1 text-sm">
              <span>{es ? "Estado" : "Status"}</span>
              <select
                value={status}
                className="min-h-12 w-full rounded-xl border border-border bg-card px-3 text-base text-foreground"
                onChange={(event) => filters({ status: event.target.value })}
                data-testid="select-task-status"
              >
                {Object.entries(statusLabels[locale]).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>{es ? "Prioridad" : "Priority"}</span>
              <select
                value={priority}
                className="min-h-12 w-full rounded-xl border border-border bg-card px-3 text-base text-foreground"
                onChange={(event) => filters({ priority: event.target.value })}
                data-testid="select-task-priority"
              >
                <option value="ALL">{es ? "Todas" : "All"}</option>
                {Object.entries(priorityLabels[locale]).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
        </details>
        {hasFilters && (
          <Button
            variant="ghost"
            className="min-h-11"
            onClick={() => {
              setSearch("");
              navigate("/tasks");
            }}
          >
            {es ? "Limpiar filtros" : "Clear filters"}
          </Button>
        )}
      </section>

      {complete.error && (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/40 p-4 text-sm"
        >
          <p>{complete.error.message}</p>
          <Button
            variant="secondary"
            className="mt-2 min-h-11"
            disabled={complete.isPending}
            onClick={() =>
              complete.variables && complete.mutate(complete.variables)
            }
          >
            {es ? "Reintentar completar" : "Retry completion"}
          </Button>
        </div>
      )}
      {tasks.isLoading ? (
        <div role="status" className="space-y-3">
          <span className="sr-only">
            {es ? "Cargando tareas…" : "Loading tasks…"}
          </span>
          {[0, 1, 2].map((value) => (
            <Skeleton key={value} className="h-36 rounded-3xl" />
          ))}
        </div>
      ) : tasks.isError ? (
        <div
          role="alert"
          className="space-y-3 rounded-3xl border border-border p-5"
        >
          <h2 className="font-semibold">
            {es
              ? "No se pudieron cargar las tareas"
              : "Tasks could not be loaded"}
          </h2>
          <p className="text-sm text-muted-foreground">{tasks.error.message}</p>
          <Button
            variant="secondary"
            className="min-h-11"
            onClick={() => void tasks.refetch()}
          >
            {es ? "Reintentar" : "Try again"}
          </Button>
        </div>
      ) : (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            {tasks.isFetching
              ? es
                ? "Actualizando…"
                : "Updating…"
              : `${meta?.total ?? list.length} ${es ? "tareas" : "tasks"}`}
          </p>
          {list.length === 0 ? (
            <div className="space-y-3 rounded-3xl border border-border bg-card p-6 text-center">
              <CheckSquare
                aria-hidden="true"
                className="mx-auto h-8 w-8 text-muted-foreground"
              />
              <h2 className="text-lg font-semibold">
                {hasFilters
                  ? es
                    ? "Sin coincidencias"
                    : "No matches"
                  : es
                    ? "Todo despejado por aquí"
                    : "All clear here"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {hasFilters
                  ? es
                    ? "Prueba otra búsqueda o cambia los filtros."
                    : "Try another search or change the filters."
                  : es
                    ? "Crea una tarea para organizar lo que sigue."
                    : "Create a task to organize what's next."}
              </p>
            </div>
          ) : (
            <>
              <ul
                className="space-y-3 md:hidden"
                aria-label={es ? "Lista de tareas" : "Task list"}
              >
                {list.map((task) => (
                  <li
                    key={task.id}
                    className="rounded-3xl border border-border bg-card p-4"
                    data-testid={"task-card-" + task.id}
                  >
                    <div className="flex items-start gap-3">
                      {completeButton(task)}
                      <button
                        className="min-h-11 min-w-0 flex-1 rounded-lg text-left"
                        onClick={(event) =>
                          openEditor(task, event.currentTarget)
                        }
                      >
                        <h2
                          className={
                            "break-words text-base font-semibold " +
                            (task.status === "DONE"
                              ? "line-through text-muted-foreground"
                              : "")
                          }
                        >
                          {task.title}
                        </h2>
                      </button>
                      {options(task)}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-muted px-3 py-1.5">
                        {statusLabels[locale][task.status] ?? task.status}
                      </span>
                      <span className="rounded-full border border-border px-3 py-1.5">
                        {priorityText(task.priority)}
                      </span>
                    </div>
                    {task.description && (
                      <details className="mt-3 text-sm">
                        <summary className="flex min-h-11 cursor-pointer items-center rounded-lg text-muted-foreground">
                          {es ? "Ver detalles" : "View details"}
                        </summary>
                        <div className="break-words py-2">
                          <MarkdownRenderer content={task.description} />
                        </div>
                      </details>
                    )}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <Calendar aria-hidden="true" className="h-4 w-4" />
                        {taskDate(task)}
                      </span>
                      <span className="break-words">
                        {task.assigned_user?.name ??
                          (es ? "Sin asignar" : "Unassigned")}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <span className="sr-only">
                          {es ? "Completar" : "Complete"}
                        </span>
                      </TableHead>
                      <TableHead>{es ? "Tarea" : "Task"}</TableHead>
                      <TableHead>{es ? "Estado" : "Status"}</TableHead>
                      <TableHead>{es ? "Prioridad" : "Priority"}</TableHead>
                      <TableHead>{es ? "Vencimiento" : "Due date"}</TableHead>
                      <TableHead>{es ? "Responsable" : "Assignee"}</TableHead>
                      <TableHead>
                        <span className="sr-only">
                          {es ? "Opciones" : "Options"}
                        </span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((task) => (
                      <TableRow
                        key={task.id}
                        data-testid={"task-row-" + task.id}
                      >
                        <TableCell>{completeButton(task)}</TableCell>
                        <TableCell>
                          <button
                            className="min-h-11 max-w-sm break-words text-left font-medium"
                            onClick={(event) =>
                              openEditor(task, event.currentTarget)
                            }
                          >
                            {task.title}
                          </button>
                          {task.description && (
                            <details>
                              <summary className="min-h-11 cursor-pointer py-3 text-muted-foreground">
                                {es ? "Ver detalles" : "View details"}
                              </summary>
                              <MarkdownRenderer content={task.description} />
                            </details>
                          )}
                        </TableCell>
                        <TableCell>
                          {statusLabels[locale][task.status] ?? task.status}
                        </TableCell>
                        <TableCell>{priorityText(task.priority)}</TableCell>
                        <TableCell>{taskDate(task)}</TableCell>
                        <TableCell>
                          {task.assigned_user?.name ??
                            (es ? "Sin asignar" : "Unassigned")}
                        </TableCell>
                        <TableCell>{options(task)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
          {meta && (meta.pages > 1 || page > 1) && (
            <nav
              aria-label={es ? "Páginas de tareas" : "Task pages"}
              className="flex items-center justify-between gap-3"
            >
              <Button
                variant="secondary"
                className="min-h-11"
                disabled={page <= 1 || tasks.isFetching}
                onClick={() => filters({ page: String(page - 1) })}
              >
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                {es ? "Anterior" : "Previous"}
              </Button>
              <span className="text-sm tabular-nums">
                {page} / {Math.max(1, meta.pages)}
              </span>
              <Button
                variant="secondary"
                className="min-h-11"
                disabled={page >= meta.pages || tasks.isFetching}
                onClick={() => filters({ page: String(page + 1) })}
              >
                {es ? "Siguiente" : "Next"}
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </Button>
            </nav>
          )}
        </>
      )}

      {editor && (
        <TaskSheet
          key={editor.key}
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditor(null);
              restoreFocus();
            }
          }}
          editingId={editor.task?.id ?? null}
          initialData={taskForm(editor.task)}
          onSave={(form) => save.mutate(form)}
          isSaving={save.isPending}
          error={save.error?.message}
          members={memberList}
          membersLoading={members.isLoading}
          membersError={members.isError}
          onRetryMembers={() => void members.refetch()}
        />
      )}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(null);
        }}
      >
        <AlertDialogContent className="app-overlay w-[calc(100%-32px)] rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {es ? "¿Eliminar esta tarea?" : "Delete this task?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              {deleting?.title}.{" "}
              {es
                ? "Esta acción no se puede deshacer."
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {remove.error && (
            <p role="alert" className="text-sm text-destructive">
              {remove.error.message}
            </p>
          )}
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={remove.isPending} className="min-h-11">
              {es ? "Cancelar" : "Cancel"}
            </AlertDialogCancel>
            <Button
              variant="danger"
              disabled={remove.isPending}
              className="min-h-11"
              onClick={() => deleting && remove.mutate(deleting.id)}
            >
              {remove.isPending
                ? es
                  ? "Eliminando…"
                  : "Deleting…"
                : es
                  ? "Eliminar tarea"
                  : "Delete task"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
