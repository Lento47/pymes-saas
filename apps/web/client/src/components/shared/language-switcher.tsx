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
          ? "border-white/10 bg-white/[0.04] text-white/76"
          : "border-border bg-[hsl(var(--elevated))] text-muted-foreground",
        className
      )}
      aria-label={messages.language.label}
    >
      <span
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full",
          isMarketing ? "bg-white/[0.05]" : "bg-black/10"
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
                  ? "bg-[linear-gradient(90deg,#efff53_0%,#ddff47_55%,#78efd0_100%)] text-[#071126]"
                  : "bg-[hsl(var(--bg-active))] text-foreground"
                : isMarketing
                  ? "text-white/70 hover:text-white"
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
