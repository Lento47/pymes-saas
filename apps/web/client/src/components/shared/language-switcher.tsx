import { useI18n } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  variant?: "default" | "marketing";
}

export function LanguageSwitcher({ variant = "default" }: LanguageSwitcherProps) {
  const { language, setLanguage } = useI18n();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setLanguage("en")}
        className={cn(
          "text-xs font-medium transition-colors",
          language === "en"
            ? variant === "marketing"
              ? "text-white"
              : "text-[#dfff4a]"
            : variant === "marketing"
              ? "text-white/60 hover:text-white"
              : "text-muted-foreground hover:text-foreground"
        )}
      >
        EN
      </button>
      <span className={cn(
        "px-1",
        variant === "marketing" ? "text-white/30" : "text-muted-foreground"
      )}>
        /
      </span>
      <button
        onClick={() => setLanguage("es")}
        className={cn(
          "text-xs font-medium transition-colors",
          language === "es"
            ? variant === "marketing"
              ? "text-white"
              : "text-[#dfff4a]"
            : variant === "marketing"
              ? "text-white/60 hover:text-white"
              : "text-muted-foreground hover:text-foreground"
        )}
      >
        ES
      </button>
    </div>
  );
}
