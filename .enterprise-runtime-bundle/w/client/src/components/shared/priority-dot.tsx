import { cn } from "@/lib/utils";

const priorityColors: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-amber-400",
  LOW: "bg-emerald-400",
  NORMAL: "bg-blue-400",
};

interface PriorityDotProps {
  priority: string;
  className?: string;
  showLabel?: boolean;
}

export function PriorityDot({ priority, className, showLabel = false }: PriorityDotProps) {
  const color = priorityColors[priority] || "bg-zinc-400";
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} data-testid={`priority-${priority?.toLowerCase()}`}>
      <span className={cn("w-2 h-2 rounded-full shrink-0", color)} />
      {showLabel && <span className="text-xs text-muted-foreground capitalize">{priority?.toLowerCase()}</span>}
    </span>
  );
}
