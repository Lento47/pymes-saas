import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
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
  ShieldCheck,
  Clock,
  Sparkles,
  MessageSquareText,
} from "lucide-react";

// ─── Icon map for sidebar items ────────────────────────────────────────────
const ICON_MAP: Record<string, any> = {
  LayoutDashboard, Inbox, Users, CheckSquare, FileText, Receipt,
  Zap, KanbanSquare, Settings, CircleHelp, ShieldCheck,
  Clock, Sparkles, MessageSquareText,
};

// ─── Fallback NAV for Business/Enterprise (when feature flags haven't loaded) ─
const FALLBACK_NAV = [
  { path: "/",            icon: LayoutDashboard, label: "Dashboard" },
  { path: "/inbox",       icon: Inbox,           label: "Bandeja",   badge: "unread" },
  { path: "/contacts",    icon: Users,           label: "Contactos" },
  { path: "/tasks",       icon: CheckSquare,     label: "Tareas",    badge: "overdue" },
  { path: "/documents",   icon: FileText,        label: "Archivos" },
  { path: "/invoices",    icon: Receipt,         label: "Facturas" },
  { path: "/pipeline",    icon: KanbanSquare,    label: "Pipeline" },
  { path: "/automations", icon: Zap,             label: "Automatizaciones" },
];

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout, switchWorkspace } = useAuth();
  const [wsMenuOpen, setWsMenuOpen] = useState(false);

  // Feature flags — determines sidebar items based on profile
  const { data: featureData } = useFeatureFlags();

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
  const ws = user?.workspace?.name ?? "Workspace";
  const name = user?.name ?? user?.email ?? "—";
  const initials = name.slice(0, 2).toUpperCase();
  const multipleWorkspaces = Array.isArray(myWorkspaces) && myWorkspaces.length > 1;

  // Build nav from feature flags or fallback
  const navItems = useMemo(() => {
    if (featureData?.sidebarItems) {
      return featureData.sidebarItems.map((item: any) => ({
        ...item,
        icon: ICON_MAP[item.icon] || LayoutDashboard,
      }));
    }
    return FALLBACK_NAV;
  }, [featureData]);

  const isActive = (p: string) => p === "/" ? location === "/" : location.startsWith(p);

  const badge = (key?: string) =>
    key === "unread" ? unreadCount : key === "overdue" ? overdueCount : 0;

  const isEmprende = featureData?.profile === "emprende";

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
              {isEmprende && (
                <div className="text-[10px] leading-none mt-0.5" style={{ color: "hsl(var(--accent))" }}>
                  Emprende
                </div>
              )}
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
          {navItems.map(({ path, icon: Icon, label, badge: bk }: any) => {
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
                  <span className="flex-1 truncate" style={{ fontSize: "13px" }}>{label}</span>
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

          <Link href="/settings">
            <div
              className={cn(
                "flex items-center gap-2.5 mx-1.5 px-2.5 py-[6px] rounded cursor-pointer transition-colors duration-100",
                isActive("/settings") ? "text-white" : "text-[hsl(var(--fg-2))] hover:text-white"
              )}
              style={isActive("/settings") ? { background: "hsl(var(--bg-active))" } : undefined}
            >
              <Settings style={{ width: 14, height: 14 }} strokeWidth={1.8} className="shrink-0" />
              <span style={{ fontSize: "13px" }}>Configuración</span>
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
              <span style={{ fontSize: "13px" }}>Ayuda</span>
            </div>
          </Link>

          {user?.is_platform_admin && (
            <Link href="/admin">
              <div
                className={cn(
                  "flex items-center gap-2.5 mx-1.5 px-2.5 py-[6px] rounded cursor-pointer transition-colors duration-100",
                  isActive("/admin") ? "text-white" : "text-[hsl(var(--fg-2))] hover:text-white"
                )}
                style={isActive("/admin") ? { background: "hsl(var(--bg-active))" } : undefined}
              >
                <ShieldCheck style={{ width: 14, height: 14 }} strokeWidth={1.8} className="shrink-0" />
                <span style={{ fontSize: "13px" }}>Panel Admin</span>
              </div>
            </Link>
          )}
        </nav>

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
            title="Cerrar sesión"
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
