import { cn } from "@/lib/utils";
import { Layers } from "lucide-react";

interface CategoryChipsProps {
  categories: Record<string, any>[];
  selected: string;
  onSelect: (id: string) => void;
}

export function CategoryChips({ categories, selected, onSelect }: CategoryChipsProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={() => onSelect("all")}
        className={cn(
          "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
          selected === "all"
            ? "bg-primary/10 text-primary border border-primary/20"
            : "bg-muted/50 text-muted-foreground border border-transparent hover:border-border"
        )}
      >
        <Layers className="w-3 h-3" />
        Todas
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
            selected === c.id
              ? "border-current text-foreground bg-card"
              : "border-transparent bg-muted/50 text-muted-foreground hover:border-border"
          )}
        >
          {c.color && (
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
          )}
          {c.name}
        </button>
      ))}
    </div>
  );
}
