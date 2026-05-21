import { cn } from "@/lib/utils";

type Tone = "neutral" | "danger" | "warning" | "success" | "link";

const toneMap: Record<Tone, string> = {
  neutral: "border-border bg-card text-muted-foreground",
  danger: "border-destructive/30 bg-transparent text-destructive",
  warning: "border-amber-500/30 bg-transparent text-amber-600 dark:text-amber-400",
  success: "border-emerald-500/25 bg-transparent text-emerald-600 dark:text-emerald-400",
  link: "border-primary/25 bg-transparent text-primary",
};

export function AppPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("min-h-full bg-background text-foreground", className)}>{children}</div>;
}

export function ActionBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

export function PageSection({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>
      {title && (
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</h2>
        </div>
      )}
      {children}
    </section>
  );
}

export function DataRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-[minmax(120px,0.35fr)_minmax(0,1fr)] gap-3 px-4 py-2.5 text-sm", className)}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="min-w-0 text-foreground">{value}</div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon?: React.ElementType;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[180px] flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      {Icon && <Icon className="h-5 w-5 text-muted-foreground/55" />}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function StatusIndicator({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 rounded-full border px-2 text-[11px] font-medium", toneMap[tone], className)}>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tone === "danger" && "bg-destructive",
          tone === "warning" && "bg-amber-500",
          tone === "success" && "bg-emerald-500",
          tone === "link" && "bg-primary",
          tone === "neutral" && "bg-muted-foreground/45",
        )}
      />
      {label}
    </span>
  );
}
