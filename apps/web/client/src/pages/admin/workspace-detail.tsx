import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Crown, Calendar, CreditCard } from "lucide-react";

export default function AdminWorkspaceDetail() {
  const { user } = useAuth();
  const [location] = useLocation();
  const slug = location.split("/").pop() ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["/api/platform/workspace", slug],
    queryFn: () => api.platformGetWorkspaceBySlug(slug),
    enabled: !!user?.is_platform_admin && !!slug,
    retry: false,
  });

  if (isLoading) return <PageLoader />;

  const ws = data ?? {};

  return (
    <div className="min-h-full" style={{ background: "hsl(var(--bg))" }}>
      <PageHeader
        title={ws.name ?? slug}
        description="Workspace details and configuration."
      >
        <Badge variant="outline" className="text-[10px]">{ws.plan}</Badge>
      </PageHeader>

      <div className="px-6 py-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-card/40 p-4">
            <div className="text-[11px] text-muted-foreground">Slug</div>
            <div className="text-sm font-medium text-foreground">{ws.slug}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/40 p-4">
            <div className="text-[11px] text-muted-foreground">Status</div>
            <div className="text-sm font-medium text-foreground">{ws.status ?? "ACTIVE"}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/40 p-4">
            <div className="text-[11px] text-muted-foreground">Created</div>
            <div className="text-sm font-medium text-foreground">
              {ws.created_at ? new Date(ws.created_at).toLocaleDateString() : "—"}
            </div>
          </div>
        </div>

        {ws.subscription && (
          <div className="rounded-xl border border-border/60 bg-card/40 p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" /> Subscription
            </h3>
            <div className="grid gap-3 md:grid-cols-2 text-xs">
              <div><span className="text-muted-foreground">Provider:</span> <span className="text-foreground">{ws.subscription.provider}</span></div>
              <div><span className="text-muted-foreground">Plan:</span> <span className="text-foreground">{ws.subscription.plan}</span></div>
              <div><span className="text-muted-foreground">Status:</span> <span className="text-foreground">{ws.subscription.status}</span></div>
              <div><span className="text-muted-foreground">Interval:</span> <span className="text-foreground">{ws.subscription.billing_interval}</span></div>
            </div>
          </div>
        )}

        {ws.enterpriseConfig && (
          <div className="rounded-xl border border-border/60 bg-card/40 p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Enterprise Configuration</h3>
            <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap">
              {JSON.stringify(ws.enterpriseConfig, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
