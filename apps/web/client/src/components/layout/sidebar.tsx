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
  ChevronRight,
  Check,
  CreditCard,
  Crown,
  MessageCircle,
  Bot,
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
      <aside className="w-[220px] shrink-0 flex flex-col bg-[#0D1B2A]">
        <div className="relative shrink-0 px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <img
              src="https://raw.githubusercontent.com/Lento47/pymeshub-invoice/refs/heads/master/pymesHubic.png"
              alt="PymesHub"
              className="w-7 h-7 object-contain flex-shrink-0"
            />
            <span className="text-sm font-bold text-white tracking-tight">
              Pymes<span className="font-normal text-white/70">hub</span>
            </span>
          </div>

          <button
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
            onClick={() => multipleWorkspaces && setWsMenuOpen(o => !o)}
            style={{ cursor: multipleWorkspaces ? "pointer" : "default" }}
          >
            <div className="min-w-0 flex-1 text-left">
              <div className="text-xs text-white/50 truncate">{ws}</div>
            </div>
            {multipleWorkspaces && (
              <ChevronDown className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
            )}
          </button>

          {wsMenuOpen && multipleWorkspaces && (
            <div className="absolute left-0 right-0 top-full z-50 bg-[#0D1B2A] border border-white/8 border-t-0">
              {(myWorkspaces as any[]).map((m: any) => {
                const isCurrent = m.workspace.id === user?.workspace?.id;
                return (
                  <button
                    key={m.workspace.id}
                    className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/5 transition-colors border-b border-white/8 last:border-b-0"
                    onClick={() => { setWsMenuOpen(false); if (!isCurrent) switchWorkspace(m.workspace.slug); }}
                  >
                    <span className="flex-1 text-left text-sm truncate text-white/70">
                      {m.workspace.name}
                    </span>
                    {isCurrent && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-1">
          {NAV.map(({ path, icon: Icon, key, badge: bk }) => {
            const active = isActive(path);
            const b = badge(bk);
            return (
              <Link key={path} href={path}>
                <a
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors",
                    active
                      ? "bg-indigo-600 text-white"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
                  <span className="flex-1 text-sm font-medium truncate">{copy.nav[key]}</span>
                  {b > 0 && (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        background: bk === "overdue" ? "rgba(239, 68, 68, 0.2)" : "rgba(99, 102, 241, 0.2)",
                        color: bk === "overdue" ? "#fca5a5" : "#a5b4fc",
                      }}
                    >
                      {b}
                    </span>
                  )}
                </a>
              </Link>
            );
          })}

          <div className="my-2 h-px bg-white/6" />

          <Link href="/settings">
            <a className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors",
              isActive("/settings") && !isActive("/settings/billing") ? "bg-indigo-600 text-white" : "text-white/60 hover:text-white hover:bg-white/5")}>
              <Settings className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
              <span className="flex-1 text-sm font-medium truncate">{copy.settings}</span>
            </a>
          </Link>

          <Link href="/settings/billing">
            <a className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors",
              isActive("/settings/billing") ? "bg-indigo-600 text-white" : "text-white/60 hover:text-white hover:bg-white/5")}>
              <CreditCard className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
              <span className="flex-1 text-sm font-medium truncate">Billing</span>
            </a>
          </Link>

          <Link href="/chat">
            <a className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors",
              isActive("/chat") ? "bg-indigo-600 text-white" : "text-white/60 hover:text-white hover:bg-white/5")}>
              <MessageCircle className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
              <span className="flex-1 text-sm font-medium truncate">AI Chat</span>
            </a>
          </Link>

          <Link href="/agent">
            <a className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors",
              isActive("/agent") ? "bg-indigo-600 text-white" : "text-white/60 hover:text-white hover:bg-white/5")}>
              <Bot className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
              <span className="flex-1 text-sm font-medium truncate">AI Agent</span>
            </a>
          </Link>

          <Link href="/help">
            <a className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors",
              isActive("/help") ? "bg-indigo-600 text-white" : "text-white/60 hover:text-white hover:bg-white/5")}>
              <CircleHelp className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
              <span className="flex-1 text-sm font-medium truncate">{copy.help}</span>
            </a>
          </Link>
        </nav>

        <div className="px-3 pb-2">
          <Link href="/pricing">
            <a className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-indigo-600/10 border border-indigo-500/20 hover:bg-indigo-600/20 transition-colors group">
              <Crown className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <div className="flex-1 text-left min-w-0">
                <div className="text-xs font-semibold text-white truncate">Upgrade to Business+</div>
                <div className="text-xs text-white/50 truncate">Unlock more power</div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/40 flex-shrink-0 group-hover:text-white/70 transition-colors" />
            </a>
          </Link>
        </div>

        <div className="px-3 pb-2">
          <LanguageSwitcher className="w-full" />
        </div>

        <div className="px-3 py-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-semibold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{name}</div>
            <div className="text-xs text-white/60 truncate">{user?.role ?? ""}</div>
          </div>
          <button
            onClick={logout}
            className="p-1 text-white/50 hover:text-white transition-colors flex-shrink-0 rounded hover:bg-white/5"
            title={copy.logout}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto" style={{ background: "hsl(var(--bg))" }}>
        {children}
      </main>
    </div>
  );
}
