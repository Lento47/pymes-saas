import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

export default function AdminUsers() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/platform/users"],
    queryFn: () => api.platformSearchUsers(),
    enabled: !!user?.is_platform_admin,
    retry: false,
    staleTime: 30000,
  });

  if (isLoading) return <PageLoader />;

  const users = (Array.isArray(data) ? data : (data as any)?.data ?? []) as any[];

  return (
    <div className="min-h-full" style={{ background: "hsl(var(--bg))" }}>
      <PageHeader title="Users" description="Search and manage platform users." />

      <div className="px-6 py-6">
        {users.length === 0 ? (
          <p className="text-xs text-muted-foreground">No users found.</p>
        ) : (
          <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
            <div className="divide-y divide-border/60">
              {users.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <span className="text-xs font-medium text-foreground">{u.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">{u.email}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.is_platform_admin && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-yellow-500/20 bg-yellow-500/10 text-yellow-400">
                        Admin
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                      {u.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
