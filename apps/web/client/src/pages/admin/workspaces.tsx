import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";

export default function AdminWorkspaces() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/platform/workspaces"],
    queryFn: api.platformListWorkspaces,
    enabled: !!user?.is_platform_admin,
    retry: false,
    staleTime: 30000,
  });

  if (isLoading) return <PageLoader />;

  const workspaces = (Array.isArray(data) ? data : (data as any)?.data ?? []) as any[];

  return (
    <div className="min-h-full" style={{ background: "hsl(var(--bg))" }}>
      <PageHeader title="Workspaces" description="Manage all platform workspaces." />

      <div className="px-6 py-6">
        {workspaces.length === 0 ? (
          <p className="text-xs text-muted-foreground">No workspaces found.</p>
        ) : (
          <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
            <div className="divide-y divide-border/60">
              {workspaces.map((ws) => (
                <Link
                  key={ws.id}
                  href={`/admin/workspaces/${ws.slug}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <span className="text-xs font-medium text-foreground">{ws.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">/{ws.slug}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                    {ws.plan}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
