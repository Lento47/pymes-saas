export interface TaskRecord {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  due_at?: string | null;
  assigned_user_id?: string | null;
  assigned_user?: { id: string; name: string } | null;
}

export interface TaskFormData {
  title: string;
  description: string;
  priority: string;
  dueDate: string;
  assignedUserId: string;
}

export const priorityLabels = {
  es: { LOW: "Baja", MEDIUM: "Media", HIGH: "Alta", URGENT: "Urgente" },
  en: { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" },
};
export const statusLabels: Record<"es" | "en", Record<string, string>> = {
  es: {
    ACTIVE: "Pendientes",
    TODO: "Por hacer",
    IN_PROGRESS: "En progreso",
    BLOCKED: "Bloqueadas",
    DONE: "Completadas",
    OVERDUE: "Vencidas",
    CANCELLED: "Canceladas",
    ARCHIVED: "Archivadas",
  },
  en: {
    ACTIVE: "Pending",
    TODO: "To do",
    IN_PROGRESS: "In progress",
    BLOCKED: "Blocked",
    DONE: "Completed",
    OVERDUE: "Overdue",
    CANCELLED: "Cancelled",
    ARCHIVED: "Archived",
  },
};

export function taskDateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function taskForm(task?: TaskRecord | null): TaskFormData {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    priority: task?.priority ?? "MEDIUM",
    dueDate: taskDateInput(task?.due_at),
    assignedUserId: task?.assigned_user_id ?? "",
  };
}

export function taskPayload(form: TaskFormData, original?: TaskRecord | null) {
  const payload: Record<string, string | null> = {
    title: form.title.trim(),
    description: form.description.trim(),
    priority: form.priority,
  };
  if (form.assignedUserId) payload.assigned_user_id = form.assignedUserId;
  else if (original?.assigned_user_id) payload.assigned_user_id = null;
  if (form.dueDate && form.dueDate !== taskDateInput(original?.due_at)) {
    // A date-only choice is local noon; unrelated edits preserve the exact saved instant.
    payload.due_at = new Date(`${form.dueDate}T12:00:00`).toISOString();
  } else if (!form.dueDate && original?.due_at) payload.due_at = null;
  return payload;
}
