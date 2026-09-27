import { useEffect, useState, type ElementType } from "react";
import { Link, useLocation } from "wouter";
import { CheckSquare, LayoutDashboard, Inbox, Grid2X2, LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export type MobileDestination = { path: string; icon: ElementType; label: string };

export function MobileBottomNav({
  destinations, isItemVisible, overdueCount = 0,
}: {
  destinations: MobileDestination[];
  isItemVisible: (key: string) => boolean;
  overdueCount?: number;
}) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const { messages, locale } = useI18n();
  const es = locale === "es";
  const copy = messages.sidebar;
  useEffect(() => setOpen(false), [location]);

  const tabs = [
    { path: "/", icon: LayoutDashboard, label: copy.nav.dashboard, key: "dashboard" },
    { path: "/inbox", icon: Inbox, label: copy.nav.inbox, key: "inbox" },
    { path: "/tasks", icon: CheckSquare, label: copy.nav.tasks, key: "tasks" },
    { path: "/account", icon: UserRound, label: es ? "Cuenta" : "Account", key: "account" },
  ].filter(({ key }) => key === "account" || isItemVisible(key));
  const activePath = (path: string) => path === "/" ? location === path : location === path || location.startsWith(path + "/");
  const moreActive = !tabs.some(({ path }) => activePath(path));
  const itemClass = "mobile-tab relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 pb-2 pt-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  if (/^\/inbox\/.+/.test(location)) return null;

  return (
    <nav aria-label={es ? "Navegación principal" : "Main navigation"} className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background lg:hidden">
      <div className="flex min-h-[72px] items-center gap-1 px-2 py-1.5">
        {tabs.map(({ path, icon: Icon, label, key }) => {
          const active = activePath(path);
          return (
            <Link key={path} href={path} aria-current={active ? "page" : undefined}
              className={cn(itemClass, active ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {active && <span aria-hidden="true" className="absolute top-0 h-[3px] w-4 rounded-b-sm bg-primary" />}
              <span className="relative">
                <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={active ? 2.2 : 1.75} />
                {key === "tasks" && overdueCount > 0 && <span className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-destructive" aria-hidden="true" />}
              </span>
              <span className="text-center leading-none">{label}</span>
              {key === "tasks" && overdueCount > 0 && <span className="sr-only">{overdueCount} {es ? "vencidas" : "overdue"}</span>}
            </Link>
          );
        })}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button type="button" className={cn(itemClass, moreActive ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {moreActive && <span aria-hidden="true" className="absolute top-0 h-[3px] w-4 rounded-b-sm bg-primary" />}
              <Grid2X2 aria-hidden="true" className="h-5 w-5" strokeWidth={moreActive ? 2.2 : 1.75} />
              <span>{copy.mobileNav.more}</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="mobile-feature-sheet max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-3xl px-4 pt-7">
            <SheetTitle className="pr-10 text-2xl">{es ? "Tu negocio, a mano" : "Your business, at hand"}</SheetTitle>
            <SheetDescription className="mt-1">{es ? "Todo lo que puedes hacer en tu espacio de trabajo." : "Everything available in your workspace."}</SheetDescription>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {destinations.map(({ path, icon: Icon, label }) => (
                <Link key={path} href={path} onClick={() => setOpen(false)} aria-current={activePath(path) ? "page" : undefined}
                  className="mobile-tab flex min-h-24 flex-col items-start justify-center gap-3 rounded-2xl bg-muted/60 p-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.7} />
                  <span className="break-words">{label}</span>
                </Link>
              ))}
            </div>
            <button
              type="button"
              disabled={leaving}
              onClick={async () => {
                setLeaving(true);
                try {
                  await logout();
                } finally {
                  setLeaving(false);
                  setOpen(false);
                }
              }}
              className="mobile-tab mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-4 text-sm font-semibold text-destructive hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <LogOut aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {leaving
                ? es
                  ? "Cerrando sesión…"
                  : "Signing out…"
                : copy.logout || (es ? "Cerrar sesión" : "Sign out")}
            </button>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
