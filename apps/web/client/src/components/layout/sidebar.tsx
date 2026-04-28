import { useState } from "react";
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
  Sun, Moon, Search,
} from "lucide-react";

type NavKey = "dashboard" | "inbox" | "contacts" | "tasks" | "documents" | "invoices" | "pipeline" | "automations" | "agent" | "notifications" | "chat" | "settings" | "help";
type NavItem = { path: string; icon: any; key: NavKey; badge?: "unread" | "overdue" };

function navLabel(copy: any, key: NavKey): string {
  if (key === "settings") return copy.settings;
  if (key === "help") return copy.help;
  return copy.nav[key] ?? key;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Work",
    items: [
      { path: "/",              icon: LayoutDashboard, key: "dashboard" },
      { path: "/inbox",         icon: Inbox,           key: "inbox",       badge: "unread" },
      { path: "/tasks",         icon: CheckSquare,      key: "tasks",       badge: "overdue" },
      { path: "/pipeline",      icon: KanbanSquare,     key: "pipeline" },
    ],
  },
  {
    label: "Operations",
    items: [
      { path: "/contacts",      icon: Users,           key: "contacts" },
      { path: "/documents",     icon: FileText,        key: "documents" },
      { path: "/invoices",      icon: Receipt,         key: "invoices" },
      { path: "/automations",   icon: Zap,             key: "automations" },
    ],
  },
  {
    label: "Assistants",
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

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Left Rail ── */}
      <aside className="w-[220px] shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">
        {/* Workspace */}
        <div className="shrink-0 px-3 pt-3 pb-2">
          <button
            className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors"
            onClick={() => multipleWorkspaces && setWsMenuOpen(o => !o)}
            style={{ cursor: multipleWorkspaces ? "pointer" : "default" }}
          >
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center shrink-0">
              <span className="text-primary-foreground font-semibold text-[9px]">P</span>
            </div>
            <span className="text-[13px] font-medium text-sidebar-foreground truncate">{ws}</span>
            {multipleWorkspaces && <ChevronDown className="w-3.5 h-3.5 text-sidebar-foreground/30 shrink-0 ml-auto" />}
          </button>
          {wsMenuOpen && multipleWorkspaces && (
            <div className="mt-1 rounded-lg bg-sidebar border border-sidebar-border shadow-sm overflow-hidden">
              {(myWorkspaces as any[]).map((m: any) => {
                const isCurrent = m.workspace.id === user?.workspace?.id;
                return (
                  <button key={m.workspace.id} className="w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-sidebar-accent/40 transition-colors"
                    onClick={() => { setWsMenuOpen(false); if (!isCurrent) switchWorkspace(m.workspace.slug); }}>
                    <span className="flex-1 text-left truncate" style={{ color: isCurrent ? "hsl(var(--sidebar-foreground))" : "hsl(var(--sidebar-foreground) / 0.5)" }}>{m.workspace.name}</span>
                    {isCurrent && <Check className="w-3 h-3 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Navigation groups */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-3 pb-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-sidebar-foreground/30">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map(({ path, icon: Icon, key, badge: bk }) => {
                  const active = isActive(path);
                  const b = badgeVal(bk);
                  return (
                    <Link key={path} href={path}>
                      <div className={cn(
                        "relative flex items-center gap-2.5 px-3 py-[7px] rounded-lg cursor-pointer transition-colors duration-150",
                        active
                          ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                          : "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/30"
                      )}>
                        {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full bg-primary" />}
                        <Icon className="w-[15px] h-[15px] shrink-0" strokeWidth={active ? 2 : 1.6} />
                        <span className="flex-1 truncate text-[12.5px]">{navLabel(copy, key)}</span>
                        {b > 0 && (
                          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none",
                            bk === "overdue" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary")}>{b}</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom: theme + language + user */}
        <div className="shrink-0 border-t border-sidebar-border px-3 py-2">
          <div className="flex items-center gap-2 px-1 py-1.5">
            <NotificationBell />
            <button onClick={toggle} className="p-1.5 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-colors">
              {theme === "dark" ? <Sun className="w-[15px] h-[15px]" /> : <Moon className="w-[15px] h-[15px]" />}
            </button>
            <LanguageSwitcher />
          </div>

          <div className="flex items-center gap-2 px-1 py-1.5 mt-0.5">
            <div className="w-6 h-6 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
              <span className="text-[9px] font-semibold text-sidebar-foreground/50">{initials}</span>
            </div>
            <span className="text-[11px] text-sidebar-foreground/60 truncate">{name}</span>
            <button onClick={logout} className="ml-auto p-1 rounded text-sidebar-foreground/20 hover:text-sidebar-foreground transition-colors" title={copy.logout}>
              <LogOut className="w-[13px] h-[13px]" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Top bar: search + account */}
        <header className="shrink-0 flex items-center gap-4 px-6 py-2.5 border-b border-border/60">
          <div className="relative flex-1 max-w-[420px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[14px] h-[14px] text-muted-foreground/50" />
            <input
              className="w-full h-8 pl-9 pr-3 rounded-md border-0 border-b border-border/60 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 transition-colors"
              placeholder="Search... ⌘K"
            />
          </div>
          <div className="flex-1" />
          <span className="text-[11px] text-muted-foreground/50 uppercase tracking-[0.12em]">{user?.role}</span>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
