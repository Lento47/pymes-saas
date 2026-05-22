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
        "marketing-surface-quiet flex min-h-14 items-center justify-between gap-3 rounded-lg px-4 py-2.5 md:px-5",
        className
      )}
    >
      <Link href="/">
        <a className="min-w-0 rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <BrandLockup compact />
        </a>
      </Link>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <LanguageSwitcher variant="marketing" />
        {secondaryLabel && (
          <Link href={secondaryHref}>
            <a className="hidden whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted/35 hover:text-foreground sm:inline-flex">
              {secondaryLabel}
            </a>
          </Link>
        )}
        {primaryLabel && (
          <Link href={primaryHref}>
            <a className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 sm:text-sm">
              {primaryLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </Link>
        )}
      </div>
    </nav>
  );
}
