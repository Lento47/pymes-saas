import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ConversationStatus = "NEW" | "OPEN" | "PENDING" | "RESOLVED";
type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
type DocumentStatus = "UPLOADED" | "PROCESSING" | "PROCESSED" | "FAILED";

const conversationColors: Record<ConversationStatus, string> = {
  NEW: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  OPEN: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  PENDING: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  RESOLVED: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

const taskColors: Record<TaskStatus, string> = {
  TODO: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  IN_PROGRESS: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  BLOCKED: "bg-red-500/15 text-red-400 border-red-500/20",
  DONE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

const documentColors: Record<DocumentStatus, string> = {
  UPLOADED: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  PROCESSING: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  PROCESSED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  FAILED: "bg-red-500/15 text-red-400 border-red-500/20",
};

interface StatusBadgeProps {
  status: string;
  type: "conversation" | "task" | "document";
  className?: string;
}

export function StatusBadge({ status, type, className }: StatusBadgeProps) {
  let colorClass = "bg-zinc-500/15 text-zinc-400 border-zinc-500/20";

  if (type === "conversation" && status in conversationColors) {
    colorClass = conversationColors[status as ConversationStatus];
  } else if (type === "task" && status in taskColors) {
    colorClass = taskColors[status as TaskStatus];
  } else if (type === "document" && status in documentColors) {
    colorClass = documentColors[status as DocumentStatus];
  }

  return (
    <Badge
      variant="outline"
      className={cn("text-[11px] font-medium px-2 py-0.5 border", colorClass, className)}
      data-testid={`status-badge-${status.toLowerCase()}`}
    >
      {status.replace("_", " ")}
    </Badge>
  );
}
