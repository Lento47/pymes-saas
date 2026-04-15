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
  Bell,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/inbox", icon: Inbox, label: "Inbox", badgeKey: "unread" },
  { path: "/contacts", icon: Users, label: "Contacts" },
  { path: "/tasks", icon: CheckSquare, label: "Tasks", badgeKey: "overdue" },
  { path: "/documents", icon: FileText, label: "Documents" },
  { path: "/automations", icon: Zap, label: "Automations" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

function PymesMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="PYMES Logo">
      <rect width="40" height="40" rx="10" fill="#4f8ef7" fillOpacity="0.15" />
      <path
        d="M14 28V12h7.5c1.6 0 2.9.5 3.8 1.4.9.9 1.4 2.1 1.4 3.6s-.5 2.7-1.4 3.6c-.9.9-2.2 1.4-3.8 1.4H18v6h-4z"
        fill="#4f8ef7"
      />
      <path d="M18 15.2h3.2c.6 0 1 .2 1.3.5.3.3.5.7.5 1.3s-.2 1-.5 1.3c-.3.3-.7.5-1.3.5H18v-3.6z" fill="#151820" />
    </svg>
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

  const unreadCount = unreadData?.count ?? 0;
  const overdueCount = Array.isArray(overdueData) ? overdueData.length : (overdueData?.length ?? 0);
  const workspaceName = user?.workspace?.name || "Workspace";

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-[220px] shrink-0 flex flex-col border-r border-border bg-[#111318]" data-testid="sidebar">
        {/* Logo + workspace */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
          <PymesMark size={28} />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">PYMES</div>
            <div className="text-[10px] text-muted-foreground truncate">{workspaceName}</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.path);
            let badgeValue = 0;
            if (item.badgeKey === "unread") badgeValue = unreadCount;
            if (item.badgeKey === "overdue") badgeValue = overdueCount;

            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium cursor-pointer transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                  )}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {badgeValue > 0 && (
                    <Badge
                      className={cn(
                        "h-4 min-w-4 px-1 text-[10px] font-semibold rounded-full",
                        item.badgeKey === "overdue"
                          ? "bg-red-500/20 text-red-400 border-0"
                          : "bg-primary/20 text-primary border-0"
                      )}
                    >
                      {badgeValue}
                    </Badge>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-border px-2 py-2 space-y-1">
          {/* Notifications */}
          <Link href="/notifications">
            <div className="flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.04] cursor-pointer transition-colors" data-testid="nav-notifications">
              <Bell className="w-4 h-4" />
              <span className="flex-1">Notifications</span>
              {unreadCount > 0 && (
                <Badge className="h-4 min-w-4 px-1 text-[10px] font-semibold rounded-full bg-primary/20 text-primary border-0">
                  {unreadCount}
                </Badge>
              )}
            </div>
          </Link>

          {/* User */}
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
              {user?.firstName?.[0] || user?.email?.[0] || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-foreground truncate">
                {user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user?.email || "User"}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">{user?.email}</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={logout}
              data-testid="button-logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
