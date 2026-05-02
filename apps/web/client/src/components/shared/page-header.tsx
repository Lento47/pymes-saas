import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}

// Cloudflare-style page header: clean top bar, title left, actions right.
// Sticky so it stays visible while scrolling content below.
export function PageHeader({ title, description, className, children }: PageHeaderProps) {
  return (
    <div
      className={cn("flex items-center justify-between gap-3 px-4 md:px-6 py-3 md:py-4 sticky top-0 z-10", className)}
      style={{ borderBottom: "1px solid hsl(var(--border))", background: "hsl(var(--bg))" }}
      data-testid="page-header"
    >
      <div>
        <h1
          className="font-semibold text-foreground tracking-tight"
          style={{ fontSize: "15px", lineHeight: "1.3" }}
          data-testid="page-title"
        >
          {title}
        </h1>
        {description && (
          <p style={{ fontSize: "12px", color: "hsl(var(--fg-2))", marginTop: "1px" }}>
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
