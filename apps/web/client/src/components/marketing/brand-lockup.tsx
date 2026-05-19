import { cn } from "@/lib/utils";

interface BrandLockupProps {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  compact?: boolean;
}

export function BrandLockup({
  className,
  markClassName,
  textClassName,
  compact = false,
}: BrandLockupProps) {
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <img
        src="https://raw.githubusercontent.com/Lento47/pymeshub-invoice/refs/heads/master/pymesHubic.png"
        alt="PymesHub"
        className={cn(
          compact ? "h-7 w-7" : "h-8 w-8",
          "shrink-0 rounded-[8px] object-contain",
          markClassName,
        )}
      />
      <span
        className={cn(
          "font-marketing font-semibold uppercase text-white",
          compact ? "text-sm tracking-[0.24em]" : "text-lg tracking-[0.28em]",
          textClassName,
        )}
      >
        PymesHub
      </span>
    </div>
  );
}
