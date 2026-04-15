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
        "flex items-center justify-between px-6 py-4 border-b border-border bg-[hsl(var(--background))] sticky top-0 z-10",
        className
      )}
      data-testid="page-header"
    >
      <div>
        <h1 className="text-[15px] font-semibold text-foreground tracking-tight" data-testid="page-title">
          {title}
        </h1>
        {description && (
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
