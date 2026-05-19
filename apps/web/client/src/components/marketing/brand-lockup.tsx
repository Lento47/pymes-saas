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
      <span
        aria-hidden="true"
        className={cn(
          compact ? "h-7 w-7" : "h-8 w-8",
          "shrink-0 rounded-[8px]",
          markClassName,
        )}
        style={{
          background:
            "radial-gradient(circle at 30% 25%, rgba(255,255,255,.6) 0%, rgba(255,255,255,0) 50%), linear-gradient(135deg, #4F46E5, #3730A3)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,.4), 0 4px 10px -2px rgba(79,70,229,.5)",
        }}
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
