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
      <SelectTrigger className="h-9 w-[160px] rounded-control border-border bg-foreground/[0.04] text-xs text-muted-foreground">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="border-border bg-card">
        {STATUS_OPTIONS.map((s) => (
          <SelectItem key={s} value={s}>
            {STATUS_LABELS[s] ?? s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
