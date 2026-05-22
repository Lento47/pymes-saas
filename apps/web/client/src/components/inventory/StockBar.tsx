import { cn } from "@/lib/utils";

interface StockBarProps {
  current: number;
  min: number;
  trackInventory: boolean;
  type: string;
  className?: string;
}

export function StockBar({ current, min, trackInventory, type, className }: StockBarProps) {
  if (!trackInventory || type === "SERVICE") {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <div className="h-1 flex-1 rounded-full bg-muted/30" />
        <span className="text-[10px] text-muted-foreground/50">—</span>
      </div>
    );
  }

  const ratio = min > 0 ? Math.min(current / min, 1.5) : current > 0 ? 1.5 : 0;
  const pct = Math.min(ratio * 100, 100);

  const barColor =
    current <= 0 ? "bg-red-400" :
    current <= min ? "bg-amber-400" :
    "bg-emerald-400";

  const bgColor =
    current <= 0 ? "bg-red-500/10" :
    current <= min ? "bg-amber-500/10" :
    "bg-emerald-500/10";

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className={cn("h-1.5 flex-1 rounded-full overflow-hidden", bgColor)}>
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("text-[10px] font-medium tabular-nums",
        current <= 0 ? "text-red-400" : current <= min ? "text-amber-400" : "text-emerald-400"
      )}>
        {current}
      </span>
    </div>
  );
}
