import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ConversationStatusFilter } from "../types";
import { STATUS_OPTIONS } from "../types";

const STATUS_LABELS: Record<string, string> = {
  ALL:             "Todos los estados",
  NEW:             "Nuevo",
  IA_ATTENDING:    "IA Activa",
  REQUIRES_HUMAN:  "Req. Humano",
  IN_PROGRESS:     "En progreso",
  WAITING_CLIENT:  "Esp. Cliente",
  BLOCKED:         "Bloqueado",
  PENDING:         "Pendiente",
  OPEN:            "Abierto",
  RESOLVED:        "Resuelto",
  SPAM:            "Spam",
};

export function StatusFilterSelect({
  value,
  onChange,
}: {
  value: ConversationStatusFilter;
  onChange: (v: ConversationStatusFilter) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ConversationStatusFilter)}>
      <SelectTrigger aria-label="Estado de conversación" className="h-12 min-w-0 w-full rounded-xl border-border bg-background text-sm text-foreground [&>span]:truncate">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="app-overlay inbox-filters border-border bg-card">
        {STATUS_OPTIONS.map((s) => (
          <SelectItem key={s} value={s} className="min-h-11 text-sm">
            {STATUS_LABELS[s] ?? s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
