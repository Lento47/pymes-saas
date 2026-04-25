import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, Search } from 'lucide-react';
import { useState } from 'react';

export default function AdminWorkspaces() {
  const [search, setSearch] = useState('');

  const { data: workspaces, isLoading } = useQuery({
    queryKey: ['platformWorkspaces'],
    queryFn: api.platformListWorkspaces,
  });

  const filtered = (workspaces as any[] || []).filter((ws: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return ws.name?.toLowerCase().includes(q) || ws.slug?.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <span className="cursor-pointer text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-5 w-5" />
          </span>
        </Link>
        <h1 className="text-2xl font-bold">Workspaces</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or slug..."
          className="w-full max-w-md pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Workspaces ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No workspaces found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-3 pr-4 font-medium text-gray-500">Name</th>
                    <th className="py-3 pr-4 font-medium text-gray-500">Slug</th>
                    <th className="py-3 pr-4 font-medium text-gray-500">Plan</th>
                    <th className="py-3 pr-4 font-medium text-gray-500">Status</th>
                    <th className="py-3 font-medium text-gray-500">Members</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ws: any) => (
                    <tr key={ws.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 pr-4">
                        <Link href={`/admin/workspaces/${ws.slug}`}>
                          <span className="text-blue-600 hover:text-blue-800 cursor-pointer font-medium">
                            {ws.name}
                          </span>
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-gray-500">{ws.slug}</td>
                      <td className="py-3 pr-4">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {ws.plan}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          ws.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {ws.status}
                        </span>
                      </td>
                      <td className="py-3 text-gray-500">{ws._count?.workspace_users ?? ws.memberCount ?? '—'}</td>
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
