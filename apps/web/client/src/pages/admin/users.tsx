import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Search, Shield, ShieldOff } from 'lucide-react';
import { useState } from 'react';

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: users, isLoading } = useQuery({
    queryKey: ['platformUsers', search],
    queryFn: () => api.platformSearchUsers(search || undefined),
  });

  const toggleMutation = useMutation({
    mutationFn: (userId: string) => api.platformToggleAdmin(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platformUsers'] });
    },
  });

  const userList = (users as any[]) || [];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <span className="cursor-pointer text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-5 w-5" />
          </span>
        </Link>
        <h1 className="text-2xl font-bold">Users</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by email..."
          className="w-full max-w-md pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Users ({userList.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : userList.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-3 pr-4 font-medium text-gray-500">User</th>
                    <th className="py-3 pr-4 font-medium text-gray-500">Status</th>
                    <th className="py-3 pr-4 font-medium text-gray-500">Workspaces</th>
                    <th className="py-3 pr-4 font-medium text-gray-500">Platform Admin</th>
                    <th className="py-3 font-medium text-gray-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userList.map((u: any) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{u.name || '—'}</div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {u.status || '—'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-500">
                        {u.workspace_users?.length || 0}
                      </td>
                      <td className="py-3 pr-4">
                        {u.is_platform_admin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                            <Shield className="h-3 w-3" /> Admin
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          size="sm"
                          variant={u.is_platform_admin ? 'outline' : 'default'}
                          onClick={() => toggleMutation.mutate(u.id)}
                          disabled={toggleMutation.isPending}
                        >
                          {toggleMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : u.is_platform_admin ? (
                            <>
                              <ShieldOff className="h-4 w-4 mr-1" /> Revoke
                            </>
                          ) : (
                            <>
                              <Shield className="h-4 w-4 mr-1" /> Grant
                            </>
                          )}
                        </Button>
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
