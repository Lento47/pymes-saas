import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, className, children }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 flex items-start justify-between gap-3 border-b px-4 py-3 md:px-6",
        className,
      )}
      style={{ background: "hsl(var(--bg-sidebar))", borderColor: "rgba(139,92,246,0.12)" }}
      data-testid="page-header"
    >
      <div className="min-w-0">
        <h1
          className="truncate text-[15px] font-semibold leading-tight tracking-[-0.01em] text-foreground"
          data-testid="page-title"
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-3xl truncate text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{children}</div>}
    </div>
  );
}
