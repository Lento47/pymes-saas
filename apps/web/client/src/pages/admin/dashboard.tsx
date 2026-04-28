import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/loading-spinner";
import { Crown, Users, Building2, MessageSquare, Receipt } from "lucide-react";

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
        </div>

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
