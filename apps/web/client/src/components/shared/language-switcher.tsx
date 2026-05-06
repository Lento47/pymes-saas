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
        "inline-flex items-center gap-1 rounded-full border p-1",
        isMarketing
          ? "border-border bg-foreground/[0.04] text-white/76"
          : "border-border bg-[hsl(var(--elevated))] text-muted-foreground",
        className
      )}
      aria-label={messages.language.label}
    >
      <span
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full",
            isMarketing ? "bg-foreground/[0.05]" : "bg-foreground/[0.06]"
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
              "rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] transition",
              active
                ? isMarketing
                  ? "bg-[linear-gradient(90deg,#F59E0B_0%,#D97706_55%,#B45309_100%)] text-[#071126]"
                  : "bg-primary text-primary-foreground shadow-sm"
                : isMarketing
                  ? "text-foreground/75 hover:text-white"
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
