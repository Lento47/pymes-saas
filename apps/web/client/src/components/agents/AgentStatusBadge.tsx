import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIVE: {
    label: "Activo",
    className:
      "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  INACTIVE: {
    label: "Inactivo",
    className: "bg-muted/40 text-muted-foreground border-border",
  },
  DRAFT: {
    label: "Borrador",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  ERROR: {
    label: "Error",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  },
};

export function AgentStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.INACTIVE;
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-medium", cfg.className)}
    >
      {cfg.label}
    </Badge>
  );
}
