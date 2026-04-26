import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/providers/i18n-provider";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
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
  Sparkles,
  Settings,
  CircleHelp,
  LogOut,
  ChevronDown,
  Check,
  Shield,
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
  { path: "/agent", icon: Sparkles, key: "agent" as const },
];

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout, switchWorkspace } = useAuth();
  const { messages } = useI18n();
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const copy = messages.sidebar;

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

  const badge = (key?: string) =>
    key === "unread" ? unreadCount : key === "overdue" ? overdueCount : 0;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Sidebar ── */}
      <aside
        style={{ background: "hsl(var(--bg-sidebar))", borderRight: "1px solid hsl(var(--border))" }}
        className="w-[200px] shrink-0 flex flex-col"
      >
        {/* Workspace header / switcher */}
        <div className="relative shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <button
            className="w-full px-4 h-12 flex items-center gap-2.5 hover:bg-white/5 transition-colors"
            onClick={() => multipleWorkspaces && setWsMenuOpen(o => !o)}
            style={{ cursor: multipleWorkspaces ? "pointer" : "default" }}
          >
            <div
              style={{ background: "hsl(var(--accent))", borderRadius: "4px" }}
              className="w-6 h-6 flex items-center justify-center shrink-0"
            >
              <span className="text-white font-semibold" style={{ fontSize: "10px", lineHeight: 1 }}>P</span>
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-sm font-semibold text-white leading-none truncate">{ws}</div>
            </div>
            {multipleWorkspaces && (
              <ChevronDown style={{ width: 12, height: 12, color: "hsl(var(--fg-3))", flexShrink: 0 }} />
            )}
          </button>

          {wsMenuOpen && multipleWorkspaces && (
            <div
              className="absolute left-0 right-0 top-full z-50 py-1"
              style={{ background: "hsl(var(--bg-sidebar))", border: "1px solid hsl(var(--border))", borderTop: "none" }}
            >
              {(myWorkspaces as any[]).map((m: any) => {
                const isCurrent = m.workspace.id === user?.workspace?.id;
                return (
                  <button
                    key={m.workspace.id}
                    className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/5 transition-colors"
                    onClick={() => { setWsMenuOpen(false); if (!isCurrent) switchWorkspace(m.workspace.slug); }}
                  >
                    <span className="flex-1 text-left text-sm truncate" style={{ color: isCurrent ? "white" : "hsl(var(--fg-2))" }}>
                      {m.workspace.name}
                    </span>
                    {isCurrent && <Check style={{ width: 12, height: 12, color: "hsl(var(--accent))" }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV.map(({ path, icon: Icon, key, badge: bk }) => {
            const active = isActive(path);
            const b = badge(bk);
            return (
              <Link key={path} href={path}>
                <div
                  className={cn(
                    "flex items-center gap-2.5 mx-1.5 px-2.5 py-[6px] rounded cursor-pointer transition-colors duration-100",
                    active
                      ? "text-white"
                      : "text-[hsl(var(--fg-2))] hover:text-white"
                  )}
                  style={active ? { background: "hsl(var(--bg-active))" } : undefined}
                >
                  <Icon
                    className="shrink-0"
                    style={{ width: 14, height: 14 }}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                  <span className="flex-1 truncate" style={{ fontSize: "13px" }}>{copy.nav[key]}</span>
                  {b > 0 && (
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        lineHeight: 1,
                        padding: "2px 5px",
                        borderRadius: "10px",
                        background: bk === "overdue" ? "hsl(var(--danger) / 0.15)" : "hsl(var(--accent) / 0.15)",
                        color: bk === "overdue" ? "hsl(var(--danger))" : "hsl(var(--accent))",
                      }}
                    >
                      {b}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}

          {/* Divider */}
          <div className="my-2 mx-3" style={{ height: 1, background: "hsl(var(--border))" }} />

          {user?.is_platform_admin && (
            <Link href="/admin">
              <div
                className={cn(
                  "flex items-center gap-2.5 mx-1.5 px-2.5 py-[6px] rounded cursor-pointer transition-colors duration-100",
                  isActive("/admin") ? "text-white" : "text-[hsl(var(--fg-2))] hover:text-white"
                )}
                style={isActive("/admin") ? { background: "hsl(var(--bg-active))" } : undefined}
              >
                <Shield style={{ width: 14, height: 14 }} strokeWidth={1.8} className="shrink-0" />
                <span style={{ fontSize: "13px" }}>Platform Admin</span>
              </div>
            </Link>
          )}

          <Link href="/settings">
            <div
              className={cn(
                "flex items-center gap-2.5 mx-1.5 px-2.5 py-[6px] rounded cursor-pointer transition-colors duration-100",
                isActive("/settings") ? "text-white" : "text-[hsl(var(--fg-2))] hover:text-white"
              )}
              style={isActive("/settings") ? { background: "hsl(var(--bg-active))" } : undefined}
            >
              <Settings style={{ width: 14, height: 14 }} strokeWidth={1.8} className="shrink-0" />
              <span style={{ fontSize: "13px" }}>{copy.settings}</span>
            </div>
          </Link>

          <Link href="/help">
            <div
              className={cn(
                "flex items-center gap-2.5 mx-1.5 px-2.5 py-[6px] rounded cursor-pointer transition-colors duration-100",
                isActive("/help") ? "text-white" : "text-[hsl(var(--fg-2))] hover:text-white"
              )}
              style={isActive("/help") ? { background: "hsl(var(--bg-active))" } : undefined}
            >
              <CircleHelp style={{ width: 14, height: 14 }} strokeWidth={1.8} className="shrink-0" />
              <span style={{ fontSize: "13px" }}>{copy.help}</span>
            </div>
          </Link>
        </nav>

        <div className="px-3 pb-3">
          <LanguageSwitcher className="w-full justify-between" />
        </div>

        {/* User row */}
        <div
          className="px-3 py-3 flex items-center gap-2"
          style={{ borderTop: "1px solid hsl(var(--border))" }}
        >
          <div
            style={{
              width: 24, height: 24,
              borderRadius: "50%",
              background: "hsl(var(--bg-active))",
              border: "1px solid hsl(var(--border))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "10px", fontWeight: 600, color: "hsl(var(--fg-2))",
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate font-medium text-white" style={{ fontSize: "12px", lineHeight: "1.3" }}>{name}</div>
            <div className="truncate" style={{ fontSize: "11px", color: "hsl(var(--fg-3))" }}>{user?.role ?? ""}</div>
          </div>
          <button
            onClick={logout}
            style={{ color: "hsl(var(--fg-3))", padding: "4px" }}
            className="hover:text-white transition-colors shrink-0 rounded"
            title={copy.logout}
          >
            <LogOut style={{ width: 13, height: 13 }} />
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto" style={{ background: "hsl(var(--bg))" }}>
        {children}
      </main>
    </div>
  );
}
