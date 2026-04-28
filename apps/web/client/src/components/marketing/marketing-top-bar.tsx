import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { cn } from "@/lib/utils";

interface MarketingTopBarProps {
  secondaryHref?: string;
  secondaryLabel?: string;
  primaryHref?: string;
  primaryLabel?: string;
  className?: string;
}

export function MarketingTopBar({
  secondaryHref = "/",
  secondaryLabel,
  primaryHref = "/login",
  primaryLabel,
  className,
}: MarketingTopBarProps) {
  return (
    <nav
      className={cn(
        "marketing-surface-quiet luminous-border flex min-h-14 items-center justify-between gap-3 rounded-2xl px-4 py-2.5 md:rounded-full md:px-5",
        className
      )}
    >
      <Link href="/">
        <a className="min-w-0 rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dfff4a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#05091d]">
          <BrandLockup compact />
        </a>
      </Link>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <LanguageSwitcher variant="marketing" />
        {secondaryLabel && (
          <Link href={secondaryHref}>
            <a className="font-marketing hidden whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold text-white/76 transition hover:bg-white/[0.06] hover:text-white sm:inline-flex">
              {secondaryLabel}
            </a>
          </Link>
        )}
        {primaryLabel && (
          <Link href={primaryHref}>
            <a className="glow-button font-marketing inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-[linear-gradient(90deg,#efff53_0%,#dfff4a_55%,#7ff4d2_100%)] px-4 py-2 text-xs font-bold text-[#071126] transition hover:translate-y-[-1px] sm:text-sm">
              {primaryLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </Link>
        )}
      </div>
    </nav>
  );
}
