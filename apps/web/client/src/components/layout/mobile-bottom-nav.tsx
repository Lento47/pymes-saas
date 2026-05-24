import { Link, useLocation } from "wouter";
import { CheckSquare, LayoutDashboard, Inbox, Receipt, Menu } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";

const TABS = [
  { path: "/", icon: LayoutDashboard, label: "dashboard" },
  { path: "/inbox", icon: Inbox, label: "inbox" },
  { path: "/tasks", icon: CheckSquare, label: "tasks" },
  { path: "/invoices", icon: Receipt, label: "invoices" },
];

export function MobileBottomNav({
  onMenuClick,
  isItemVisible,
}: {
  onMenuClick: () => void;
  isItemVisible?: (key: string) => boolean;
}) {
  const [location] = useLocation();
  const { messages } = useI18n();

  // Hide nav when viewing a conversation — the header's back button handles navigation
  if (/^\/inbox\/.+/.test(location)) return null;
  const copy = messages.sidebar;
  const visibleTabs = TABS.filter((tab) => !isItemVisible || isItemVisible(tab.label));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t pb-safe lg:hidden" style={{ background: "hsl(var(--bg-sidebar))", borderColor: "rgba(139,92,246,0.14)" }}>
      <div className="flex h-14 items-center justify-around gap-1 px-2">
        {visibleTabs.map(({ path, icon: Icon, label }) => {
          const active = path === "/" ? location === "/" : location.startsWith(path);
          const displayLabel = label === "dashboard" ? copy.nav.dashboard : copy.nav[label as keyof typeof copy.nav];
          return (
            <Link
              key={path}
              href={path}
              className={cn(
                "flex min-h-10 min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1.5 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.3 : 1.8} />
              <span className="text-[10px] font-medium leading-none">{displayLabel}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMenuClick}
          className={cn(
            "flex min-h-10 min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1.5 transition-colors",
            "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          )}
          aria-label={copy.mobileNav.more}
        >
          <Menu className="h-[18px] w-[18px]" strokeWidth={1.8} />
          <span className="text-[10px] font-medium leading-none">{copy.mobileNav.more}</span>
        </button>
      </div>
    </nav>
  );
}
