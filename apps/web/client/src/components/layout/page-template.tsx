import { ReactNode } from "react";
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
  showSearch?: boolean;
}

export function PageTemplate({
  title,
  description,
  children,
  actions,
  showSearch = true,
}: PageTemplateProps) {
  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              {description && (
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {showSearch && (
                <input
                  type="text"
                  placeholder="Buscar..."
                  className="px-4 py-2 rounded-lg border border-border bg-elevated text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary hidden sm:block"
                />
              )}

              {actions?.map((action, i) => (
                <Button
                  key={i}
                  variant={action.variant === "primary" ? "default" : "outline"}
                  size="sm"
                  onClick={action.onClick}
                  asChild={!!action.href}
                  className="gap-2"
                >
                  {action.href ? (
                    <Link href={action.href}>
                      <a className="flex items-center gap-2">
                        {action.icon || <Plus className="w-4 h-4" />}
                        {action.label}
                      </a>
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
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-8 max-w-7xl mx-auto">
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
    <div className={`bg-card rounded-xl border border-border overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
          {linkTo && (
            <Link href={linkTo}>
              <a className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 flex-shrink-0">
                {linkLabel} <ArrowRight className="w-4 h-4" />
              </a>
            </Link>
          )}
        </div>
      )}

      {loading ? (
        <div className="px-6 py-4 space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-4 bg-muted rounded animate-pulse" />
          ))}
        </div>
      ) : empty ? (
        <div className="px-6 py-12 text-center">
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
  icon?: React.ReactNode;
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
    blue: "text-blue-500",
    orange: "text-orange-500",
    red: "text-red-500",
    purple: "text-purple-500",
    green: "text-green-500",
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </div>
        {Icon && <Icon className={`w-5 h-5 ${colorMap[color]}`} />}
      </div>

      {loading ? (
        <div className="h-8 w-24 bg-muted rounded animate-pulse" />
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-foreground">
              {currency}{typeof value === "number" ? value.toLocaleString("es-ES") : value}
            </p>
          </div>
          {trend !== undefined && (
            <p
              className={`text-sm mt-2 flex items-center gap-1 ${
                trend >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              <span className={trend >= 0 ? "text-green-500" : "text-red-500"}>
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
      className={`flex items-center gap-3 px-6 py-3 hover:bg-muted transition cursor-pointer ${className}`}
    >
      {children}
    </div>
  );

  if (href) {
    return (
      <Link href={href}>
        <a>{content}</a>
      </Link>
    );
  }

  return content;
}
