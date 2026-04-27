import { useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";

const PRIORITIES = [
  { value: "LOW", label: "Baja", color: "bg-slate-500" },
  { value: "MEDIUM", label: "Media", color: "bg-yellow-500" },
  { value: "HIGH", label: "Alta", color: "bg-orange-500" },
  { value: "URGENT", label: "Urgente", color: "bg-red-500" },
] as const;

export interface TaskFormData {
  title: string;
  description: string;
  priority: string;
  dueDate: string;
}

interface TaskSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  initialData: TaskFormData;
  onSave: (data: TaskFormData) => void;
  isSaving: boolean;
}

export function TaskSheet({ open, onOpenChange, editingId, initialData, onSave, isSaving }: TaskSheetProps) {
  const { messages } = useI18n();
  const t = messages.tasks;
  const isEdit = !!editingId;

  const [form, setForm] = useState<TaskFormData>(initialData);
  const set = (key: keyof TaskFormData, value: string) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = () => {
    if (!form.title.trim()) return;
    onSave(form);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[520px] sm:max-w-[520px] p-0 gap-0 flex flex-col h-full">
        <SheetHeader className="px-6 py-4 border-b border-border/60 space-y-1 shrink-0">
          <SheetTitle className="text-sm font-semibold">
            {isEdit ? "Editar tarea" : "Nueva tarea"}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">{t.name} <span className="text-red-400">*</span></Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="¿Qué hay que hacer?"
              className="h-9 text-xs bg-background border-border"
              autoFocus
              data-testid="input-task-title"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Descripción <span className="text-muted-foreground/40">(opcional)</span></Label>
            <Input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Detalles adicionales..."
              className="h-9 text-xs bg-background border-border"
              data-testid="input-task-description"
            />
          </div>

          {/* Priority cards */}
          <div className="space-y-2">
            <Label className="text-[11px] text-muted-foreground">{t.priority}</Label>
            <div className="grid grid-cols-4 gap-2">
              {PRIORITIES.map((p) => {
                const isSelected = form.priority === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => set("priority", p.value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-center transition-all duration-200",
                      isSelected
                        ? "border-violet-500/50 bg-violet-500/[0.06] ring-1 ring-violet-500/20"
                        : "border-border/60 bg-card/40 hover:bg-accent/40 hover:border-border"
                    )}
                  >
                    <div className={cn("w-3 h-3 rounded-full", p.color)} />
                    <span className="text-[11px] font-medium text-foreground">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">{t.dueDate}</Label>
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => set("dueDate", e.target.value)}
              className="h-9 text-xs bg-background border-border"
              data-testid="input-task-due-date"
            />
          </div>
        </div>

        <SheetFooter className="px-6 py-3 border-t border-border/60 shrink-0 flex-row justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isSaving} className="h-8 text-xs">
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !form.title.trim()}
            className="h-8 text-xs gap-1.5"
            data-testid="button-save-task"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEdit ? "Guardar cambios" : "Crear tarea"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
