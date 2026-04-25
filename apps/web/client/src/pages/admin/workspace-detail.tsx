import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface Props {
  slug: string;
}

export default function AdminWorkspaceDetail({ slug }: Props) {
  const queryClient = useQueryClient();
  const [assignEmail, setAssignEmail] = useState('');
  const [role, setRole] = useState('AGENT');

  const { data: billing, isLoading: billingLoading } = useQuery({
    queryKey: ['platformWorkspaceBilling', slug],
    queryFn: () => api.platformGetWorkspaceBilling(slug),
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['platformMembers', slug],
    queryFn: () => api.platformListMembers(slug),
  });

  const assignMutation = useMutation({
    mutationFn: (data: { email: string }) => api.platformAssignMember(slug, { ...data, role }),
    onSuccess: () => {
      setAssignEmail('');
      queryClient.invalidateQueries({ queryKey: ['platformMembers', slug] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.platformRemoveMember(slug, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platformMembers', slug] });
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.platformUpdateMemberRole(slug, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platformMembers', slug] });
    },
  });

  const ws = (billing as any)?.workspace;
  const subscription = (billing as any)?.subscription;
  const billingEvents = (billing as any)?.events ?? [];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/admin/workspaces">
          <span className="cursor-pointer text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-5 w-5" />
          </span>
        </Link>
        <h1 className="text-2xl font-bold">{ws?.name ?? slug}</h1>
        {ws && (
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {ws.plan}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Members */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Members</CardTitle>
              <CardDescription>{(members as any[])?.length ?? 0} members</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <input
                type="email"
                placeholder="Email to assign..."
                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={assignEmail}
                onChange={(e) => setAssignEmail(e.target.value)}
              />
              <select
                className="px-3 py-2 border rounded-lg text-sm bg-white"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="AGENT">Agent</option>
                <option value="ADMIN">Admin</option>
                <option value="VIEWER">Viewer</option>
              </select>
              <Button
                size="sm"
                disabled={!assignEmail || assignMutation.isPending}
                onClick={() => assignMutation.mutate({ email: assignEmail })}
              >
                {assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assign'}
              </Button>
            </div>

            {membersLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (members as any[])?.length === 0 ? (
              <p className="text-sm text-gray-500">No members.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4 font-medium text-gray-500">User</th>
                    <th className="py-2 pr-4 font-medium text-gray-500">Role</th>
                    <th className="py-2 pr-4 font-medium text-gray-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(members as any[]).map((m: any) => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4">
                        <div className="font-medium">{m.user?.name ?? '—'}</div>
                        <div className="text-xs text-gray-500">{m.user?.email}</div>
                        {m.user?.is_platform_admin && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                            platform admin
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {m.is_owner ? (
                          <span className="text-xs font-medium text-gray-500">Owner</span>
                        ) : (
                          <select
                            className="px-2 py-1 border rounded text-xs bg-white"
                            value={m.role}
                            onChange={(e) => roleMutation.mutate({ userId: m.user.id, role: e.target.value })}
                          >
                            <option value="AGENT">Agent</option>
                            <option value="ADMIN">Admin</option>
                            <option value="VIEWER">Viewer</option>
                          </select>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {!m.is_owner && (
                          <button
                            className="text-red-500 hover:text-red-700 transition-colors p-1"
                            onClick={() => removeMutation.mutate(m.user.id)}
                            disabled={removeMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Billing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Billing</CardTitle>
          </CardHeader>
          <CardContent>
            {billingLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : subscription ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-gray-500">Plan:</span>
                  <span className="font-medium">{subscription.plan}</span>
                  <span className="text-gray-500">Status:</span>
                  <span className="font-medium">{subscription.status}</span>
                  <span className="text-gray-500">Provider:</span>
                  <span className="font-medium">{subscription.provider}</span>
                  <span className="text-gray-500">Interval:</span>
                  <span className="font-medium">{subscription.billing_interval}</span>
                </div>
                {subscription.current_period_start && (
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-gray-500">Period start:</span>
                    <span className="font-medium">
                      {new Date(subscription.current_period_start).toLocaleDateString()}
                    </span>
                    <span className="text-gray-500">Period end:</span>
                    <span className="font-medium">
                      {new Date(subscription.current_period_end).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {subscription.provider_customer_id && (
                  <div>
                    <span className="text-gray-500">Customer ID: </span>
                    <span className="font-mono text-xs">{subscription.provider_customer_id}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No subscription found.</p>
            )}

            {billingEvents.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-500 mb-2">Recent Billing Events</h4>
                <div className="space-y-2">
                  {billingEvents.map((ev: any) => (
                    <div key={ev.id} className="flex justify-between text-xs text-gray-500 border-b pb-1">
                      <span>{ev.event_type}</span>
                      <span>{new Date(ev.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
