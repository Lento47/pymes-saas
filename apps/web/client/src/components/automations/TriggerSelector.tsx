import { Check, MessageCircle, MessageSquarePlus, ArrowLeftRight, AlertTriangle, FileUp, FileCheck, Clock, Zap } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const TRIGGERS = [
  { value: "MESSAGE_RECEIVED", icon: MessageCircle, label: "Nuevo mensaje", desc: "Cuando llega un mensaje de WhatsApp" },
  { value: "CONVERSATION_CREATED", icon: MessageSquarePlus, label: "Conversación creada", desc: "Al abrir una nueva conversación" },
  { value: "CONVERSATION_STATUS_CHANGED", icon: ArrowLeftRight, label: "Cambio de estado", desc: "Cuando una conversación cambia de estado" },
  { value: "TASK_CREATED", icon: Check, label: "Tarea creada", desc: "Al crear una nueva tarea en el workspace" },
  { value: "TASK_OVERDUE", icon: AlertTriangle, label: "Tarea vencida", desc: "Cuando una tarea supera su fecha límite" },
  { value: "DOCUMENT_UPLOADED", icon: FileUp, label: "Documento subido", desc: "Al cargar un archivo en el workspace" },
  { value: "DOCUMENT_PROCESSED", icon: FileCheck, label: "Documento procesado", desc: "Al completar el análisis de un documento" },
  { value: "SCHEDULED", icon: Clock, label: "Programado", desc: "Se ejecuta en un horario definido por cron" },
  { value: "MANUAL", icon: Zap, label: "Manual", desc: "Se activa manualmente desde la app o API" },
] as const;

interface TriggerSelectorProps {
  value: string;
  onChange: (v: string) => void;
  channels: any[];
  channelId: string;
  onChannelChange: (v: string) => void;
}

export function TriggerSelector({ value, onChange, channels, channelId, onChannelChange }: TriggerSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 block">
          ¿Cuándo se activa?
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {TRIGGERS.map((t) => {
            const Icon = t.icon;
            const isSelected = value === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => onChange(t.value)}
                className={cn(
                  "relative flex flex-col gap-1.5 p-3 rounded-xl border text-left transition-all duration-200",
                  isSelected
                    ? "border-violet-500/50 bg-violet-500/[0.06] ring-1 ring-violet-500/20"
                    : "border-border/60 bg-card/40 hover:bg-accent/40 hover:border-border"
                )}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center",
                  isSelected ? "bg-violet-500/15" : "bg-muted/40"
                )}>
                  <Icon className={cn(
                    "w-3.5 h-3.5",
                    isSelected ? "text-violet-400" : "text-muted-foreground/60"
                  )} />
                </div>
                <div>
                  <div className="text-[12px] font-medium text-foreground leading-tight">{t.label}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{t.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Channel filter for MESSAGE_RECEIVED */}
      {value === "MESSAGE_RECEIVED" && (
        <div className="rounded-xl border border-border/60 bg-card/40 p-3 space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Canal (opcional)</Label>
          <Select value={channelId} onValueChange={onChannelChange}>
            <SelectTrigger className="h-8 text-[11px] bg-background border-border">
              <SelectValue placeholder="Todos los canales" />
            </SelectTrigger>
            <SelectContent>
              {channels?.map((c: any) => (
                <SelectItem key={c.id} value={c.id} className="text-[11px]">
                  {c.name} ({c.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground/60">
            Si no seleccionás un canal, se aplica a todos.
          </p>
        </div>
      )}

      {/* Cron input for SCHEDULED */}
      {value === "SCHEDULED" && (
        <div className="rounded-xl border border-border/60 bg-card/40 p-3 space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Expresión Cron</Label>
          <Input
            placeholder="0 9 * * 1-5 (lunes a viernes 9am)"
            className="h-8 text-[11px] bg-background border-border font-mono"
          />
          <p className="text-[10px] text-muted-foreground/60">
            Define la frecuencia con formato cron.
          </p>
        </div>
      )}
    </div>
  );
}
