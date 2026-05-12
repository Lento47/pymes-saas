import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/loading-spinner";
import { Crown, Users, Building2, MessageSquare, Receipt, BarChart3 } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  alimentacion_bebidas: "Alimentación y bebidas",
  servicios_profesionales: "Servicios profesionales",
  comercio_ventas: "Comercio y ventas",
  salud_bienestar: "Salud y bienestar",
  educacion_formacion: "Educación y formación",
  tecnologia_software: "Tecnología y software",
  construccion_remodelacion: "Construcción y remodelación",
  transporte_logistica: "Transporte y logística",
  turismo_hospitalidad: "Turismo y hospitalidad",
  belleza_estetica: "Belleza y estética",
  entretenimiento_eventos: "Entretenimiento y eventos",
  agropecuario: "Agropecuario",
  servicios_hogar: "Servicios del hogar",
  manufactura_artesania: "Manufactura y artesanía",
  bienes_raices: "Bienes raíces",
  otro: "Otro",
};

export default function AdminDashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/platform/stats"],
    queryFn: api.platformGetStats,
    enabled: !!user?.is_platform_admin,
    retry: false,
    staleTime: 30000,
  });

  if (isLoading) return <PageLoader />;

  const s = (stats as any) ?? {};

  return (
    <div className="min-h-full" style={{ background: "hsl(var(--bg))" }}>
      <PageHeader title="Admin Dashboard" description="Platform-wide metrics and overview." />

      <div className="px-6 py-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={<Building2 />} label="Workspaces" value={s.totalWorkspaces ?? "—"} />
          <StatCard icon={<Users />} label="Users" value={s.totalUsers ?? "—"} />
          <StatCard icon={<Receipt />} label="Paying Workspaces" value={s.payingWorkspaces ?? "—"} />
          <StatCard icon={<MessageSquare />} label="Sales Inquiries" value={s.pendingInquiries ?? "—"} />
          {s.profiledWorkspaces != null && (
            <StatCard icon={<BarChart3 />} label="Con perfil de negocio" value={s.profiledWorkspaces} />
          )}
        </div>

        {s.categoriesDistribution?.length > 0 && (
          <div className="mt-8 rounded-xl border border-border/60 bg-card/40 p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Distribución por sector</h2>
            </div>
            <div className="flex flex-col gap-2">
              {(s.categoriesDistribution as { category: string; count: number }[]).map(d => {
                const max = s.categoriesDistribution[0].count;
                return (
                  <div key={d.category} className="flex items-center gap-3">
                    <div className="w-44 text-xs text-muted-foreground text-right truncate shrink-0">
                      {CATEGORY_LABELS[d.category] ?? d.category}
                    </div>
                    <div className="flex-1 h-4 rounded overflow-hidden" style={{ background: "hsl(var(--border))" }}>
                      <div
                        className="h-full rounded transition-all duration-500"
                        style={{ width: `${(d.count / max) * 100}%`, background: "hsl(var(--accent))", minWidth: d.count > 0 ? "4px" : "0" }}
                      />
                    </div>
                    <div className="w-6 text-xs font-semibold text-foreground shrink-0">{d.count}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {s.registrationsByMonth?.length > 0 && (
          <div className="mt-6 rounded-xl border border-border/60 bg-card/40 p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Registros últimos 12 meses</h2>
            <div className="flex items-end gap-1.5" style={{ height: "80px" }}>
              {(s.registrationsByMonth as { month: string; count: number }[]).map(d => {
                const max = Math.max(...s.registrationsByMonth.map((r: any) => r.count), 1);
                return (
                  <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-xs text-muted-foreground font-medium">{d.count || ""}</div>
                    <div
                      className="w-full rounded-t"
                      style={{ height: `${(d.count / max) * 56}px`, background: "hsl(var(--accent))", minHeight: d.count > 0 ? "4px" : "0" }}
                    />
                    <div className="text-xs text-muted-foreground" style={{ transform: "rotate(-45deg)", whiteSpace: "nowrap", fontSize: "9px" }}>
                      {d.month.slice(5)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {s.recentSignups?.length > 0 && (
          <div className="mt-8 rounded-xl border border-border/60 bg-card/40 p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Recent Signups</h2>
            <div className="divide-y divide-border/60">
              {s.recentSignups.map((ws: any, i: number) => (
                <div key={ws.id ?? i} className="flex items-center justify-between py-2 text-xs">
                  <div>
                    <span className="text-foreground font-medium">{ws.name}</span>
                    <span className="text-muted-foreground ml-2">{ws.slug}</span>
                  </div>
                  <span className="text-muted-foreground">{ws.plan}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
}
