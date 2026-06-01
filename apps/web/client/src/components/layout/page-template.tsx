import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Plus, ArrowRight } from "lucide-react";
import { Link } from "wouter";

interface PageTemplateProps {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: Array<{
    label: string;
    href?: string;
    onClick?: () => void;
    variant?: "primary" | "secondary";
    icon?: React.ReactNode;
  }>;
}

export function PageTemplate({
  title,
  description,
  children,
  actions,
}: PageTemplateProps) {
  return (
    <div className="min-h-full bg-background">
      <div className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-3 md:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">{title}</h1>
              {description && (
                <p className="mt-1 truncate text-xs text-muted-foreground">{description}</p>
              )}
            </div>

            {actions && actions.length > 0 && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {actions.map((action, i) => (
                  <Button
                    key={i}
                    variant={action.variant === "primary" ? "default" : "outline"}
                    size="sm"
                    onClick={action.onClick}
                    asChild={!!action.href}
                    className="h-8 gap-2 rounded-md text-xs"
                  >
                    {action.href ? (
                      <Link href={action.href} className="flex items-center gap-2">
                        {action.icon || <Plus className="w-4 h-4" />}
                        {action.label}
                      </Link>
                    ) : (
                      <>
                        {action.icon || <Plus className="w-4 h-4" />}
                        {action.label}
                      </>
                    )}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6">
        {children}
      </div>
    </div>
  );
}

interface SectionCardProps {
  title?: string;
  description?: string;
  linkTo?: string;
  linkLabel?: string;
  children: ReactNode;
  loading?: boolean;
  empty?: boolean;
  className?: string;
}

export function SectionCard({
  title,
  description,
  linkTo,
  linkLabel = "Ver todos",
  children,
  loading,
  empty,
  className = "",
}: SectionCardProps) {
  return (
    <div className={`overflow-hidden rounded-lg border border-border bg-card ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-border px-4 py-3 md:px-5">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
            {description && <p className="mt-1 truncate text-xs text-muted-foreground">{description}</p>}
          </div>
          {linkTo && (
            <Link href={linkTo} className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:text-primary/80">
              {linkLabel} <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-3 px-4 py-4 md:px-5">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-4 bg-muted rounded animate-pulse" />
          ))}
        </div>
      ) : empty ? (
        <div className="px-4 py-10 text-center md:px-5">
          <p className="text-sm text-muted-foreground">Sin datos aún</p>
        </div>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  currency?: string;
  trend?: number;
  trendLabel?: string;
  icon?: React.ElementType;
  loading?: boolean;
  color?: "blue" | "orange" | "red" | "purple" | "green";
}

export function MetricCard({
  label,
  value,
  currency,
  trend,
  trendLabel,
  icon: Icon,
  loading,
  color = "blue",
}: MetricCardProps) {
  const colorMap = {
    blue: "text-primary",
    orange: "text-warning",
    red: "text-destructive",
    purple: "text-primary",
    green: "text-success",
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/20">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        </div>
        {Icon && <Icon className={`w-5 h-5 ${colorMap[color]}`} />}
      </div>

      {loading ? (
        <div className="h-8 w-24 bg-muted rounded animate-pulse" />
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-semibold leading-none tracking-[-0.02em] text-foreground tabular-nums">
              {currency}{typeof value === "number" ? value.toLocaleString("es-ES") : value}
            </p>
          </div>
          {trend !== undefined && (
            <p
              className={`text-sm mt-2 flex items-center gap-1 ${
                trend >= 0 ? "text-success" : "text-destructive"
              }`}
            >
              <span className={trend >= 0 ? "text-success" : "text-destructive"}>
                {trend >= 0 ? "↑" : "↓"}
              </span>
              {Math.abs(trend)}% {trendLabel || "vs. mes anterior"}
            </p>
          )}
        </>
      )}
    </div>
  );
}

interface TableRowProps {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
}

export function TableRow({ children, onClick, href, className = "" }: TableRowProps) {
  const content = (
    <div
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-muted/30 md:px-5 ${className}`}
    >
      {children}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
