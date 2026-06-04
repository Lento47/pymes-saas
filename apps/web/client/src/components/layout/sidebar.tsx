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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { useNotificationsSocket } from "@/hooks/use-notifications-socket";
import { useTasksSocket } from "@/hooks/use-tasks-socket";
import { usePipelineSocket } from "@/hooks/use-pipeline-socket";
import { useContactsSocket } from "@/hooks/use-contacts-socket";
import { api } from "@/lib/api";
import {
  BarChart3,
  Bell,
  Bot,
  BrainCircuit,
  Building2,
  Check,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Coins,
  FileText,
  Inbox,
  KanbanSquare,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  LifeBuoy,
  LogOut,
  Menu,
  Moon,
  Package,
  Plug,
  PlugZap,
  Receipt,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sun,
  Users,
  X,
  Zap,
} from "lucide-react";

type NavKey =
  | "dashboard"
  | "inbox"
  | "contacts"
  | "tasks"
  | "invoices"
  | "pipeline"
  | "agents"
  | "automations"
  | "integrations"
  | "documents"
  | "inventory"
  | "notifications"
  | "settings"
  | "help"
  | "support";

type NavGroupKey = "principal" | "automation" | "operations";
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
  if (key === "support") return copy.nav.support ?? "Soporte";
  return copy.nav[key] ?? key;
}

interface NavGroup {
  key: NavGroupKey;
  items: NavItem[];
}

const PLAN_MIN: Record<string, string> = {
  pipeline: "STARTER",
  agents: "EMPRENDE",
};

const NAV_GROUPS: NavGroup[] = [
  {
    key: "principal",
    items: [
      { path: "/", icon: LayoutDashboard, key: "dashboard" },
      { path: "/inbox", icon: Inbox, key: "inbox", badge: "unread" },
      { path: "/notifications", icon: Bell, key: "notifications", badge: "unread" },
      { path: "/contacts", icon: Users, key: "contacts" },
      { path: "/tasks", icon: CheckSquare, key: "tasks", badge: "overdue" },
      { path: "/pipeline", icon: KanbanSquare, key: "pipeline" },
      { path: "/invoices", icon: Receipt, key: "invoices" },
    ],
  },
  {
    key: "automation",
    items: [
      { path: "/agents", icon: Bot, key: "agents" },
      { path: "/automations", icon: Zap, key: "automations" },
    ],
  },
  {
    key: "operations",
    items: [
      { path: "/documents", icon: FileText, key: "documents" },
      { path: "/inventory", icon: Package, key: "inventory" },
      { path: "/support", icon: LifeBuoy, key: "support" },
    ],
  },
];

const ADMIN_ITEMS = [
  { href: "/admin", icon: LayoutDashboard, key: "adminDashboard" as const },
  { href: "/admin/workspaces", icon: Shield, key: "adminWorkspaces" as const },
  { href: "/admin/plan-limits", icon: ShieldCheck, key: "adminPlanLimits" as const },
  { href: "/admin/landing", icon: LayoutTemplate, key: "adminLanding" as const },
  { href: "/admin/support", icon: LifeBuoy, key: "adminSupport" as const },
  { href: "/admin/router-metrics", icon: BarChart3, key: "adminRouterMetrics" as const },
] as const;

