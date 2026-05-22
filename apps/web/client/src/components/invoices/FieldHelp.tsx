import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HelpCircle } from "lucide-react";

export function FieldHelp({
  title,
  meaning,
  example,
}: {
  title: string;
  meaning: string;
  example: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:text-foreground"
          aria-label={`Ayuda sobre ${title}`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 border-border bg-card p-3">
        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground">{title}</div>
          <p className="text-xs leading-5 text-muted-foreground/60">{meaning}</p>
          <div className="rounded-md border border-border bg-background px-2.5 py-2 text-xs leading-5 text-foreground">
            {example}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
