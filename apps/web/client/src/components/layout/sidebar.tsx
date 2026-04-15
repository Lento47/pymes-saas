import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  LayoutDashboard,
  Inbox,
  Users,
  CheckSquare,
  FileText,
  Zap,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { path: "/",            icon: LayoutDashboard, label: "Dashboard" },
  { path: "/inbox",       icon: Inbox,           label: "Bandeja",   badgeKey: "unread" },
  { path: "/contacts",    icon: Users,           label: "Contactos" },
  { path: "/tasks",       icon: CheckSquare,     label: "Tareas",    badgeKey: "overdue" },
  { path: "/documents",   icon: FileText,        label: "Archivos" },
  { path: "/automations", icon: Zap,             label: "Automatiz." },
];

/** Wordmark — plain text, no icon dependencies */
function Brand() {
  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* Simple geometric mark */}
      <div className="w-7 h-7 rounded-[7px] bg-primary flex items-center justify-center shrink-0">
        <span className="text-[11px] font-bold text-primary-foreground tracking-tight">P</span>
      </div>
      <div>
        <div className="text-[13px] font-semibold text-foreground leading-none">Pymeshub</div>
      </div>
    </div>
  );
}

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const { data: unreadData } = useQuery({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: () => api.getUnreadCount(),
    refetchInterval: 30000,
  });

  const { data: overdueData } = useQuery({
    queryKey: ["/api/tasks/overdue"],
    queryFn: () => api.getOverdueTasks(),
    refetchInterval: 60000,
  });

  const unreadCount  = unreadData?.count ?? 0;
  const overdueCount = Array.isArray(overdueData) ? overdueData.length : 0;
  const workspaceName = user?.workspace?.name || "Workspace";
  const userName = user?.name || user?.email || "Usuario";
  const initials = userName.slice(0, 2).toUpperCase();

  const isActive = (path: string) =>
    path === "/" ? location === "/" : location.startsWith(path);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className="w-52 shrink-0 flex flex-col bg-[hsl(var(--sidebar-bg))] border-r border-[hsl(var(--sidebar-border))]"
        data-testid="sidebar"
      >
        {/* Header */}
        <div className="px-4 pt-5 pb-4">
          <Brand />
          <div className="mt-3 flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground truncate">{workspaceName}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 opacity-50" />
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 h-px bg-[hsl(var(--sidebar-border))]" />

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-px overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const badge = item.badgeKey === "unread" ? unreadCount
                        : item.badgeKey === "overdue" ? overdueCount
                        : 0;
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={cn(
                    "group flex items-center gap-2.5 px-3 py-[6px] rounded-md text-[13px] cursor-pointer transition-all duration-100",
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05] font-normal"
                  )}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon
                    className={cn(
                      "w-[15px] h-[15px] shrink-0 transition-colors",
                      active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {badge > 0 && (
                    <span
                      className={cn(
                        "text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full leading-none",
                        item.badgeKey === "overdue"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-primary/15 text-primary"
                      )}
                    >
                      {badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="mx-4 h-px bg-[hsl(var(--sidebar-border))]" />

        {/* Bottom */}
        <div className="px-2 py-3 space-y-px">
          <Link href="/settings">
            <div
              className={cn(
                "group flex items-center gap-2.5 px-3 py-[6px] rounded-md text-[13px] cursor-pointer transition-all duration-100",
                isActive("/settings")
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
              )}
            >
              <Settings className="w-[15px] h-[15px] shrink-0" strokeWidth={1.8} />
              <span>Configuración</span>
            </div>
          </Link>

          {/* User row */}
          <div className="flex items-center gap-2.5 px-3 py-2 mt-1">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-foreground truncate leading-tight">{userName}</div>
              <div className="text-[10px] text-muted-foreground truncate">{user?.role ?? "—"}</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={logout}
              data-testid="button-logout"
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-[hsl(var(--background))]">
        {children}
      </main>
    </div>
  );
}