const SETTINGS_ITEMS = [
  { path: "/settings/workspace", icon: Building2, label: "Workspace" },
  { path: "/settings/members", icon: Users, label: "Miembros" },
  { path: "/settings/channels", icon: PlugZap, label: "Canales" },
  { path: "/settings/departments", icon: Layers, label: "Departamentos" },
  { path: "/settings/integrations", icon: Plug, label: "Integraciones" },
  { path: "/settings/ai", icon: BrainCircuit, label: "Inteligencia Artificial" },
  { path: "/settings/credits", icon: Coins, label: "Créditos IA" },
  { path: "/settings/templates", icon: FileText, label: "Plantillas" },
  { path: "/settings/audit", icon: ClipboardList, label: "Auditoría" },
] as const;

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout, switchWorkspace } = useAuth();
  const { messages } = useI18n();
  const { theme, toggle } = useTheme();
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(
    () => typeof window !== "undefined" && location.startsWith("/settings"),
  );
  const [groupOpen, setGroupOpen] = useState<Record<NavGroupKey, boolean>>({
    principal: true,
    automation: true,
    operations: true,
  });
  const [sidebarOpen, setSidebarOpen] = useState(
    () => (typeof window !== "undefined" ? window.innerWidth >= 1024 : true),
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 1024,
  );
  const wsMenuRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [bottomNavHidden, setBottomNavHidden] = useState(false);
  const copy = messages.sidebar;

  useNotificationsSocket();
  useTasksSocket();
  usePipelineSocket();
  useContactsSocket();

  const { data: myWorkspaces } = useQuery({
    queryKey: ["/api/auth/my-workspaces"],
    queryFn: api.getMyWorkspaces,
    staleTime: 60_000,
  });
  const { data: unreadData } = useQuery({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: api.getUnreadCount,
    refetchInterval: 30000,
  });
  const { data: features } = useQuery({
    queryKey: ["/api/workspaces/current/features"],
    queryFn: api.getCurrentFeatures,
    staleTime: 120_000,
  });
  const { data: overdueData } = useQuery({
    queryKey: ["/api/tasks/overdue"],
    queryFn: api.getOverdueTasks,
    refetchInterval: 60000,
  });

  const isBeta = features?.plan === "BETA_INFORMAL";
  const unreadCount = unreadData?.count ?? 0;
  const overdueCount = Array.isArray(overdueData) ? overdueData.length : 0;
  const ws = user?.workspace?.name ?? copy.workspaceFallback;
  const name = user?.name ?? user?.email ?? "—";
  const initials = name.slice(0, 2).toUpperCase();
  const workspaceInitial = ws.trim().charAt(0).toUpperCase() || "P";
  const multipleWorkspaces = Array.isArray(myWorkspaces) && myWorkspaces.length > 1;
  const isCollapsed = !isMobile && !sidebarOpen;

  const isFeatureEnabled = (key: string): boolean => {
    const map: Record<string, string> = {
      inbox: "whatsapp_inbox",
      tasks: "orders",
      pipeline: "contacts",
      contacts: "contacts",
      documents: "contacts",
      invoices: "billing",
      automations: "automations",
      inventory: "orders",
      agents: "ai_assistant",
      notifications: "conversations",
      integrations: "whatsapp_inbox",
    };
    const fk = map[key] || key;
    return features?.features?.[fk] !== false;
  };

  const canShowNavItem = (key: string): boolean => {
    const minPlan = PLAN_MIN[key];
    if (minPlan) {
      const plan = user?.workspace?.plan ?? "FREE";
      const order = ["FREE", "EMPRENDE", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE", "BUSINESS_PLUS"];
      if (order.indexOf(plan) < order.indexOf(minPlan)) return false;
    }
    return isFeatureEnabled(key);
  };

  const isActive = (p: string) => (p === "/" ? location === "/" : location.startsWith(p));
  const badgeVal = (bk?: string) => (bk === "unread" ? unreadCount : bk === "overdue" ? overdueCount : 0);

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

  useEffect(() => {
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, sidebarOpen]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let lastY = el.scrollTop;
    const onScroll = () => {
      const currentY = el.scrollTop;
      if (currentY > lastY && currentY > 60) {
        setBottomNavHidden(true);
      } else if (currentY < lastY) {
        setBottomNavHidden(false);
      }
      lastY = currentY;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setBottomNavHidden(false);
  }, [location]);

  useEffect(() => {
    if (location.startsWith("/settings")) setSettingsOpen(true);
  }, [location]);

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        if (!isMobile) setSidebarOpen((open) => !open);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isMobile]);

  const renderNavItem = ({ path, icon: Icon, key, badge: bk }: NavItem) => {
    const active = isActive(path);
    const b = badgeVal(bk);
    const label = navLabel(copy, key, isBeta);

    return (
      <Link key={path} href={path}>
        <div
          title={isCollapsed ? label : undefined}
          className={cn(
            "group relative flex items-center rounded-lg cursor-pointer transition-all duration-150",
            isCollapsed ? "mx-2 h-9 justify-center px-0" : "gap-2.5 px-3 py-[7px]",
            active
              ? "bg-primary/[0.14] text-foreground font-medium shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)]"
              : "text-muted-foreground/80 hover:text-foreground hover:bg-sidebar-accent/50",
          )}
        >
          {active && !isCollapsed && (
            <div className="absolute left-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
          )}
          <Icon
            className={cn(
              "shrink-0 transition-colors",
              isCollapsed ? "h-[17px] w-[17px]" : "h-[15px] w-[15px]",
              active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground",
            )}
            strokeWidth={active ? 2.2 : 1.7}
          />
          {!isCollapsed && <span className="flex-1 text-[13px]">{label}</span>}
          {b > 0 && (
            <span
              className={cn(
                isCollapsed
                  ? "absolute right-1.5 top-1.5 h-2 w-2 rounded-full p-0 text-[0px]"
                  : "min-w-[20px] rounded-md px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none",
                bk === "overdue"
                  ? "bg-destructive text-destructive-foreground"
                  : active
                    ? "bg-primary/20 text-primary"
                    : "bg-muted-foreground/10 text-muted-foreground",
              )}
            >
              {!isCollapsed && b}
            </span>
          )}
        </div>
      </Link>
    );
  };

  return (
    <div className="auth-ui flex h-[100dvh] overflow-hidden bg-background premium-ambient">
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/45 transition-opacity duration-200 will-change-opacity lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "flex flex-col shrink-0 overflow-hidden border-r border-sidebar-border/80 bg-sidebar text-sidebar-foreground",
          !isMobile && "transition-[width] duration-200 ease-out",
          !isMobile && (sidebarOpen ? "w-[272px]" : "w-[72px]"),
          isMobile && "fixed left-0 top-0 z-50 h-[100dvh] w-[272px]",
          isMobile && (sidebarOpen ? "sidebar-slide-in" : "sidebar-slide-out"),
        )}
      >
        {isMobile && (
          <div className="shrink-0 flex justify-end border-b border-sidebar-border/70 px-3 py-3 pt-safe">
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-foreground"
              aria-label="Cerrar menú"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className={cn("shrink-0 border-b border-sidebar-border/70", isCollapsed ? "px-2 py-3" : "px-3 pb-3 pt-3")}>
          {!isCollapsed && (
            <Link href="/" className="mb-3 flex items-center rounded-md px-1.5 py-1.5 text-foreground hover:bg-sidebar-accent/25">
              <BrandLockup compact markClassName="h-6 w-6" textClassName="text-[13px]" />
            </Link>
          )}

          <div ref={wsMenuRef} className="relative">
            <button
              className={cn(
                "group flex w-full items-center rounded-xl border text-left transition-all duration-200",
                isCollapsed ? "h-11 justify-center px-0" : "gap-3 px-3 py-2.5",
                wsMenuOpen
                  ? "border-primary/35 bg-primary/[0.10]"
                  : "border-primary/20 bg-primary/[0.05] hover:bg-primary/[0.08]",
              )}
              style={{ cursor: multipleWorkspaces ? "pointer" : "default" }}
              data-open={wsMenuOpen || undefined}
              onClick={() => multipleWorkspaces && setWsMenuOpen((o) => !o)}
              aria-expanded={multipleWorkspaces ? wsMenuOpen : undefined}
              title={isCollapsed ? ws : undefined}
            >
              <Avatar className="h-8 w-8">
                {user?.workspace?.logo_url ? (
                  <img src={user.workspace.logo_url} alt={ws} className="h-8 w-8 object-contain" />
                ) : (
                  <AvatarFallback className="bg-primary/[0.12] text-primary text-xs font-semibold border border-primary/25 shadow-sm">
                    {workspaceInitial}
                  </AvatarFallback>
                )}
              </Avatar>
              {!isCollapsed && (
                <>
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
                        wsMenuOpen && "rotate-180 text-foreground",
                      )}
                    />
                  )}
                </>
              )}
            </button>

            {wsMenuOpen && multipleWorkspaces && (
              <div
                className={cn(
                  "absolute top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-popover shadow-xl animate-in fade-in slide-in-from-top-2 duration-150",
                  isCollapsed ? "left-0 w-64" : "left-0 right-0",
                )}
              >
                <div className="max-h-[280px] overflow-y-auto p-1.5 minimal-scrollbar">
                  {(myWorkspaces as any[]).map((m) => {
                    const isCurrent = m.workspace.id === user?.workspace?.id;
                    return (
                      <button
                        key={m.workspace.id}
                        className={cn(
                          "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                          isCurrent
                            ? "bg-sidebar-accent/60 text-foreground"
                            : "text-muted-foreground hover:bg-sidebar-accent/45 hover:text-foreground",
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
                            <span className="text-[10px] font-semibold text-muted-foreground">
                              {m.workspace.name.trim().charAt(0).toUpperCase() || "W"}
                            </span>
                          )}
                        </div>
                        <span className="flex-1 truncate text-sm font-medium">{m.workspace.name}</span>
                        {isCurrent && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-border bg-sidebar-accent/15 px-3 py-2">
                  <p className="text-xs text-muted-foreground/80">{copy.wsAvailable(myWorkspaces?.length ?? 0)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className={cn("flex-1 overflow-y-auto minimal-scrollbar", isCollapsed ? "px-0 py-3" : "space-y-3 px-3 py-3")}>
          {ws.startsWith("Admin Hub —") && (myWorkspaces as any[])?.length > 1 && !isCollapsed && (
            <div className="mx-2 rounded-lg border border-border bg-sidebar-accent/25 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              {copy.adminHint}
            </div>
          )}

          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(({ key }) => canShowNavItem(key));
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.key} className={cn(isCollapsed ? "mb-2" : "space-y-1")}>
                {!isCollapsed && (
                  <button
                    onClick={() => setGroupOpen((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                    className="flex w-full items-center gap-2 rounded-md px-3 pb-1 pt-0.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                  >
                    <span className="flex-1">{(copy.groups as any)[group.key]}</span>
                    <ChevronDown className={cn("h-3 w-3 transition-transform", groupOpen[group.key] && "rotate-180")} />
                  </button>
                )}

                {(isCollapsed || groupOpen[group.key]) && (
                  <div className={cn(isCollapsed ? "space-y-1" : "space-y-0.5")}>{visibleItems.map(renderNavItem)}</div>
                )}
              </div>
            );
          })}

          <div className={cn("border-t border-sidebar-border/60", isCollapsed ? "mt-2 pt-2" : "space-y-0.5 pt-2")}>
            <button
              onClick={() => {
                if (isCollapsed) {
                  setSidebarOpen(true);
                  setSettingsOpen(true);
                } else {
                  setSettingsOpen((o) => !o);
                }
              }}
              className={cn(
                "flex w-full items-center rounded-lg text-left transition-colors",
                isCollapsed
                  ? "mx-2 h-9 justify-center px-0 text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                  : "gap-2 px-3 py-1.5",
              )}
              title={isCollapsed ? copy.settingsButton : undefined}
            >
              <Settings
                className={cn(
                  "shrink-0",
                  isCollapsed ? "h-[17px] w-[17px]" : "h-[15px] w-[15px]",
                  location.startsWith("/settings") ? "text-primary" : "text-muted-foreground/60",
                )}
                strokeWidth={1.7}
              />
              {!isCollapsed && (
                <>
                  <span
                    className={cn(
                      "flex-1 text-[10px] font-semibold uppercase tracking-[0.1em]",
                      location.startsWith("/settings") ? "text-primary/80" : "text-muted-foreground/50",
                    )}
                  >
                    {copy.settingsButton}
                  </span>
                  <ChevronDown className={cn("h-3 w-3 text-muted-foreground/40 transition-transform duration-200", settingsOpen && "rotate-180")} />
                </>
              )}
            </button>
            {!isCollapsed && settingsOpen && (
              <div className="space-y-0.5 pb-1">
                {SETTINGS_ITEMS.map(({ path, icon: Icon, label }) => {
                  const active = location === path || location.startsWith(path + "/");
                  return (
                    <Link key={path} href={path}>
                      <div
                        className={cn(
                          "group relative flex items-center gap-2.5 rounded-lg py-[6px] pl-7 pr-3 cursor-pointer transition-all duration-150",
                          active
                            ? "bg-primary/[0.14] text-foreground font-medium shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)]"
                            : "text-muted-foreground/70 hover:text-foreground hover:bg-sidebar-accent/50",
                        )}
                      >
                        {active && <div className="absolute left-0 top-1/2 h-[16px] w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />}
                        <Icon
                          className={cn(
                            "h-[14px] w-[14px] shrink-0 transition-colors",
                            active ? "text-primary" : "text-muted-foreground/60 group-hover:text-foreground",
                          )}
                          strokeWidth={active ? 2.2 : 1.7}
                        />
                        <span className="flex-1 text-[12.5px]">{label}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {user?.is_platform_admin && (
            <div className={cn("border-t border-sidebar-border/60 pt-2", isCollapsed ? "mt-2 space-y-1" : "space-y-1")}>
              {!isCollapsed && (
                <div className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
                  {copy.admin}
                </div>
              )}
              <div className={cn(isCollapsed ? "space-y-1" : "space-y-0.5")}>
                {ADMIN_ITEMS.map(({ href, icon: Icon, key }) => {
                  const active = isActive(href);
                  const label =
                    key === "adminDashboard"
                      ? copy.adminDashboard
                      : key === "adminWorkspaces"
                        ? copy.adminWorkspaces
                        : key === "adminLanding"
                          ? "Landing Page"
                          : key === "adminRouterMetrics"
                            ? "Router IA"
                            : key === "adminSupport"
                              ? "Soporte"
                              : copy.adminPlanLimits;
                  return (
                    <Link key={href} href={href}>
                      <div
                        title={isCollapsed ? label : undefined}
                        className={cn(
                          "group relative flex items-center rounded-lg cursor-pointer transition-all duration-150",
                          isCollapsed ? "mx-2 h-9 justify-center px-0" : "gap-2.5 px-3 py-[7px]",
                          active
                            ? "bg-primary/[0.14] text-foreground font-medium shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)]"
                            : "text-muted-foreground/80 hover:text-foreground hover:bg-sidebar-accent/50",
                        )}
                      >
                        {active && !isCollapsed && <div className="absolute left-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />}
                        <Icon
                          className={cn(
                            "shrink-0 transition-colors",
                            isCollapsed ? "h-[17px] w-[17px]" : "h-[15px] w-[15px]",
                            active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground",
                          )}
                          strokeWidth={active ? 2.2 : 1.7}
                        />
                        {!isCollapsed && <span className="flex-1 text-[13px]">{label}</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        {!isCollapsed && (
          <div className="shrink-0 px-3 pb-1">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("open-cookie-preferences"))}
              className="w-full text-center text-[10px] text-muted-foreground/50 transition-colors hover:text-muted-foreground/80"
            >
              Preferencias de cookies
            </button>
          </div>
        )}

        <div className={cn("shrink-0 border-t border-sidebar-border/70 bg-sidebar pb-safe", isCollapsed ? "px-2 py-3" : "space-y-2 px-3 py-3")}> 
          {!isCollapsed && (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={toggle}
                className="flex h-8 items-center justify-center gap-1.5 rounded-lg text-[11px] text-muted-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-foreground"
                aria-label={theme === "dark" ? copy.lightMode : copy.darkMode}
                title={theme === "dark" ? copy.lightMode : copy.darkMode}
              >
                {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
              <div className="h-8">
                <LanguageSwitcher />
              </div>
            </div>
          )}

          <div
            className={cn(
              "flex items-center rounded-xl border border-border/70 bg-sidebar-accent/30",
              isCollapsed ? "justify-center p-1.5" : "gap-2.5 px-2.5 py-2",
            )}
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary/20 text-primary text-[11px] font-bold border border-primary/30">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{name}</p>
                <p className="truncate text-[10px] capitalize text-muted-foreground/60">{user?.role?.toLowerCase()}</p>
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            title={copy.logout}
            aria-label={copy.logout}
            className={cn(
              "w-full justify-center rounded-xl border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive",
              isCollapsed ? "h-9 px-0" : "gap-2 px-3 py-2 text-xs font-semibold",
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {!isCollapsed && <span>{copy.logout ?? "Logout"}</span>}
          </Button>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="relative z-40 flex shrink-0 items-center gap-3 border-b border-primary/15 bg-[hsl(var(--bg-sidebar))] px-3 py-2.5 pt-safe lg:px-5">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground lg:flex"
            title={sidebarOpen ? copy.closeMenu : copy.openMenu}
            aria-label={sidebarOpen ? copy.closeMenu : copy.openMenu}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Button
            variant="outline"
            onClick={() => setSearchOpen(true)}
            className="hidden h-8 min-w-[260px] max-w-[360px] flex-1 items-center gap-2 rounded-md border-primary/20 bg-white/[0.04] px-3 text-left text-xs text-muted-foreground hover:text-foreground md:flex"
            title="Buscar (Ctrl+K)"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1">{copy.searchPlaceholder}</span>
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">Ctrl K</kbd>
          </Button>

          <button
            onClick={() => setSearchOpen(true)}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground md:hidden"
            title="Buscar (Ctrl+K)"
            aria-label="Buscar"
          >
            <Search className="h-4 w-4" />
          </button>

          <NotificationBell />

          {/* Logout — always visible on mobile, hidden on desktop (desktop uses sidebar button) */}
          <button
            onClick={logout}
            title={copy.logout}
            aria-label={copy.logout}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-destructive lg:hidden"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
          </button>

          <span className="hidden rounded-md border border-primary/20 bg-primary/[0.08] px-2.5 py-1 text-xs font-medium text-primary/80 lg:inline-block">
            {user?.role}
          </span>
        </header>

        <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />

        <div
          ref={scrollRef}
          className={`flex-1 overflow-y-auto minimal-scrollbar lg:pb-0 ${/^\/inbox\/.+/.test(location) ? "pb-0" : "pb-nav-safe"}`}
        >
          {children}
        </div>
      </main>

      <MobileBottomNav
        onMenuClick={() => setSidebarOpen(true)}
        onLogout={logout}
        isItemVisible={canShowNavItem}
        unreadCount={unreadCount}
        overdueCount={overdueCount}
        hidden={bottomNavHidden}
      />
    </div>
  );
}
