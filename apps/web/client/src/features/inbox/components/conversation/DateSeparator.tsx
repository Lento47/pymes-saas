import { formatMessageDate } from "@/features/inbox/media-utils";

interface DateSeparatorProps {
  date: Date;
}

export function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div className="flex justify-center my-4 sm:my-5">
      <span className="rounded-full bg-foreground/[0.06] px-3 py-1 text-[11px] font-medium text-muted-foreground/70">
        {formatMessageDate(date)}
      </span>
    </div>
  );
}
