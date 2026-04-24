import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const ICON_CANDIDATES = [
  "/images/pymesHub.png",
  "/images/pymeshub-icon.svg",
  "/images/pymeshub-icon.png",
];

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
  const [iconIndex, setIconIndex] = useState(0);
  const currentIcon = useMemo(() => ICON_CANDIDATES[iconIndex], [iconIndex]);
  const useFallbackMark = iconIndex >= ICON_CANDIDATES.length;

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      {!useFallbackMark ? (
        <span
          className={cn(
            compact ? "h-8 w-8" : "h-9 w-9",
            "inline-flex shrink-0 items-center justify-center overflow-visible",
            markClassName
          )}
        >
          <img
            src={currentIcon}
            alt=""
            aria-hidden="true"
            onError={() => setIconIndex((current) => current + 1)}
            className="h-full w-full object-contain"
          />
        </span>
      ) : (
        <svg
          viewBox="0 0 32 32"
          aria-hidden="true"
          className={cn(
            compact ? "h-8 w-8" : "h-9 w-9",
            "text-[#e7ff5a] drop-shadow-[0_0_12px_rgba(231,255,90,0.4)]",
            markClassName
          )}
          fill="none"
        >
          <path
            d="M9.5 5.75 17 12.4l-4.1 1.5 6.7 6.2"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="m14.4 4.9 7.2 6.1-4 1.5 5.9 5.6"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />
          <path
            d="m12.1 18.8 5.3-1.9"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.55"
          />
        </svg>
      )}

      <span
        className={cn(
          "font-marketing font-semibold uppercase text-white",
          compact ? "text-sm tracking-[0.24em]" : "text-lg tracking-[0.28em]",
          textClassName
        )}
      >
        PymesHub
      </span>
    </div>
  );
}
