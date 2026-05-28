import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/providers/i18n-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { NotificationBell } from "@/components/shared/notification-bell";
import { SearchDialog } from "@/components/shared/search-dialog";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useNotificationsSocket } from "@/hooks/use-notifications-socket";
import { api } from "@/lib/api";
import {
  LayoutDashboard, Inbox, Users, CheckSquare, FileText, Receipt, Zap, KanbanSquare, Package,
  Settings, CircleHelp, LogOut, ChevronDown, Check, Shield,
  Sun, Moon, Search, Menu, X,
  ShieldCheck, LayoutTemplate, Bot, Plug,
} from "lucide-react";

type NavKey = "dashboard" | "inbox" | "contacts" | "tasks" | "invoices" | "pipeline" | "agents" | "automations" | "integrations" | "documents" | "inventory" | "notifications" | "settings" | "help";
type NavItem = { path: string; icon: React.ElementType; key: NavKey; badge?: "unread" | "overdue" };

const BETA_LABELS: Partial<Record<NavKey, string>> = {
  contacts: "Clientes",
  pipeline: "Estado del cliente",
  tasks: "Pedidos",
  automations: "Recordatorios",
  inbox: "Bandeja WS",
  invoices: "Facturación",
  dashboard: "Inicio",
  inventory: "Inventario",
};

function navLabel(copy: Record<string, any>, key: NavKey, isBeta?: boolean): string {
  if (isBeta && BETA_LABELS[key]) return BETA_LABELS[key]!;
  if (key === "settings") return copy.settings;
  if (key === "help") return copy.help;
  return copy.nav[key] ?? key;
}

interface NavGroup {
  key: "principal" | "automation" | "operations";
  items: NavItem[];
}

const PLAN_MIN: Record<string, string> = {
  pipeline: 'STARTER',
  agents:   'EMPRENDE',
};

const NAV_GROUPS: NavGroup[] = [
  {
    key: "principal",
    items: [
      { path: "/",              icon: LayoutDashboard, key: "dashboard" },
      { path: "/inbox",         icon: Inbox,           key: "inbox",       badge: "unread" },
      { path: "/contacts",      icon: Users,           key: "contacts" },
      { path: "/tasks",         icon: CheckSquare,     key: "tasks",       badge: "overdue" },
      { path: "/pipeline",      icon: KanbanSquare,    key: "pipeline" },
      { path: "/invoices",      icon: Receipt,         key: "invoices" },
    ],
  },
  {
    key: "automation",
    items: [
      { path: "/agents",            icon: Bot,    key: "agents" },
      { path: "/automations",       icon: Zap,    key: "automations" },
      { path: "/settings/channels", icon: Plug,   key: "integrations" },
    ],
  },
  {
    key: "operations",
    items: [
      { path: "/documents",     icon: FileText, key: "documents" },
      { path: "/inventory",     icon: Package,  key: "inventory" },
    ],
  },
];

