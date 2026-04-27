import { Check, Zap, Play, MessageCircle, MessageSquarePlus, ArrowLeftRight, AlertTriangle, FileUp, FileCheck, Clock, Bell, Flag, CircleDot, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

const TRIGGER_ICONS: Record<string, typeof Zap> = {
  MESSAGE_RECEIVED: MessageCircle,
  CONVERSATION_CREATED: MessageSquarePlus,
  CONVERSATION_STATUS_CHANGED: ArrowLeftRight,
  TASK_CREATED: Check,
  TASK_OVERDUE: AlertTriangle,
  DOCUMENT_UPLOADED: FileUp,
  DOCUMENT_PROCESSED: FileCheck,
  SCHEDULED: Clock,
  MANUAL: Zap,
};

const ACTION_ICONS: Record<string, typeof Bell> = {
  notify_in_app: Bell,
  set_priority: Flag,
  set_status: CircleDot,
  assign: UserPlus,
  create_task: Check,
};

const TRIGGER_LABEL: Record<string, string> = {
  MESSAGE_RECEIVED: "Nuevo mensaje",
  CONVERSATION_CREATED: "Conversación creada",
  CONVERSATION_STATUS_CHANGED: "Cambio de estado",
  TASK_CREATED: "Tarea creada",
  TASK_OVERDUE: "Tarea vencida",
  DOCUMENT_UPLOADED: "Documento subido",
  DOCUMENT_PROCESSED: "Documento procesado",
  SCHEDULED: "Programado",
  MANUAL: "Manual",
};

const ACTION_LABEL: Record<string, string> = {
  notify_in_app: "Notificar",
  set_priority: "Prioridad",
  set_status: "Estado",
  assign: "Asignar",
  create_task: "Crear tarea",
};

interface WorkflowSpineProps {
  triggerType: string;
  actionType: string;
  hasBoth: boolean;
}

export function WorkflowSpine({ triggerType, actionType, hasBoth }: WorkflowSpineProps) {
  const TriggerIcon = TRIGGER_ICONS[triggerType] || Zap;
  const ActionIcon = ACTION_ICONS[actionType] || Play;

  return (
    <div className="w-[88px] shrink-0 flex flex-col items-center pt-6 border-r border-border/60">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-5">
        Flujo
      </span>

      {/* Trigger step */}
      <div className="flex flex-col items-center gap-1.5">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-200",
          triggerType
            ? "bg-violet-500/10 border-violet-500/30"
            : "bg-muted/30 border-border/40"
        )}>
          <TriggerIcon className={cn(
            "w-4 h-4 transition-colors",
            triggerType ? "text-violet-400" : "text-muted-foreground/40"
          )} />
        </div>
        <span className="text-[10px] font-medium text-center leading-tight px-1 text-foreground/80">
          {TRIGGER_LABEL[triggerType] || "Trigger"}
        </span>
      </div>

      {/* Connector */}
      <div className="flex flex-col items-center py-2">
        <div className="w-[2px] h-6 bg-muted-foreground/15 rounded-full" />
        <div className={cn(
          "w-1.5 h-1.5 rounded-full -mt-[13px] transition-colors duration-300",
          hasBoth ? "bg-violet-400 shadow-[0_0_6px_rgba(139,124,246,0.5)]" : "bg-muted-foreground/20"
        )} />
        <div className="w-[2px] h-6 bg-muted-foreground/15 rounded-full" />
      </div>

      {/* Action step */}
      <div className="flex flex-col items-center gap-1.5">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-200",
          actionType
            ? "bg-emerald-500/10 border-emerald-500/30"
            : "bg-muted/30 border-border/40"
        )}>
          <ActionIcon className={cn(
            "w-4 h-4 transition-colors",
            actionType ? "text-emerald-400" : "text-muted-foreground/40"
          )} />
        </div>
        <span className="text-[10px] font-medium text-center leading-tight px-1 text-foreground/80">
          {ACTION_LABEL[actionType] || "Acción"}
        </span>
      </div>

      {/* Summary chip */}
      {hasBoth && (
        <div className="mt-5 px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[9px] text-violet-400 font-medium text-center leading-snug">
          Si {TRIGGER_LABEL[triggerType]?.toLowerCase()}<br />
          → {ACTION_LABEL[actionType]?.toLowerCase()}
        </div>
      )}
    </div>
  );
}
