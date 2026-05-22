import { Check, Bell, Flag, CircleDot, UserPlus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { value: "notify_in_app", icon: Bell, label: "Notificar en app", desc: "Envía una notificación interna al usuario configurado" },
  { value: "set_priority", icon: Flag, label: "Cambiar prioridad", desc: "Modifica la prioridad de la conversación o tarea" },
  { value: "set_status", icon: CircleDot, label: "Cambiar estado", desc: "Actualiza el estado de la conversación o tarea" },
  { value: "assign", icon: UserPlus, label: "Asignar agente", desc: "Asigna la conversación o tarea a un miembro" },
  { value: "create_task", icon: Check, label: "Crear tarea", desc: "Genera una nueva tarea en el workspace" },
] as const;

const PRIORITIES = [
  { value: "LOW", label: "Baja" },
  { value: "MEDIUM", label: "Media" },
  { value: "HIGH", label: "Alta" },
  { value: "URGENT", label: "Urgente" },
] as const;

const STATUSES = [
  { value: "NEW", label: "Nuevo" },
  { value: "OPEN", label: "Abierto" },
  { value: "PENDING", label: "Pendiente" },
  { value: "RESOLVED", label: "Resuelto" },
  { value: "ARCHIVED", label: "Archivado" },
] as const;

interface ActionSelectorProps {
  value: string;
  onChange: (v: string) => void;
  actionValue: string;
  onActionValueChange: (v: string) => void;
  members: Record<string, any>[];
}

export function ActionSelector({ value, onChange, actionValue, onActionValueChange, members }: ActionSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 block">
          ¿Qué acción realizar?
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            const isSelected = value === a.value;
            return (
              <button
                key={a.value}
                type="button"
                onClick={() => onChange(a.value)}
                className={cn(
                  "relative flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors",
                  isSelected
                    ? "border-primary/45 bg-primary/5"
                    : "border-border/60 bg-card/40 hover:bg-accent/40 hover:border-border"
                )}
              >
                {isSelected && (
                  <div className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                    <Check className="h-2.5 w-2.5 text-primary-foreground" />
                  </div>
                )}
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center",
                  isSelected ? "bg-primary/10" : "bg-muted/40"
                )}>
                  <Icon className={cn(
                    "w-3.5 h-3.5",
                    isSelected ? "text-primary" : "text-muted-foreground/60"
                  )} />
                </div>
                <div>
                  <div className="text-[12px] font-medium text-foreground leading-tight">{a.label}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{a.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Type-specific configuration */}
      {value && (
        <div className="space-y-3 rounded-lg border border-border/60 bg-card/40 p-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Bell className="w-3 h-3 text-emerald-400" />
            </div>
            <span className="text-xs font-medium text-foreground">
              {ACTIONS.find(a => a.value === value)?.label || "Configuración"}
            </span>
          </div>

          {/* notify_in_app */}
          {(value === "notify_in_app" || value === "assign") && (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">
                {value === "assign" ? "Asignar a" : "Destinatario"}
              </Label>
              <Select value={actionValue} onValueChange={onActionValueChange}>
                <SelectTrigger className="h-8 text-[11px] bg-background border-border">
                  <SelectValue placeholder={value === "assign" ? "Seleccionar miembro" : "Seleccionar destinatario"} />
                </SelectTrigger>
                <SelectContent>
                  {members.filter((m) => m.user?.id || m.id).map((m) => (
                    <SelectItem key={m.user?.id || m.id} value={m.user?.id || m.id} className="text-[11px]">
                      {m.user?.name || m.name || m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {value === "notify_in_app" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Título</Label>
                <Input
                  placeholder="Nueva notificación"
                  className="h-8 text-[11px] bg-background border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Mensaje</Label>
                <Textarea
                  placeholder="Texto que verá el usuario..."
                  className="min-h-[80px] text-[11px] bg-background border-border resize-none"
                />
              </div>
            </>
          )}

          {/* set_priority */}
          {value === "set_priority" && (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Prioridad</Label>
              <Select value={actionValue} onValueChange={onActionValueChange}>
                <SelectTrigger className="h-8 text-[11px] bg-background border-border">
                  <SelectValue placeholder="Seleccionar prioridad" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => (
                    <SelectItem key={p.value} value={p.value} className="text-[11px]">{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* set_status */}
          {value === "set_status" && (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Estado</Label>
              <Select value={actionValue} onValueChange={onActionValueChange}>
                <SelectTrigger className="h-8 text-[11px] bg-background border-border">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value} className="text-[11px]">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* create_task */}
          {value === "create_task" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Título de tarea</Label>
                <Input
                  placeholder="Nombre de la tarea"
                  className="h-8 text-[11px] bg-background border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Descripción</Label>
                <Textarea
                  placeholder="Instrucciones para la tarea..."
                  className="min-h-[60px] text-[11px] bg-background border-border resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Prioridad</Label>
                  <Select>
                    <SelectTrigger className="h-8 text-[11px] bg-background border-border">
                      <SelectValue placeholder="Prioridad" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map(p => (
                        <SelectItem key={p.value} value={p.value} className="text-[11px]">{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Asignar a</Label>
                  <Select>
                    <SelectTrigger className="h-8 text-[11px] bg-background border-border">
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.filter((m) => m.user?.id || m.id).map((m) => (
                        <SelectItem key={m.user?.id || m.id} value={m.user?.id || m.id} className="text-[11px]">
                          {m.user?.name || m.name || m.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