const ADMIN_ITEMS = [
  { href: "/admin", icon: LayoutDashboard, key: "adminDashboard" as const },
  { href: "/admin/workspaces", icon: Shield, key: "adminWorkspaces" as const },
  { href: "/admin/plan-limits", icon: ShieldCheck, key: "adminPlanLimits" as const },
  { href: "/admin/landing", icon: LayoutTemplate, key: "adminLanding" as const },
] as const;

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout, switchWorkspace } = useAuth();
  const { messages } = useI18n();
  const { theme, toggle } = useTheme();
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 1024,
  );
  const wsMenuRef = useRef<HTMLDivElement>(null);
  const copy = messages.sidebar;

  useNotificationsSocket();

  const { data: myWorkspaces } = useQuery({
    queryKey: ["/api/auth/my-workspaces"], queryFn: api.getMyWorkspaces, staleTime: 60_000,
  });
  const { data: unreadData } = useQuery({
    queryKey: ["/api/notifications/unread-count"], queryFn: api.getUnreadCount, refetchInterval: 30000,
  });
  const { data: features } = useQuery({
    queryKey: ["/api/workspaces/current/features"], queryFn: api.getCurrentFeatures, staleTime: 120_000,
  });
  const isBeta = features?.plan === "BETA_INFORMAL";
  const isFeatureEnabled = (key: string): boolean => {
    const map: Record<string, string> = {
      inbox: "whatsapp_inbox", tasks: "orders", pipeline: "contacts",
      contacts: "contacts", documents: "contacts", invoices: "billing",
      automations: "automations", inventory: "orders",
      agents: "ai_assistant", notifications: "conversations",
      integrations: "whatsapp_inbox",
    };
    const fk = map[key] || key;
    return features?.features?.[fk] !== false;
  };
  const canShowNavItem = (key: string): boolean => {
    const minPlan = PLAN_MIN[key];
    if (minPlan) {
      const plan = user?.workspace?.plan ?? 'FREE';
      const order = ['FREE', 'EMPRENDE', 'STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE', 'BUSINESS_PLUS'];
      if (order.indexOf(plan) < order.indexOf(minPlan)) return false;
    }
    return isFeatureEnabled(key);
  };
  const { data: overdueData } = useQuery({
    queryKey: ["/api/tasks/overdue"], queryFn: api.getOverdueTasks, refetchInterval: 60000,
  });

  const unreadCount = unreadData?.count ?? 0;
  const overdueCount = Array.isArray(overdueData) ? overdueData.length : 0;
  const ws = user?.workspace?.name ?? copy.workspaceFallback;
  const name = user?.name ?? user?.email ?? "—";
  const initials = name.slice(0, 2).toUpperCase();
  const workspaceInitial = ws.trim().charAt(0).toUpperCase() || "P";
  const multipleWorkspaces = Array.isArray(myWorkspaces) && myWorkspaces.length > 1;
  const isActive = (p: string) => p === "/" ? location === "/" : location.startsWith(p);
  const badgeVal = (bk?: string) => bk === "unread" ? unreadCount : bk === "overdue" ? overdueCount : 0;

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location, isMobile]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobile, sidebarOpen]);

  // Close workspace menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wsMenuRef.current && !wsMenuRef.current.contains(e.target as Node)) {
        setWsMenuOpen(false);
      }
    };
    if (wsMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [wsMenuOpen]);

  // Ctrl+K / Cmd+K to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="auth-ui flex h-screen overflow-hidden bg-background premium-ambient">
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/45 transition-opacity duration-200 will-change-opacity lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "flex flex-col shrink-0 overflow-hidden bg-sidebar border-r border-border",
          // Desktop: animate via width (pushes main content)
          !isMobile && "transition-all duration-200 ease-out",
          !isMobile && (sidebarOpen ? "w-[260px]" : "w-0 border-r-0"),
          // Mobile: fixed overlay, GPU-composited translate
          isMobile && "fixed left-0 top-0 z-50 h-[100dvh] w-[260px]",
          isMobile && (sidebarOpen ? "sidebar-slide-in" : "sidebar-slide-out"),
        )}
      >
        {isMobile && (
          <div className="shrink-0 flex justify-end px-3 py-3 border-b border-border pt-safe">
            <button
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "p-2 rounded-md transition-colors",
                "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/35"
              )}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="shrink-0 border-b border-border px-3 pb-3 pt-3">
          <Link href="/" className="mb-3 flex items-center rounded-md px-1.5 py-1.5 text-foreground hover:bg-sidebar-accent/25">
            <BrandLockup compact markClassName="h-6 w-6" textClassName="text-[13px]" />
          </Link>
          <div ref={wsMenuRef} className="relative">
            <button
              className={cn(
                "group w-full flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-all duration-200",
                wsMenuOpen
                  ? "bg-[rgba(139,92,246,0.08)]"
                  : "hover:bg-[rgba(139,92,246,0.06)]"
              )}
              style={{
                borderColor: wsMenuOpen ? "rgba(139,92,246,0.3)" : "rgba(139,92,246,0.18)",
                background: wsMenuOpen ? "rgba(139,92,246,0.08)" : "rgba(139,92,246,0.04)",
                cursor: multipleWorkspaces ? "pointer" : "default",
              }}
              onClick={() => multipleWorkspaces && setWsMenuOpen(o => !o)}
              aria-expanded={multipleWorkspaces ? wsMenuOpen : undefined}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/70 bg-sidebar-accent/40">
                {user?.workspace?.logo_url ? (
                  <img src={user.workspace.logo_url} alt={ws} className="h-6 w-6 object-contain" />
                ) : (
                  <span className="text-xs font-semibold text-muted-foreground">{workspaceInitial}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight text-foreground">{ws}</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {multipleWorkspaces ? copy.wsAvailable(myWorkspaces?.length ?? 0) : user?.workspace?.plan ?? user?.role}
                </p>
              </div>
              {multipleWorkspaces && (
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    wsMenuOpen && "rotate-180 text-foreground"
                  )}
                />
              )}
            </button>

            {wsMenuOpen && multipleWorkspaces && (
              <div className="absolute top-full left-0 right-0 z-50 mt-2 overflow-hidden rounded-lg border border-border bg-popover shadow-lg animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-1.5 max-h-[280px] overflow-y-auto minimal-scrollbar">
                  {(myWorkspaces as any[]).map((m) => {
                    const isCurrent = m.workspace.id === user?.workspace?.id;
                    return (
                      <button
                        key={m.workspace.id}
                        className={cn(
                          "group w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-left",
                          isCurrent
                            ? "bg-sidebar-accent/55 text-foreground"
                            : "text-muted-foreground hover:bg-sidebar-accent/40 hover:text-foreground"
                        )}
                        onClick={() => {
                          setWsMenuOpen(false);
                          if (!isCurrent) switchWorkspace(m.workspace.slug);
                        }}
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-sidebar-accent/40">
                          {m.workspace.logo_url ? (
                            <img src={m.workspace.logo_url} alt={m.workspace.name} className="h-4 w-4 object-contain" />
                          ) : (
                            <span className="text-[10px] font-semibold text-muted-foreground">{m.workspace.name.trim().charAt(0).toUpperCase() || "W"}</span>
                          )}
                        </div>
                        <span className="flex-1 text-sm truncate font-medium">{m.workspace.name}</span>
                        {isCurrent && (
                          <Check className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {multipleWorkspaces && (
                  <div className="border-t border-border px-3 py-2 bg-sidebar-accent/15">
                    <p className="text-xs text-muted-foreground/80">{copy.wsAvailable(myWorkspaces?.length ?? 0)}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5 minimal-scrollbar">
          {ws.startsWith("Admin Hub —") && (myWorkspaces as any[])?.length > 1 && (
            <div className="mx-2 rounded-md border border-border bg-sidebar-accent/25 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              {copy.adminHint}
            </div>
          )}
          {NAV_GROUPS.map((group) => (
            <div key={group.key} className="space-y-1">
              <div className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/45">
                {(copy.groups as any)[group.key]}
              </div>
              <div className="space-y-0.5">
                {group.items.filter(({ key }) => canShowNavItem(key)).map(({ path, icon: Icon, key, badge: bk }) => {
                  const active = isActive(path);
                  const b = badgeVal(bk);
                  return (
                    <Link key={path} href={path}>
                      <div
                        className={cn(
                          "group relative flex items-center gap-2.5 px-3 py-[7px] rounded-lg cursor-pointer transition-all duration-150",
                          active
                            ? "bg-primary/[0.16] text-foreground font-medium"
                            : "text-muted-foreground/80 hover:text-foreground hover:bg-sidebar-accent/50"
                        )}
                      >
                        {active && (
                          <div className="absolute left-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                        )}

                        <Icon
                          className={cn(
                            "w-[15px] h-[15px] shrink-0 transition-colors",
                            active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"
                          )}
                          strokeWidth={active ? 2.2 : 1.7}
                        />

                        <span className="flex-1 text-[13px]">{navLabel(copy, key, isBeta)}</span>

                        {b > 0 && (
                          <span
                            className={cn(
                              "text-[11px] font-semibold min-w-[20px] text-center px-1.5 py-0.5 rounded-md leading-none transition-colors",
                              bk === "overdue"
                                ? "bg-destructive/15 text-destructive"
                                : active
                                  ? "bg-primary/20 text-primary"
                                  : "bg-muted-foreground/10 text-muted-foreground"
                            )}
                          >
                            {b}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {user?.is_platform_admin && (
            <div className="space-y-1 border-t border-border/40 pt-2">
              <div className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/45">
                {copy.admin}
              </div>
              <div className="space-y-0.5">
                {ADMIN_ITEMS.map(({ href, icon: Icon, key }) => {
                  const active = isActive(href);
                  const label = key === "adminDashboard" ? copy.adminDashboard : key === "adminWorkspaces" ? copy.adminWorkspaces : key === "adminLanding" ? "Landing Page" : copy.adminPlanLimits;
                  return (
                    <Link key={href} to={href}>
                      <div
                        className={cn(
                          "group relative flex items-center gap-2.5 px-3 py-[7px] rounded-lg cursor-pointer transition-all duration-150",
                          active
                            ? "bg-primary/[0.16] text-foreground font-medium"
                            : "text-muted-foreground/80 hover:text-foreground hover:bg-sidebar-accent/50"
                        )}
                      >
                        {active && (
                          <div className="absolute left-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                        )}
                        <Icon className={cn("w-[15px] h-[15px] shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground")} strokeWidth={active ? 2.2 : 1.7} />
                        <span className="flex-1 text-[13px]">{label}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        <div className="shrink-0 px-3 pb-2">
          <Link to="/settings/workspace">
            <div
              className={cn(
                "group relative flex items-center gap-2.5 px-3 py-[7px] rounded-lg cursor-pointer transition-all duration-150",
                location.startsWith("/settings")
                  ? "bg-primary/[0.16] text-foreground font-medium"
                  : "text-muted-foreground/80 hover:text-foreground hover:bg-sidebar-accent/50"
              )}
            >
              {location.startsWith("/settings") && (
                <div className="absolute left-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <Settings
                className={cn("w-[15px] h-[15px] shrink-0 transition-colors", location.startsWith("/settings") ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground")}
                strokeWidth={location.startsWith("/settings") ? 2.2 : 1.7}
              />
              <span className="flex-1 text-[13px] text-left">{copy.settingsButton}</span>
            </div>
          </Link>
        </div>

        <div className="shrink-0 px-3 pb-1">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-cookie-preferences"))}
            className="w-full text-center text-[10px] text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
          >
            Preferencias de cookies
          </button>
        </div>

        <div className="shrink-0 space-y-2 border-t border-border/50 bg-sidebar px-3 py-3 pb-safe">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={toggle}
              className={cn(
                "h-8 rounded-lg transition-colors flex items-center justify-center gap-1.5",
                "text-muted-foreground/70 hover:text-foreground hover:bg-sidebar-accent/50 text-[11px]"
              )}
              aria-label={theme === "dark" ? copy.lightMode : copy.darkMode}
              title={theme === "dark" ? copy.lightMode : copy.darkMode}
            >
              {theme === "dark" ? (
                <Sun className="w-3.5 h-3.5" />
              ) : (
                <Moon className="w-3.5 h-3.5" />
              )}
            </button>
            <div className="h-8">
              <LanguageSwitcher />
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-sidebar-accent/30 px-2.5 py-2">
            <div className="w-7 h-7 rounded-lg border border-primary/30 bg-primary/20 flex items-center justify-center shrink-0 text-[11px] font-bold text-primary">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{name}</p>
              <p className="text-[10px] text-muted-foreground/60 truncate capitalize">{user?.role?.toLowerCase()}</p>
            </div>
            <button
              onClick={logout}
              className={cn(
                "p-1.5 rounded-md transition-all duration-200 shrink-0",
                "text-muted-foreground/80 hover:text-destructive hover:bg-destructive/10"
              )}
              title={copy.logout}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="relative z-40 flex shrink-0 items-center gap-3 border-b px-3 py-2.5 pt-safe lg:px-5" style={{ background: "hsl(var(--bg-sidebar))", borderColor: "rgba(139,92,246,0.12)" }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn(
              "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors shrink-0",
              "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
            title={sidebarOpen ? copy.closeMenu : copy.openMenu}
          >
            {sidebarOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={() => setSearchOpen(true)}
            className="hidden h-8 min-w-[260px] max-w-[360px] flex-1 items-center gap-2 rounded-md border px-3 text-left text-xs text-muted-foreground transition-all duration-200 hover:text-foreground md:flex"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(139,92,246,0.18)" }}
            title="Buscar (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1">{copy.searchPlaceholder}</span>
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">Ctrl K</kbd>
          </button>

          <div className="flex-1 md:hidden" />

          <button
            onClick={() => setSearchOpen(true)}
            className={cn(
              "p-2 rounded-md transition-colors md:hidden",
              "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
            title="Buscar (Ctrl+K)"
          >
            <Search className="w-4 h-4" />
          </button>

          <NotificationBell />

          <span className="hidden rounded-md border px-2.5 py-1 text-xs font-medium lg:inline-block" style={{ background: "rgba(139,92,246,0.08)", borderColor: "rgba(139,92,246,0.2)", color: "#c4b5fd" }}>
            {user?.role}
          </span>
        </header>

        <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />

        <div className="flex-1 overflow-y-auto minimal-scrollbar pb-16 lg:pb-0">
          {children}
        </div>
      </main>

      <MobileBottomNav
        onMenuClick={() => setSidebarOpen(true)}
        isItemVisible={canShowNavItem}
        unreadCount={unreadCount}
        overdueCount={overdueCount}
      />

    </div>
  );
}
