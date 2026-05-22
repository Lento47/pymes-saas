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
        aria-hidden="true"
        src="/images/pymeshub-logo.png"
        alt=""
        className={cn(
          compact ? "h-7 w-7" : "h-8 w-8",
          "shrink-0 rounded-lg object-contain",
          markClassName,
        )}
      />
      <span
        className={cn(
          "font-marketing font-semibold text-foreground",
          compact ? "text-sm tracking-[-0.01em]" : "text-lg tracking-[-0.015em]",
          textClassName,
        )}
      >
        PymesHub
      </span>
    </div>
  );
}
