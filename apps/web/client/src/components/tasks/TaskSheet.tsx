import { useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import { priorityLabels, type TaskFormData } from "./task-model";

export type { TaskFormData } from "./task-model";

interface TaskSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  initialData: TaskFormData;
  onSave: (data: TaskFormData) => void;
  isSaving: boolean;
  members: { id: string; name?: string; user?: { id: string; name: string } }[];
  membersLoading?: boolean;
  membersError?: boolean;
  onRetryMembers?: () => void;
  error?: string;
}

export function TaskSheet(props: TaskSheetProps) {
  return props.open ? (
    <TaskSheetForm key={props.editingId ?? "new"} {...props} />
  ) : null;
}

function TaskSheetForm({
  open,
  onOpenChange,
  editingId,
  initialData,
  onSave,
  isSaving,
  members,
  membersLoading,
  membersError,
  onRetryMembers,
  error,
}: TaskSheetProps) {
  const { locale } = useI18n();
  const es = locale === "es";
  const mobile = useIsMobile();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const [form, setForm] = useState(initialData);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initialData);
  const set = (key: keyof TaskFormData, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  useEffect(() => {
    if (confirmDiscard) {
      keepEditingRef.current?.scrollIntoView({
        block: "center",
        behavior: "instant",
      });
      keepEditingRef.current?.focus({ preventScroll: true });
    }
  }, [confirmDiscard]);

  useEffect(() => {
    if (!dirty || !open) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, open]);

  function close(next: boolean) {
    if (isSaving) return;
    if (!next && dirty) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(next);
  }

  const fieldClass =
    "min-h-12 w-full rounded-xl border border-border bg-card px-3 text-base text-foreground";
  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent
        side={mobile ? "bottom" : "right"}
        closeLabel={es ? "Cerrar" : "Close"}
        closeDisabled={isSaving}
        className="app-overlay task-editor flex max-h-[92dvh] w-full flex-col gap-0 rounded-t-3xl p-0 md:h-full md:max-h-none md:w-[520px] md:max-w-[520px] md:rounded-none"
        onOpenAutoFocus={(event) => {
          if (mobile) {
            event.preventDefault();
            titleRef.current?.focus();
          }
        }}
      >
        <SheetHeader className="shrink-0 border-b border-border px-5 py-5 pr-16 text-left">
          <SheetTitle ref={titleRef} tabIndex={-1} className="text-2xl">
            {editingId
              ? es
                ? "Editar tarea"
                : "Edit task"
              : es
                ? "Nueva tarea"
                : "New task"}
          </SheetTitle>
          <SheetDescription>
            {es
              ? "Define qué hay que hacer y quién se encarga."
              : "Set what needs doing and who is responsible."}
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            if (isSaving) return;
            const title = event.currentTarget.elements.namedItem(
              "title",
            ) as HTMLInputElement;
            title.setCustomValidity(
              form.title.trim()
                ? ""
                : es
                  ? "Escribe un título."
                  : "Enter a title.",
            );
            if (title.reportValidity()) onSave(form);
          }}
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5">
            {confirmDiscard && (
              <div
                role="alert"
                className="space-y-3 rounded-2xl border border-border bg-muted p-4"
              >
                <p className="font-semibold">
                  {es
                    ? "¿Descartar los cambios sin guardar?"
                    : "Discard unsaved changes?"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    ref={keepEditingRef}
                    type="button"
                    variant="secondary"
                    className="min-h-11"
                    onClick={() => {
                      setConfirmDiscard(false);
                      titleRef.current?.focus();
                    }}
                  >
                    {es ? "Seguir editando" : "Keep editing"}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    className="min-h-11"
                    onClick={() => onOpenChange(false)}
                  >
                    {es ? "Descartar" : "Discard"}
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Input
                label={es ? "Título" : "Title"}
                name="title"
                autoComplete="off"
                required
                maxLength={255}
                value={form.title}
                disabled={isSaving}
                onChange={(event) => {
                  event.target.setCustomValidity("");
                  set("title", event.target.value);
                }}
                placeholder={es ? "¿Qué hay que hacer?" : "What needs doing?"}
                className={fieldClass}
                data-testid="input-task-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">
                {es ? "Descripción (opcional)" : "Description (optional)"}
              </Label>
              <textarea
                id="task-description"
                name="description"
                autoComplete="off"
                value={form.description}
                disabled={isSaving}
                onChange={(event) => set("description", event.target.value)}
                rows={3}
                className={fieldClass + " resize-y py-3"}
                data-testid="input-task-description"
              />
            </div>
            <fieldset disabled={isSaving}>
              <legend className="mb-2 text-sm font-medium">
                {es ? "Prioridad" : "Priority"}
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.entries(priorityLabels[locale]).map(
                  ([value, label]) => (
                    <label
                      key={value}
                      className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                    >
                      <input
                        type="radio"
                        name="priority"
                        value={value}
                        checked={form.priority === value}
                        onChange={() => set("priority", value)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ),
                )}
              </div>
            </fieldset>
            <div className="space-y-2">
              <Input
                label={
                  es ? "Fecha de vencimiento (opcional)" : "Due date (optional)"
                }
                name="dueDate"
                type="date"
                value={form.dueDate}
                disabled={isSaving}
                onChange={(event) => set("dueDate", event.target.value)}
                className={fieldClass}
                data-testid="input-task-due-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-assignee">
                {es ? "Responsable" : "Assignee"}
              </Label>
              <select
                id="task-assignee"
                name="assignee"
                value={form.assignedUserId}
                disabled={isSaving || membersLoading || membersError}
                onChange={(event) => set("assignedUserId", event.target.value)}
                className={fieldClass}
              >
                <option value="">{es ? "Sin asignar" : "Unassigned"}</option>
                {form.assignedUserId &&
                  !members.some(
                    (member) =>
                      (member.user?.id ?? member.id) === form.assignedUserId,
                  ) && (
                    <option value={form.assignedUserId}>
                      {es ? "Responsable actual" : "Current assignee"}
                    </option>
                  )}
                {members.map((member) => (
                  <option
                    key={member.user?.id ?? member.id}
                    value={member.user?.id ?? member.id}
                  >
                    {member.user?.name ?? member.name}
                  </option>
                ))}
              </select>
              {membersLoading && (
                <p role="status" className="text-sm text-muted-foreground">
                  {es ? "Cargando responsables…" : "Loading assignees…"}
                </p>
              )}
              {membersError && (
                <div className="text-sm">
                  <p role="status">
                    {es
                      ? "No se pudieron cargar los responsables."
                      : "Assignees could not be loaded."}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11"
                    onClick={onRetryMembers}
                  >
                    {es ? "Reintentar" : "Try again"}
                  </Button>
                </div>
              )}
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <SheetFooter className="shrink-0 flex-row items-center justify-between gap-3 border-t border-border px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              variant="secondary"
              disabled={isSaving}
              className="min-h-12 rounded-xl"
              onClick={() => close(false)}
            >
              {es ? "Cancelar" : "Cancel"}
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="min-h-12 rounded-xl"
              data-testid="button-save-task"
            >
              {isSaving && (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              )}
              {isSaving
                ? es
                  ? "Guardando…"
                  : "Saving…"
                : editingId
                  ? es
                    ? "Guardar cambios"
                    : "Save changes"
                  : es
                    ? "Crear tarea"
                    : "Create task"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
