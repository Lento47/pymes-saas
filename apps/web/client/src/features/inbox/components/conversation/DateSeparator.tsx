import { formatMessageDate } from "@/features/inbox/media-utils";

interface DateSeparatorProps {
  date: Date;
}

export function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 h-px bg-border/60" />
      <span className="text-[10px] text-muted-foreground/80 shrink-0">
        {formatMessageDate(date)}
      </span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}
