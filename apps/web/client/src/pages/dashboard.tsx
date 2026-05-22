import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth, useAuth } from "@/hooks/use-auth";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { PageHeader } from "@/components/shared/page-header";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare, Users, Clock, CheckCircle2, AlertCircle,
  ArrowRight, TrendingUp, MessageCircle, FileText, Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

// ── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({
  icon: Icon, label, value, subtitle, color, loading, href,
}: {
  icon: any; label: string; value: number | string; subtitle?: string;
  color: string; loading?: boolean; href?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    green: "bg-green-500/10 text-green-400 border-green-500/20",
  };

  const card = (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {href && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-16 mb-1" />
      ) : (
        <p className="text-2xl font-bold text-foreground mb-1">{value}</p>
      )}
      <p className="text-sm font-medium text-foreground">{label}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );

  return href ? <Link href={href}>{card}</Link> : card;
}

// ── Quick Action ─────────────────────────────────────────────────────────────
function QuickAction({ icon: Icon, label, href }: { icon: any; label: string; href: string }) {
  return (
    <Link href={href}>
      <a className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-accent transition">
        <Icon className="w-6 h-6 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground text-center">{label}</span>
      </a>
    </Link>
  );
}

// ── Conversation Row ─────────────────────────────────────────────────────────
function ConvRow({ conv }: { conv: any }) {
  const timeAgo = conv.updated_at
    ? formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true, locale: es })
    : "";

  return (
    <Link href={`/inbox/${conv.id}`}>
      <a className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition rounded-lg">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
          {conv.contact?.full_name?.charAt(0) || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {conv.contact?.full_name || "Contacto"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {conv.last_message_preview || conv.subject || "Sin mensajes"}
          </p>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo}</span>
      </a>
    </Link>
  );
}

// ── Emprende Dashboard ───────────────────────────────────────────────────────
function EmprendeDashboard() {
  const { user } = useAuth();

  const { data: todayStats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/workspaces/current/stats/today"],
    queryFn: api.getTodayStats,
    refetchInterval: 60000,
  });

  const { data: conversations, isLoading: convsLoading } = useQuery({
    queryKey: ["/api/conversations", "dash"],
    queryFn: () => api.getConversations({ limit: "5", status: "OPEN" }),
  });

  const { data: contacts } = useQuery({
    queryKey: ["/api/contacts", "recent"],
    queryFn: () => api.getContacts({ limit: "5", sort: "created_at_desc" }),
  });

  const convList = Array.isArray(conversations) ? conversations : conversations?.data ?? [];
  const contactList = Array.isArray(contacts) ? contacts : contacts?.data ?? [];
  const pendingCount = convList.length;
  const newContacts = contactList.length;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="px-6 py-6 max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-foreground mb-1">
            {greeting()}, {user?.name?.split(" ")[0] || "Usuario"} 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            Aquí está lo más importante de tu negocio hoy.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-8 max-w-5xl mx-auto">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <MetricCard
            icon={MessageSquare}
            label="Pendientes"
            value={pendingCount}
            subtitle="conversaciones"
            color="blue"
            loading={convsLoading}
            href="/inbox"
          />
          <MetricCard
            icon={AlertCircle}
            label="Sin responder"
            value={todayStats?.unanswered_messages ?? 0}
            subtitle="mensajes"
            color="red"
            loading={statsLoading}
            href="/inbox"
          />
          <MetricCard
            icon={Users}
            label="Nuevos clientes"
            value={newContacts}
            subtitle="esta semana"
            color="green"
            loading={convsLoading}
            href="/contacts"
          />
          <MetricCard
            icon={Clock}
            label="Seguimientos"
            value={todayStats?.overdue_followups ?? 0}
            subtitle="pendientes"
            color="orange"
            loading={statsLoading}
            href="/followups"
          />
          <MetricCard
            icon={CheckCircle2}
            label="Resueltas"
            value={todayStats?.resolved_today ?? 0}
            subtitle="hoy"
            color="purple"
            loading={statsLoading}
          />
        </div>

        {/* Main content: Conversations + Recent contacts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Conversaciones activas */}
          <div className="bg-card border border-border rounded-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground text-sm">Conversaciones activas</h3>
              <Link href="/inbox">
                <a className="text-xs text-primary hover:underline">Ver todas</a>
              </Link>
            </div>
            <div className="divide-y divide-border">
              {convsLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : convList.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>No hay conversaciones pendientes</p>
                  <p className="text-xs mt-1">¡Buen trabajo! Todo está al día.</p>
                </div>
              ) : (
                convList.map((conv: any) => <ConvRow key={conv.id} conv={conv} />)
              )}
            </div>
          </div>

          {/* Clientes recientes */}
          <div className="bg-card border border-border rounded-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground text-sm">Clientes recientes</h3>
              <Link href="/contacts">
                <a className="text-xs text-primary hover:underline">Ver todos</a>
              </Link>
            </div>
            <div className="divide-y divide-border">
              {contactList.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>No hay clientes recientes</p>
                  <p className="text-xs mt-1">Conecta WhatsApp para empezar a recibir clientes.</p>
                </div>
              ) : (
                contactList.map((c: any) => (
                  <Link key={c.id} href={`/contacts/${c.id}`}>
                    <a className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition rounded-lg">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                        {c.full_name?.charAt(0) || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{c.full_name || "Sin nombre"}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.phone || c.email || "Sin contacto"}</p>
                      </div>
                    </a>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-semibold text-foreground text-sm mb-4">Acciones rápidas</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <QuickAction icon={MessageCircle} label="Enviar mensaje" href="/inbox" />
            <QuickAction icon={Users} label="Nuevo cliente" href="/contacts" />
            <QuickAction icon={FileText} label="Nueva plantilla" href="/templates" />
            <QuickAction icon={Zap} label="Preguntar a IA" href="/ia" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard (routes to correct variant) ──────────────────────────────
export default function DashboardPage() {
  useRequireAuth();
  const { data: featureData, isLoading: flagsLoading } = useFeatureFlags();

  if (flagsLoading) {
    return (
      <div className="min-h-full bg-background flex items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  const isEmprende = featureData?.profile === "emprende";

  if (isEmprende) {
    return <EmprendeDashboard />;
  }

  // For now, the existing dashboard is imported inline. 
  // Once fully migrated, this will route based on profile.
  // For Business+, we fall through to the existing dashboard.
  return <ExistingDashboard />;
}

// ── Temporary: import and re-export existing dashboard ──────────────────────
import ExistingDashboardComponent from "./dashboard-business";

function ExistingDashboard() {
  return <ExistingDashboardComponent />;
}
