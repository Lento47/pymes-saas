import { Globe } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";
import type { SupportedLocale } from "@/lib/i18n";

interface LanguageSwitcherProps {
  className?: string;
  variant?: "app" | "marketing";
}

const OPTIONS: SupportedLocale[] = ["en", "es"];

export function LanguageSwitcher({
  className,
  variant = "app",
}: LanguageSwitcherProps) {
  const { locale, setLocale, messages } = useI18n();
  const isMarketing = variant === "marketing";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-md border p-1",
        isMarketing
          ? "border-border bg-card text-muted-foreground"
          : "border-border bg-[hsl(var(--elevated))] text-muted-foreground",
        className
      )}
      aria-label={messages.language.label}
    >
      <span
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-md",
            isMarketing ? "bg-muted/40" : "bg-foreground/[0.06]"
        )}
        aria-hidden="true"
      >
        <Globe className="h-4 w-4" />
      </span>

      {OPTIONS.map((option) => {
        const active = option === locale;

        return (
          <button
            key={option}
            type="button"
            onClick={() => setLocale(option)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition",
              active
                ? isMarketing
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary text-primary-foreground shadow-sm"
                : isMarketing
                  ? "text-muted-foreground hover:text-foreground"
                  : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={active}
            title={option === "en" ? messages.language.english : messages.language.spanish}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
