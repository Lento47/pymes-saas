import { Link, useLocation } from "wouter";
import { CheckSquare, LayoutDashboard, Inbox, Receipt, Menu } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";

type BadgeKind = "unread" | "overdue" | null;

const TABS: ReadonlyArray<{ path: string; icon: React.ElementType; label: string; badge: BadgeKind }> = [
  { path: "/",         icon: LayoutDashboard, label: "dashboard", badge: null      },
  { path: "/inbox",    icon: Inbox,           label: "inbox",     badge: "unread"  },
  { path: "/tasks",    icon: CheckSquare,     label: "tasks",     badge: "overdue" },
  { path: "/invoices", icon: Receipt,         label: "invoices",  badge: null      },
];

export function MobileBottomNav({
  onMenuClick,
  isItemVisible,
  unreadCount = 0,
  overdueCount = 0,
}: {
  onMenuClick: () => void;
  isItemVisible?: (key: string) => boolean;
  unreadCount?: number;
  overdueCount?: number;
}) {
  const [location] = useLocation();
  const { messages } = useI18n();

  // Hide nav when viewing a conversation — header back button handles navigation
  if (/^\/inbox\/.+/.test(location)) return null;

  const copy = messages.sidebar;
  const visibleTabs = TABS.filter((tab) => !isItemVisible || isItemVisible(tab.label));

  const getBadgeVal = (badge: BadgeKind): number => {
    if (badge === "unread") return unreadCount;
    if (badge === "overdue") return overdueCount;
    return 0;
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t lg:hidden"
      style={{ background: "hsl(var(--bg-sidebar))", borderColor: "rgba(139,92,246,0.14)" }}
    >
      <div className="flex h-[52px] items-stretch justify-around gap-0.5 px-1 pb-safe">
        {visibleTabs.map(({ path, icon: Icon, label, badge }) => {
          const active = path === "/" ? location === "/" : location.startsWith(path);
          const displayLabel =
            label === "dashboard"
              ? copy.nav.dashboard
              : copy.nav[label as keyof typeof copy.nav];
          const badgeVal = getBadgeVal(badge);

          return (
            <Link
              key={path}
              href={path}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-[3px]",
                "min-h-[48px] rounded-xl px-1 py-1",
                "transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active ? "text-primary" : "text-muted-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              {/* Active pill background */}
              <span
                className={cn(
                  "absolute inset-x-1.5 top-1 h-[30px] rounded-lg transition-all duration-200",
                  active ? "bg-primary/[0.12]" : "bg-transparent"
                )}
                aria-hidden="true"
              />

              {/* Icon with optional badge dot */}
              <span className="relative z-10">
                <Icon
                  className="h-[19px] w-[19px]"
                  strokeWidth={active ? 2.3 : 1.8}
                />
                {badgeVal > 0 && (
                  <span
                    className={cn(
                      "absolute -top-1 -right-[7px] flex h-[14px] min-w-[14px] items-center justify-center",
                      "rounded-full px-[3px] text-[9px] font-bold leading-none text-white",
                      badge === "overdue" ? "bg-destructive" : "bg-primary"
                    )}
                  >
                    {badgeVal > 9 ? "9+" : badgeVal}
                  </span>
                )}
              </span>

              <span className="relative z-10 text-[10px] font-medium leading-none">
                {displayLabel}
              </span>
            </Link>
          );
        })}

        {/* More / open sidebar */}
        <button
          type="button"
          onClick={onMenuClick}
          className={cn(
            "relative flex flex-1 flex-col items-center justify-center gap-[3px]",
            "min-h-[48px] rounded-xl px-1 py-1",
            "text-muted-foreground transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          )}
          aria-label={copy.mobileNav.more}
        >
          <Menu className="h-[19px] w-[19px]" strokeWidth={1.8} />
          <span className="text-[10px] font-medium leading-none">{copy.mobileNav.more}</span>
        </button>
      </div>
    </nav>
  );
}
