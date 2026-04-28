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
  LayoutDashboard,
  Inbox,
  Users,
  CheckSquare,
  FileText,
  Receipt,
  Zap,
  KanbanSquare,
  Settings,
  CircleHelp,
  LogOut,
  ChevronDown,
  Check,
  Shield,
  BellRing,
  Bot,
  MessageCircle,
  Sun,
  Moon,
} from "lucide-react";

const NAV = [
  { path: "/", icon: LayoutDashboard, key: "dashboard" as const },
  { path: "/inbox", icon: Inbox, key: "inbox" as const, badge: "unread" as const },
  { path: "/contacts", icon: Users, key: "contacts" as const },
  { path: "/tasks", icon: CheckSquare, key: "tasks" as const, badge: "overdue" as const },
  { path: "/documents", icon: FileText, key: "documents" as const },
  { path: "/invoices", icon: Receipt, key: "invoices" as const },
  { path: "/pipeline", icon: KanbanSquare, key: "pipeline" as const },
  { path: "/automations", icon: Zap, key: "automations" as const },
  { path: "/notifications", icon: BellRing, key: "notifications" as const },
  { path: "/chat", icon: MessageCircle, key: "chat" as const },
  { path: "/agent", icon: Bot, key: "agent" as const },
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
    queryKey: ["/api/auth/my-workspaces"],
    queryFn: api.getMyWorkspaces,
    staleTime: 60_000,
  });

  const { data: unreadData } = useQuery({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: api.getUnreadCount,
    refetchInterval: 30000,
  });
  const { data: overdueData } = useQuery({
    queryKey: ["/api/tasks/overdue"],
    queryFn: api.getOverdueTasks,
    refetchInterval: 60000,
  });

  const unreadCount  = unreadData?.count ?? 0;
  const overdueCount = Array.isArray(overdueData) ? overdueData.length : 0;
  const ws = user?.workspace?.name ?? copy.workspaceFallback;
  const name = user?.name ?? user?.email ?? "—";
  const initials = name.slice(0, 2).toUpperCase();
  const multipleWorkspaces = Array.isArray(myWorkspaces) && myWorkspaces.length > 1;
  const isActive = (p: string) => p === "/" ? location === "/" : location.startsWith(p);
  const badge = (key?: string) => key === "unread" ? unreadCount : key === "overdue" ? overdueCount : 0;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[220px] shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">
        {/* Workspace header */}
        <div className="shrink-0 px-3 py-3 border-b border-sidebar-border">
          <button
            className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-sidebar-accent/50 transition-colors"
            onClick={() => multipleWorkspaces && setWsMenuOpen(o => !o)}
            style={{ cursor: multipleWorkspaces ? "pointer" : "default" }}
          >
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <span className="text-primary-foreground font-semibold text-[11px]">P</span>
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-[13px] font-semibold text-sidebar-foreground leading-tight truncate">{ws}</div>
            </div>
            {multipleWorkspaces && (
              <ChevronDown className="w-3.5 h-3.5 text-sidebar-foreground/40 shrink-0" />
            )}
          </button>

          <NotificationBell />

          {/* Workspace switcher dropdown */}
          {wsMenuOpen && multipleWorkspaces && (
            <div className="relative">
              <div className="absolute left-0 right-0 top-2 z-50 rounded-xl bg-sidebar border border-sidebar-border shadow-lg overflow-hidden">
                {(myWorkspaces as any[]).map((m: any) => {
                  const isCurrent = m.workspace.id === user?.workspace?.id;
                  return (
                    <button
                      key={m.workspace.id}
                      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-sidebar-accent/50 transition-colors"
                      onClick={() => { setWsMenuOpen(false); if (!isCurrent) switchWorkspace(m.workspace.slug); }}
                    >
                      <span className="flex-1 text-left text-[13px] truncate" style={{ color: isCurrent ? "hsl(var(--sidebar-foreground))" : "hsl(var(--sidebar-foreground) / 0.6)" }}>
                        {m.workspace.name}
                      </span>
                      {isCurrent && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-0.5">
          {NAV.map(({ path, icon: Icon, key, badge: bk }) => {
            const active = isActive(path);
            const b = badge(bk);
            return (
              <Link key={path} href={path}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all duration-150",
                    active
                      ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                      : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                  )}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                  <span className="flex-1 truncate text-[13px]">{copy.nav[key]}</span>
                  {b > 0 && (
                    <span
                      className={cn(
                        "text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none",
                        bk === "overdue"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-primary/15 text-primary"
                      )}
                    >
                      {b}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}

          <div className="my-1.5 mx-3 h-px bg-sidebar-border" />

          {user?.is_platform_admin && (
            <Link href="/admin">
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all duration-150",
                  isActive("/admin")
                    ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                )}
              >
                <Shield className="w-[18px] h-[18px] shrink-0" strokeWidth={1.8} />
                <span className="text-[13px]">Platform Admin</span>
              </div>
            </Link>
          )}

          <Link href="/settings">
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all duration-150",
                isActive("/settings")
                  ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
              )}
            >
              <Settings className="w-[18px] h-[18px] shrink-0" strokeWidth={1.8} />
              <span className="text-[13px]">{copy.settings}</span>
            </div>
          </Link>

          <Link href="/help">
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all duration-150",
                isActive("/help")
                  ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
              )}
            >
              <CircleHelp className="w-[18px] h-[18px] shrink-0" strokeWidth={1.8} />
              <span className="text-[13px]">{copy.help}</span>
            </div>
          </Link>
        </nav>

        {/* Bottom: theme + language + user */}
        <div className="shrink-0 border-t border-sidebar-border px-3 py-2.5 space-y-1">
          <button
            onClick={toggle}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-all"
          >
            {theme === "dark" ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            {theme === "dark" ? "Modo claro" : "Modo oscuro"}
          </button>
          <LanguageSwitcher className="w-full" />
        </div>

        {/* User */}
        <div className="shrink-0 border-t border-sidebar-border px-3 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-sidebar-accent border border-sidebar-border flex items-center justify-center shrink-0">
              <span className="text-[10px] font-semibold text-sidebar-foreground/60">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-[12px] font-medium text-sidebar-foreground leading-tight">{name}</div>
              <div className="text-[10px] text-sidebar-foreground/40 capitalize">{user?.role?.toLowerCase() ?? ""}</div>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-sidebar-foreground/30 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-all"
              title={copy.logout}
            >
              <LogOut className="w-[15px] h-[15px]" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  );
}
