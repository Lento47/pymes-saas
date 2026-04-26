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
  Settings,
  CircleHelp,
  LogOut,
  ChevronDown,
  Check,
  CreditCard,
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
      {/* ── Premium Sidebar ── */}
      <aside className="w-[248px] shrink-0 flex flex-col p-3 bg-gradient-to-b from-[#0B1020] via-[#0A0F1A] to-[#070B14]">
        {/* ── Workspace Header ── */}
        <div className="relative shrink-0 mb-4">
          <button
            className="w-full h-11 flex items-center gap-3 px-3 rounded-xl hover:bg-white/4 transition-all duration-160 group"
            onClick={() => multipleWorkspaces && setWsMenuOpen(o => !o)}
            style={{ cursor: multipleWorkspaces ? "pointer" : "default" }}
          >
            {/* Premium logo icon */}
            <div className="w-7 h-7 rounded-[6px] bg-gradient-to-br from-[#6366f1] to-[#4f46e5] flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-white font-bold text-xs">P</span>
            </div>

            {/* Workspace name */}
            <div className="min-w-0 flex-1 text-left">
              <div className="text-sm font-semibold text-[#F8FAFC] truncate">{ws}</div>
            </div>

            {/* Chevron */}
            {multipleWorkspaces && (
              <ChevronDown className="w-4 h-4 text-[#94A3B8] flex-shrink-0 transition-transform group-hover:text-white" />
            )}
          </button>

          {/* Workspace selector dropdown */}
          {wsMenuOpen && multipleWorkspaces && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 bg-gradient-to-b from-[#0B1020] to-[#070B14] border border-white/6 rounded-lg overflow-hidden shadow-lg">
              {(myWorkspaces as any[]).map((m: any) => {
                const isCurrent = m.workspace.id === user?.workspace?.id;
                return (
                  <button
                    key={m.workspace.id}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/4 transition-all duration-160 border-b border-white/5 last:border-b-0"
                    onClick={() => { setWsMenuOpen(false); if (!isCurrent) switchWorkspace(m.workspace.slug); }}
                  >
                    <span className="flex-1 text-left text-sm truncate text-[#CBD5E1]">
                      {m.workspace.name}
                    </span>
                    {isCurrent && <Check className="w-4 h-4 text-[#6366f1] flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Navigation Section ── */}
        <nav className="flex-1 overflow-y-auto space-y-1 mb-3">
          {NAV.map(({ path, icon: Icon, key, badge: bk }) => {
            const active = isActive(path);
            const b = badge(bk);
            return (
              <Link key={path} href={path}>
                <a
                  className={cn(
                    "flex items-center gap-3 h-10 px-3 rounded-[10px] transition-all duration-160 group",
                    active
                      ? "bg-gradient-to-r from-[#5B5CF0] to-[#4338CA] text-white shadow-lg shadow-indigo-500/20"
                      : "text-[#CBD5E1] hover:bg-white/4 hover:text-white"
                  )}
                >
                  <Icon className="w-[18px] h-[18px] flex-shrink-0 stroke-[1.5]" />
                  <span className="flex-1 truncate text-sm font-medium">{copy.nav[key]}</span>
                  {b > 0 && (
                    <span
                      className="flex-shrink-0 text-xs font-semibold px-2 py-1 rounded-full"
                      style={{
                        background: bk === "overdue" ? "rgba(239, 68, 68, 0.15)" : "rgba(99, 102, 241, 0.15)",
                        color: bk === "overdue" ? "#ef4444" : "#6366f1",
                      }}
                    >
                      {b}
                    </span>
                  )}
                </a>
              </Link>
            );
          })}

          {/* ── Divider ── */}
          <div className="h-px bg-white/6 my-3" />

          {/* Lower nav section */}
          <Link href="/settings">
            <a
              className={cn(
                "flex items-center gap-3 h-10 px-3 rounded-[10px] transition-all duration-160",
                isActive("/settings") && !isActive("/settings/billing")
                  ? "bg-gradient-to-r from-[#5B5CF0] to-[#4338CA] text-white shadow-lg shadow-indigo-500/20"
                  : "text-[#CBD5E1] hover:bg-white/4 hover:text-white"
              )}
            >
              <Settings className="w-[18px] h-[18px] flex-shrink-0 stroke-[1.5]" />
              <span className="flex-1 truncate text-sm font-medium">{copy.settings}</span>
            </a>
          </Link>

          <Link href="/settings/billing">
            <a
              className={cn(
                "flex items-center gap-3 h-10 px-3 rounded-[10px] transition-all duration-160",
                isActive("/settings/billing")
                  ? "bg-gradient-to-r from-[#5B5CF0] to-[#4338CA] text-white shadow-lg shadow-indigo-500/20"
                  : "text-[#CBD5E1] hover:bg-white/4 hover:text-white"
              )}
            >
              <CreditCard className="w-[18px] h-[18px] flex-shrink-0 stroke-[1.5]" />
              <span className="flex-1 truncate text-sm font-medium">Billing</span>
            </a>
          </Link>

          <Link href="/help">
            <a
              className={cn(
                "flex items-center gap-3 h-10 px-3 rounded-[10px] transition-all duration-160",
                isActive("/help")
                  ? "bg-gradient-to-r from-[#5B5CF0] to-[#4338CA] text-white shadow-lg shadow-indigo-500/20"
                  : "text-[#CBD5E1] hover:bg-white/4 hover:text-white"
              )}
            >
              <CircleHelp className="w-[18px] h-[18px] flex-shrink-0 stroke-[1.5]" />
              <span className="flex-1 truncate text-sm font-medium">{copy.help}</span>
            </a>
          </Link>
        </nav>

        {/* ── Language Switcher ── */}
        <div className="mb-3">
          <LanguageSwitcher className="w-full justify-between" />
        </div>

        {/* ── User Footer Card ── */}
        <div className="h-14 flex items-center gap-3 px-3 rounded-xl bg-white/3 border border-white/6 flex-shrink-0">
          <div
            className="w-7 h-7 rounded-full bg-gradient-to-br from-[#6366f1] to-[#4f46e5] flex items-center justify-center flex-shrink-0 text-white font-semibold text-xs"
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-[#F8FAFC] truncate">{name}</div>
            <div className="text-xs text-[#94A3B8] truncate">{user?.role ?? ""}</div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-[#94A3B8] hover:text-white transition-colors duration-160 flex-shrink-0 rounded-lg hover:bg-white/5"
            title={copy.logout}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-y-auto" style={{ background: "hsl(var(--bg))" }}>
        {children}
      </main>
    </div>
  );
}
