import { CheckCircle2, AlertTriangle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChecklistItem {
  key: string;
  label: string;
  status: "ok" | "warning" | "missing";
  detail?: string;
}

interface Props {
  items: ChecklistItem[];
  className?: string;
}

export function HaciendaChecklist({ items, className }: Props) {
  if (!items.length) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      {items.map((item) => (
        <div key={item.key} className="flex items-start gap-2 text-[11px]">
          {item.status === "ok" && <CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />}
          {item.status === "warning" && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />}
          {item.status === "missing" && <Circle className="w-3.5 h-3.5 text-muted-foreground/40 mt-0.5 shrink-0" />}
          <span className={cn(
            item.status === "ok" && "text-green-400",
            item.status === "warning" && "text-amber-400",
            item.status === "missing" && "text-muted-foreground/60",
          )}>
            {item.label}
            {item.detail && <span className="block text-[10px] text-muted-foreground/60">{item.detail}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
