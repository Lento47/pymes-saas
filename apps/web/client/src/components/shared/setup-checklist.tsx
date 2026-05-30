import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Check, ChevronRight, Rocket, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

interface ChecklistItem {
  key: string;
  label: string;
  href: string;
  required: boolean;
  done: boolean;
}

interface SetupChecklistData {
  items: ChecklistItem[];
  dismissed: boolean;
  should_show: boolean;
  completed_count: number;
}

export function SetupChecklist() {
  const { data, isLoading } = useQuery<SetupChecklistData>({
    queryKey: ["setup-checklist"],
    queryFn: () => api.getSetupChecklist() as Promise<SetupChecklistData>,
    staleTime: 60_000,
  });

  const dismiss = useMutation({
    mutationFn: () => api.dismissSetupChecklist(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["setup-checklist"] }),
  });

  if (isLoading || !data || !data.should_show) return null;

  const { items, completed_count } = data;
  const total = items.length;

  return (
    <div className="rounded-lg border border-border bg-card p-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted/35 text-muted-foreground shrink-0">
            <Rocket className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Primeros pasos</h3>
            <p className="text-xs text-muted-foreground">{completed_count} de {total} completados</p>
          </div>
        </div>
        <button
          onClick={() => dismiss.mutate()}
          disabled={dismiss.isPending}
          className="text-muted-foreground hover:text-foreground transition-colors mt-0.5 shrink-0"
          title="Ocultar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-full h-1.5 rounded-full bg-border/60 mb-3 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            completed_count >= total ? "bg-emerald-500" : "bg-accent",
          )}
          style={{ width: total > 0 ? `${(completed_count / total) * 100}%` : "0%" }}
        />
      </div>

      <div className="space-y-0.5">
        {items.map((item) => (
          <Link key={item.key} href={item.href}>
            <div
              className={cn(
                "flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors cursor-pointer group",
                item.done
                  ? "text-muted-foreground/60"
                  : "text-muted-foreground hover:bg-muted/35 hover:text-foreground",
              )}
            >
              <div
                className={cn(
                  "w-4 h-4 rounded-full flex items-center justify-center shrink-0",
                  item.done
                    ? "bg-emerald-500/20 text-emerald-500"
                    : "border border-border text-transparent",
                )}
              >
                <Check className="w-3 h-3" />
              </div>
              <span className="text-xs flex-1 line-clamp-1">{item.label}</span>
              {!item.required && !item.done && (
                <span className="text-[10px] text-muted-foreground/50 shrink-0">opcional</span>
              )}
              {!item.done && (
                <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
