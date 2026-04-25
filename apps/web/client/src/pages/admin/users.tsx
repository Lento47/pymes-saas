import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  Unlock,
} from 'lucide-react';
import { useState } from 'react';

const emptyNewUser = {
  name: '',
  email: '',
  password: '',
  is_platform_admin: false,
};

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [newUser, setNewUser] = useState(emptyNewUser);

  const { data: users, isLoading } = useQuery({
    queryKey: ['platformUsers', search],
    queryFn: () => api.platformSearchUsers(search || undefined),
  });

  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: ['platformUsers'] });
  };

  const createMutation = useMutation({
    mutationFn: () => api.platformCreateUser(newUser),
    onSuccess: () => {
      setNewUser(emptyNewUser);
      invalidateUsers();
      toast({ title: 'User created' });
    },
    onError: (error: any) => toast({ title: 'Create failed', description: parseError(error), variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: (userId: string) => api.platformToggleAdmin(userId),
    onSuccess: () => {
      invalidateUsers();
      toast({ title: 'Platform admin updated' });
    },
    onError: (error: any) => toast({ title: 'Update failed', description: parseError(error), variant: 'destructive' }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      api.platformUpdateUserStatus(userId, status),
    onSuccess: () => {
      invalidateUsers();
      toast({ title: 'User status updated' });
    },
    onError: (error: any) => toast({ title: 'Status update failed', description: parseError(error), variant: 'destructive' }),
  });

  const passwordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      api.platformUpdateUserPassword(userId, password),
    onSuccess: () => toast({ title: 'Password changed' }),
    onError: (error: any) => toast({ title: 'Password change failed', description: parseError(error), variant: 'destructive' }),
  });

  const resetMutation = useMutation({
    mutationFn: (userId: string) => api.platformResetUserPassword(userId),
    onSuccess: (result: any) => {
      const temp = result?.temporary_password;
      if (temp) {
        void navigator.clipboard?.writeText(temp).catch(() => undefined);
        window.alert(`Temporary password:\n\n${temp}\n\nIt has been copied to the clipboard when supported.`);
      }
      toast({ title: 'Password reset generated' });
    },
    onError: (error: any) => toast({ title: 'Password reset failed', description: parseError(error), variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => api.platformDeleteUser(userId),
    onSuccess: () => {
      invalidateUsers();
      toast({ title: 'User deleted' });
    },
    onError: (error: any) => toast({ title: 'Delete failed', description: parseError(error), variant: 'destructive' }),
  });

  const userList = (users as any[]) || [];
  const busy =
    createMutation.isPending ||
    toggleMutation.isPending ||
    statusMutation.isPending ||
    passwordMutation.isPending ||
    resetMutation.isPending ||
    deleteMutation.isPending;

  const createUser = (event: React.FormEvent) => {
    event.preventDefault();
    createMutation.mutate();
  };

  const changePassword = (user: any) => {
    const password = window.prompt(`New password for ${user.email}`);
    if (!password) return;
    passwordMutation.mutate({ userId: user.id, password });
  };

  const resetPassword = (user: any) => {
    if (!window.confirm(`Generate a temporary password for ${user.email}? Existing sessions will be revoked.`)) return;
    resetMutation.mutate(user.id);
  };

  const updateStatus = (user: any, status: string) => {
    const action = status === 'ACTIVE' ? 'unlock' : 'lock out';
    if (!window.confirm(`Are you sure you want to ${action} ${user.email}?`)) return;
    statusMutation.mutate({ userId: user.id, status });
  };

  const deleteUser = (user: any) => {
    if (!window.confirm(`Delete ${user.email}? This cannot be undone.`)) return;
    deleteMutation.mutate(user.id);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <span className="cursor-pointer text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-5 w-5" />
          </span>
        </Link>
        <h1 className="text-2xl font-bold">Users</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add User</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createUser} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
            <input
              type="text"
              placeholder="Name"
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={newUser.name}
              onChange={(e) => setNewUser((current) => ({ ...current, name: e.target.value }))}
              required
            />
            <input
              type="email"
              placeholder="Email"
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={newUser.email}
              onChange={(e) => setNewUser((current) => ({ ...current, email: e.target.value }))}
              required
            />
            <input
              type="text"
              placeholder="Temporary password"
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={newUser.password}
              onChange={(e) => setNewUser((current) => ({ ...current, password: e.target.value }))}
              required
            />
            <label className="flex items-center gap-2 whitespace-nowrap text-sm text-gray-600">
              <input
                type="checkbox"
                checked={newUser.is_platform_admin}
                onChange={(e) => setNewUser((current) => ({ ...current, is_platform_admin: e.target.checked }))}
              />
              Admin
            </label>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
              Create
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by email..."
          className="w-full max-w-md rounded-lg border py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <p className="py-4 text-sm text-gray-500">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b text-left">
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
                        <div className="font-medium">{u.name || '-'}</div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : u.status === 'BANNED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}>
                          {u.status || '-'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-500">
                        {u.workspace_users?.length || 0}
                      </td>
                      <td className="py-3 pr-4">
                        {u.is_platform_admin ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                            <Shield className="h-3 w-3" /> Admin
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            size="sm"
                            variant={u.is_platform_admin ? 'outline' : 'default'}
                            onClick={() => toggleMutation.mutate(u.id)}
                            disabled={busy}
                          >
                            {u.is_platform_admin ? <ShieldOff className="mr-1 h-4 w-4" /> : <Shield className="mr-1 h-4 w-4" />}
                            {u.is_platform_admin ? 'Revoke' : 'Grant'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => changePassword(u)} disabled={busy}>
                            <KeyRound className="mr-1 h-4 w-4" />
                            Change
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => resetPassword(u)} disabled={busy}>
                            <KeyRound className="mr-1 h-4 w-4" />
                            Reset
                          </Button>
                          {u.status === 'BANNED' ? (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(u, 'ACTIVE')} disabled={busy}>
                              <Unlock className="mr-1 h-4 w-4" />
                              Unlock
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(u, 'BANNED')} disabled={busy}>
                              <Lock className="mr-1 h-4 w-4" />
                              Lock
                            </Button>
                          )}
                          <Button size="sm" variant="destructive" onClick={() => deleteUser(u)} disabled={busy}>
                            <Trash2 className="mr-1 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
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

function parseError(error: any) {
  const raw = error?.message ?? 'Request failed.';
  const separator = raw.indexOf(': ');
  if (separator < 0) return raw;
  const rest = raw.slice(separator + 2);
  try {
    const parsed = JSON.parse(rest) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (typeof parsed.message === 'string') return parsed.message;
  } catch {
    return rest;
  }
  return rest;
}
