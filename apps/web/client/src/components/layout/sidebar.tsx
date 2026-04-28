import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/providers/i18n-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useNotificationsSocket } from "@/hooks/use-notifications-socket";
import { api } from "@/lib/api";
import {
  LayoutDashboard, Inbox, Users, CheckSquare, FileText, Receipt, Zap, KanbanSquare,
  Settings, CircleHelp, LogOut, ChevronDown, Check, Shield, BellRing, Bot, MessageCircle,
  Sun, Moon, Search, Menu, X, ChevronRight, Building2,
} from "lucide-react";

type NavKey = "dashboard" | "inbox" | "contacts" | "tasks" | "documents" | "invoices" | "pipeline" | "automations" | "agent" | "notifications" | "chat" | "settings" | "help";
type NavItem = { path: string; icon: any; key: NavKey; badge?: "unread" | "overdue" };

function navLabel(copy: any, key: NavKey): string {
  if (key === "settings") return copy.settings;
  if (key === "help") return copy.help;
  return copy.nav[key] ?? key;
}

interface NavGroup {
  key: "work" | "operations" | "assistants";
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    key: "work",
    items: [
      { path: "/",              icon: LayoutDashboard, key: "dashboard" },
      { path: "/inbox",         icon: Inbox,           key: "inbox",       badge: "unread" },
      { path: "/tasks",         icon: CheckSquare,      key: "tasks",       badge: "overdue" },
      { path: "/pipeline",      icon: KanbanSquare,     key: "pipeline" },
    ],
  },
  {
    key: "operations",
    items: [
      { path: "/contacts",      icon: Users,           key: "contacts" },
      { path: "/documents",     icon: FileText,        key: "documents" },
      { path: "/invoices",      icon: Receipt,         key: "invoices" },
      { path: "/automations",   icon: Zap,             key: "automations" },
    ],
  },
  {
    key: "assistants",
    items: [
      { path: "/chat",          icon: MessageCircle,    key: "chat" },
      { path: "/agent",         icon: Bot,             key: "agent" },
      { path: "/settings",      icon: Settings,        key: "settings" },
      { path: "/help",          icon: CircleHelp,       key: "help" },
      { path: "/notifications", icon: BellRing,        key: "notifications", badge: "unread" },
    ],
  },
];

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout, switchWorkspace } = useAuth();
  const { messages } = useI18n();
  const { theme, toggle } = useTheme();
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const wsMenuRef = useRef<HTMLDivElement>(null);
  const copy = messages.sidebar;

  useNotificationsSocket();

  const { data: myWorkspaces } = useQuery({
    queryKey: ["/api/auth/my-workspaces"], queryFn: api.getMyWorkspaces, staleTime: 60_000,
  });
  const { data: unreadData } = useQuery({
    queryKey: ["/api/notifications/unread-count"], queryFn: api.getUnreadCount, refetchInterval: 30000,
  });
  const { data: overdueData } = useQuery({
    queryKey: ["/api/tasks/overdue"], queryFn: api.getOverdueTasks, refetchInterval: 60000,
  });

  const unreadCount = unreadData?.count ?? 0;
  const overdueCount = Array.isArray(overdueData) ? overdueData.length : 0;
  const ws = user?.workspace?.name ?? copy.workspaceFallback;
  const name = user?.name ?? user?.email ?? "—";
  const initials = name.slice(0, 2).toUpperCase();
  const multipleWorkspaces = Array.isArray(myWorkspaces) && myWorkspaces.length > 1;
  const isActive = (p: string) => p === "/" ? location === "/" : location.startsWith(p);
  const badgeVal = (bk?: string) => bk === "unread" ? unreadCount : bk === "overdue" ? overdueCount : 0;

  // Mobile detection
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location, isMobile]);

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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar Backdrop (Mobile) ── */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Left Sidebar ── */}
      <aside
        className={cn(
          "flex flex-col shrink-0 border-r border-border/60 bg-sidebar transition-all duration-300 ease-out",
          sidebarOpen ? "w-[260px]" : "w-0 lg:w-[260px]",
          isMobile && "fixed left-0 top-0 h-screen z-50 shadow-lg"
        )}
      >
        {/* ── Workspace Selector ── */}
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border/40">
          <div ref={wsMenuRef} className="relative">
            <button
              className={cn(
                "group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                "hover:bg-sidebar-accent/40 active:scale-95",
                wsMenuOpen && "bg-sidebar-accent/60"
              )}
              onClick={() => multipleWorkspaces && setWsMenuOpen(o => !o)}
              style={{ cursor: multipleWorkspaces ? "pointer" : "default" }}
            >
              {/* Workspace Avatar */}
              <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                <Building2 className="w-4 h-4 text-primary-foreground" />
              </div>

              {/* Workspace Info */}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-foreground truncate leading-tight">{ws}</p>
                {multipleWorkspaces && (
                  <p className="text-xs text-muted-foreground/60 truncate">{myWorkspaces?.length} workspace{(myWorkspaces?.length ?? 0) > 1 ? "s" : ""}</p>
                )}
              </div>

              {/* Chevron */}
              {multipleWorkspaces && (
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-muted-foreground/50 shrink-0 transition-transform duration-300",
                    wsMenuOpen && "rotate-180"
                  )}
                />
              )}
            </button>

            {/* ── Workspace Menu ── */}
            {wsMenuOpen && multipleWorkspaces && (
              <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-border/60 bg-sidebar shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-2 max-h-[280px] overflow-y-auto">
                  {(myWorkspaces as any[]).map((m: any) => {
                    const isCurrent = m.workspace.id === user?.workspace?.id;
                    return (
                      <button
                        key={m.workspace.id}
                        className={cn(
                          "group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-left",
                          isCurrent
                            ? "bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:bg-sidebar-accent/40 hover:text-foreground"
                        )}
                        onClick={() => {
                          setWsMenuOpen(false);
                          if (!isCurrent) switchWorkspace(m.workspace.slug);
                        }}
                      >
                        <div className="w-6 h-6 rounded-md bg-sidebar-accent/60 flex items-center justify-center shrink-0 text-xs font-semibold">
                          {m.workspace.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="flex-1 text-sm truncate font-medium">{m.workspace.name}</span>
                        {isCurrent && (
                          <Check className="w-4 h-4 text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {multipleWorkspaces && (
                  <div className="border-t border-border/40 px-3 py-2 bg-sidebar-accent/20">
                    <p className="text-xs text-muted-foreground/50">{myWorkspaces?.length} workspace{(myWorkspaces?.length ?? 0) > 1 ? "s" : ""} available</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-sidebar-accent/20 hover:scrollbar-thumb-sidebar-accent/30">
          {NAV_GROUPS.map((group) => (
            <div key={group.key} className="space-y-1.5">
              <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/50 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                <span>{(copy.groups as any)[group.key]}</span>
              </div>
              <div className="space-y-1">
                {group.items.map(({ path, icon: Icon, key, badge: bk }) => {
                  const active = isActive(path);
                  const b = badgeVal(bk);
                  return (
                    <Link key={path} href={path}>
                      <div
                        className={cn(
                          "group relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200",
                          active
                            ? "bg-primary/10 text-primary font-medium shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40"
                        )}
                      >
                        {/* Active indicator */}
                        {active && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary transition-all duration-300" />
                        )}

                        {/* Icon */}
                        <Icon
                          className={cn(
                            "w-4 h-4 shrink-0 transition-all duration-200",
                            active && "scale-110"
                          )}
                          strokeWidth={active ? 2.5 : 1.8}
                        />

                        {/* Label */}
                        <span className="flex-1 text-sm">{navLabel(copy, key)}</span>

                        {/* Badge */}
                        {b > 0 && (
                          <span
                            className={cn(
                              "text-xs font-bold px-2 py-0.5 rounded-full leading-none transition-all duration-200",
                              bk === "overdue"
                                ? "bg-destructive/20 text-destructive"
                                : "bg-primary/20 text-primary"
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
        </nav>

        {/* ── Bottom Actions ── */}
        <div className="shrink-0 border-t border-border/40 px-3 py-3 space-y-3 bg-sidebar-accent/20">
          {/* Controls */}
          <div className="flex items-center gap-1 px-2">
            <button
              onClick={toggle}
              className={cn(
                "p-2 rounded-lg transition-all duration-200 flex-1 flex items-center justify-center",
                "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40"
              )}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
            <div className="flex-1">
              <LanguageSwitcher />
            </div>
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-sidebar-accent/30 hover:bg-sidebar-accent/50 transition-all duration-200">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 text-xs font-bold text-primary-foreground shadow-sm">
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
                "text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
              )}
              title={copy.logout}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* ── Top Bar ── */}
        <header className="shrink-0 flex items-center gap-3 px-4 lg:px-6 py-3 border-b border-border/40 bg-background/80 backdrop-blur-sm">
          {/* Menu toggle (Mobile) */}
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={cn(
                "p-2 rounded-lg transition-all duration-200 lg:hidden",
                "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40"
              )}
            >
              {sidebarOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          )}

          {/* Search Bar */}
          <div className="relative flex-1 max-w-[420px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            <input
              className={cn(
                "w-full h-9 pl-9 pr-3 rounded-lg border border-border/40 bg-sidebar-accent/20",
                "text-sm text-foreground placeholder:text-muted-foreground/40",
                "focus:outline-none focus:border-primary/40 focus:bg-sidebar-accent/30",
                "transition-all duration-200"
              )}
              placeholder="Search... ⌘K"
            />
          </div>

          {/* Spacer */}
          <div className="hidden md:flex-1" />

          <NotificationBell />

          {/* Role Badge */}
          <span className="hidden sm:inline-block text-xs font-medium text-muted-foreground/60 uppercase tracking-wider px-3 py-1.5 rounded-lg bg-sidebar-accent/20">
            {user?.role}
          </span>
        </header>

        {/* ── Page Content ── */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
