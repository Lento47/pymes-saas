import { ArrowRight, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface PageTemplateProps {
  title: string;
  description?: string;
  children: ReactNode;
  /**
   * Rendered inside the sticky block, under the title row — a tab strip, a filter bar, a
   * segmented control.
   *
   * It is a slot rather than something callers wrap themselves because the only thing worth
   * having above the fold on a wide page is the title and the way to change what you are
   * looking at. A caller who puts a tab strip outside this block has to hardcode a `top-*`
   * offset to sit under the header, and that offset is wrong the moment the title wraps or
   * the description disappears.
   */
  headerExtra?: ReactNode;
  /**
   * Rendered at the right end of the title row, before `actions`.
   *
   * For chrome that belongs to the *shell* rather than the page — an account menu, a sidebar
   * trigger, a status badge. It is a slot rather than something callers wrap themselves
   * because the alternative is a second sticky bar above this one, and two headers is the
   * layout complaint this component exists to prevent.
   */
  headerSlot?: ReactNode;
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
  headerExtra,
  headerSlot,
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

            {/*
              `headerSlot` sits to the LEFT of `actions` and is the one escape hatch in this
              row, added for the admin console's shell: an account menu and a mobile
              navigation trigger are neither a page action nor a button with a label, and
              before this the only ways to place them were `headerExtra` (which renders on the
              row *below* the title, so the avatar ended up under the page name) or wrapping
              the template in a second header bar (two stacked bars of chrome above the
              content — the exact flatness this slot exists to avoid).

              Optional and additive: every existing caller is unaffected.
            */}
            {headerSlot}

            {actions && actions.length > 0 && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {actions.map((action, i) => (
                  <Button
                    key={i}
                    variant={action.variant === "primary" ? "default" : "outline"}
                    size="sm"
                    onClick={action.onClick}
                    asChild={!!action.href}
                    className="min-h-11 gap-2 rounded-md px-3 text-xs md:h-8 md:min-h-0"
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

          {headerExtra && <div className="mt-3">{headerExtra}</div>}
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
