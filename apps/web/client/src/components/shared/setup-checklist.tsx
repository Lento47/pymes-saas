import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Check, ChevronRight, Rocket, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/components/providers/i18n-provider";

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
  const { user } = useAuth();
  const { locale } = useI18n();
  const es = locale === "es";
  const { data, isLoading } = useQuery<SetupChecklistData>({
    queryKey: ["setup-checklist", user?.workspace.id],
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
    <div className="rounded-3xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted/35 text-muted-foreground shrink-0">
            <Rocket aria-hidden="true" className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{es ? "Primeros pasos" : "Getting started"}</h2>
            <p className="text-sm text-muted-foreground">{completed_count} / {total} {es ? "completados" : "completed"}</p>
          </div>
        </div>
        <button
          onClick={() => dismiss.mutate()}
          disabled={dismiss.isPending}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label={es ? "Ocultar primeros pasos" : "Hide getting started"}
        >
          <X aria-hidden="true" className="w-4 h-4" />
        </button>
      </div>

      <div className="w-full h-1.5 rounded-full bg-border/60 mb-3 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full",
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
                "flex min-h-12 items-center gap-2.5 px-2 py-2 rounded-xl transition-colors cursor-pointer group",
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
                <Check aria-hidden="true" className="w-3 h-3" />
              </div>
              <span className="text-sm flex-1 break-words">{item.label}</span>
              {!item.required && !item.done && (
                <span className="text-xs text-muted-foreground shrink-0">{es ? "opcional" : "optional"}</span>
              )}
              {!item.done && (
                <ChevronRight aria-hidden="true" className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </div>
          </Link>
        ))}
      </div>
      {dismiss.error && <p role="alert" className="mt-3 text-sm text-destructive">{es ? "No se pudo ocultar. Vuelve a intentarlo." : "Could not hide this. Try again."}</p>}
    </div>
  );
}
