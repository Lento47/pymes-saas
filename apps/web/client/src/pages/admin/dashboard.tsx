import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Building2, Users, TrendingUp, ArrowRight, Shield } from 'lucide-react';

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['platformStats'],
    queryFn: api.platformGetStats,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const totalWorkspaces = stats?.totalWorkspaces ?? 0;
  const totalUsers = stats?.totalUsers ?? 0;
  const planDistribution: Record<string, number> = stats?.planDistribution ?? {};
  const statusDistribution: Record<string, number> = stats?.statusDistribution ?? {};
  const recentWorkspaces: any[] = stats?.recentWorkspaces ?? [];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold">Platform Admin</h1>

      <div className="flex flex-wrap gap-3">
        <Link href="/admin/workspaces">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 cursor-pointer transition">
            <Building2 className="h-4 w-4" />
            Workspaces
          </span>
        </Link>
        <Link href="/admin/users">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100 cursor-pointer transition">
            <Shield className="h-4 w-4" />
            Users
          </span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Workspaces</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <span className="text-3xl font-bold">{totalWorkspaces}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              <span className="text-3xl font-bold">{totalUsers}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Active Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <span className="text-3xl font-bold">
                {Object.keys(planDistribution).length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(planDistribution).length === 0 ? (
              <p className="text-sm text-gray-500">No workspaces yet.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(planDistribution).map(([plan, count]) => (
                  <div key={plan} className="flex justify-between items-center">
                    <span className="text-sm font-medium">{plan}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.round((count / totalWorkspaces) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(statusDistribution).length === 0 ? (
              <p className="text-sm text-gray-500">No data.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(statusDistribution).map(([status, count]) => (
                  <div key={status} className="flex justify-between items-center">
                    <span className="text-sm font-medium capitalize">{status.toLowerCase()}</span>
                    <span className="text-sm text-gray-600">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Workspaces</CardTitle>
          <Link href="/admin/workspaces">
            <span className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer">
              View All <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </CardHeader>
        <CardContent>
          {recentWorkspaces.length === 0 ? (
            <p className="text-sm text-gray-500">No workspaces yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4 font-medium text-gray-500">Name</th>
                    <th className="py-2 pr-4 font-medium text-gray-500">Slug</th>
                    <th className="py-2 pr-4 font-medium text-gray-500">Plan</th>
                    <th className="py-2 font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentWorkspaces.map((ws: any) => (
                    <tr key={ws.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4">
                        <Link href={`/admin/workspaces/${ws.slug}`}>
                          <span className="text-blue-600 hover:text-blue-800 cursor-pointer font-medium">
                            {ws.name}
                          </span>
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-gray-500">{ws.slug}</td>
                      <td className="py-2 pr-4">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {ws.plan}
                        </span>
                      </td>
                      <td className="py-2">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {ws.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
