import { Link, useLocation } from "wouter";
import { LayoutDashboard, Inbox, Users, Receipt, Menu } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";

const TABS = [
  { path: "/", icon: LayoutDashboard, labelKey: "home" },
  { path: "/inbox", icon: Inbox, labelKey: "inbox" },
  { path: "/contacts", icon: Users, labelKey: "contacts" },
  { path: "/invoices", icon: Receipt, labelKey: "invoices" },
];

export function MobileBottomNav({ onMenuClick }: { onMenuClick: () => void }) {
  const [location] = useLocation();
  const { messages } = useI18n();
  const copy = messages.sidebar.mobileNav;

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-sidebar/95 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl safe-area-bottom">
      <div className="flex h-16 items-center justify-around gap-1 px-2">
        {TABS.map(({ path, icon: Icon, labelKey }) => {
          const active = path === "/" ? location === "/" : location.startsWith(path);
          const label = copy[labelKey as keyof typeof copy];
          return (
            <Link key={path} href={path}>
              <a
                className={cn(
                  "flex min-h-11 min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  active
                    ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="w-5 h-5" strokeWidth={active ? 2.3 : 1.8} />
                <span className="text-[10px] font-semibold leading-none">{label}</span>
              </a>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMenuClick}
          className={cn(
            "flex min-h-11 min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 transition-all duration-200",
            "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          )}
          aria-label={copy.more}
        >
          <Menu className="w-5 h-5" strokeWidth={1.8} />
          <span className="text-[10px] font-semibold leading-none">{copy.more}</span>
        </button>
      </div>
    </nav>
  );
}
