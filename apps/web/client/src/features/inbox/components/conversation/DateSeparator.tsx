import { formatMessageDate } from "@/features/inbox/media-utils";

interface DateSeparatorProps {
  date: Date;
}

export function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div className="flex items-center gap-3 my-4 sm:my-5">
      <div className="flex-1 h-px bg-border/45" />
      <span className="shrink-0 rounded-full border border-border/45 bg-background/80 px-2.5 py-1 text-[10px] font-medium text-muted-foreground/75 shadow-sm">
        {formatMessageDate(date)}
      </span>
      <div className="flex-1 h-px bg-border/45" />
    </div>
  );
}
