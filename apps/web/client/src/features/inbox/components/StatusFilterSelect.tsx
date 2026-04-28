import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ConversationStatusFilter } from "../types";
import { STATUS_OPTIONS } from "../types";

export function StatusFilterSelect({
  value,
  onChange,
}: {
  value: ConversationStatusFilter;
  onChange: (v: ConversationStatusFilter) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ConversationStatusFilter)}>
      <SelectTrigger className="h-9 w-[150px] rounded-control border-border bg-foreground/[0.04] text-xs text-muted-foreground">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="border-border bg-[#0D1424]">
        {STATUS_OPTIONS.map((s) => (
          <SelectItem key={s} value={s}>
            {s === "ALL" ? "Todos los estados" : s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
