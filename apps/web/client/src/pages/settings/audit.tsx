import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  "member.invited":       { label: "Miembro invitado",      color: "bg-blue-50 text-blue-700 border-blue-200" },
  "member.role_changed":  { label: "Rol cambiado",           color: "bg-amber-50 text-amber-700 border-amber-200" },
  "member.removed":       { label: "Miembro eliminado",      color: "bg-red-50 text-red-700 border-red-200" },
  "workspace.updated":    { label: "Workspace actualizado",  color: "bg-gray-100 text-gray-600 border-gray-200" },
  "api_key.created":      { label: "API key creada",         color: "bg-green-50 text-green-700 border-green-200" },
  "api_key.revoked":      { label: "API key revocada",       color: "bg-red-50 text-red-700 border-red-200" },
  "invoice.created":      { label: "Factura creada",         color: "bg-gray-100 text-gray-600 border-gray-200" },
  "invoice.sent":         { label: "Factura enviada",        color: "bg-blue-50 text-blue-700 border-blue-200" },
  "invoice.cancelled":    { label: "Factura anulada",        color: "bg-red-50 text-red-700 border-red-200" },
  "channel.connected":    { label: "Canal conectado",        color: "bg-green-50 text-green-700 border-green-200" },
  "channel.disconnected": { label: "Canal desconectado",     color: "bg-red-50 text-red-700 border-red-200" },
  "plan.changed":         { label: "Plan cambiado",          color: "bg-violet-50 text-violet-700 border-violet-200" },
};

function actionBadge(action: string) {
  const meta = ACTION_LABELS[action];
  if (meta) return <Badge variant="outline" className={`text-xs ${meta.color}`}>{meta.label}</Badge>;
  return <Badge variant="outline" className="text-xs bg-gray-100 text-gray-500 border-gray-200">{action}</Badge>;
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/audit", page, debouncedSearch, entityType],
    queryFn: () => {
      const params: Record<string, string> = { page: String(page), limit: "25" };
      if (debouncedSearch) params.action = debouncedSearch;
      if (entityType && entityType !== "all") params.entity_type = entityType;
      return api.getAuditLogs(params);
    },
  });

  const logs: any[] = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, pages: 1 };

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
    clearTimeout((window as any).__auditSearchTimer);
    (window as any).__auditSearchTimer = setTimeout(() => setDebouncedSearch(v), 400);
  };

  return (
    <SettingsLayout>
      <div className="space-y-4 max-w-3xl">
        <p className="text-sm text-muted-foreground">
          Registro de acciones sensibles realizadas en el workspace. Solo visible para Administradores.
        </p>

        {/* Filtros */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Buscar por acción…"
              className="pl-8 h-8 text-sm border-border bg-[hsl(var(--elevated))]"
            />
          </div>
          <Select value={entityType} onValueChange={v => { setEntityType(v); setPage(1); }}>
            <SelectTrigger className="h-8 text-sm w-44 border-border bg-[hsl(var(--elevated))]">
              <SelectValue placeholder="Entidad" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="workspace_user">Miembros</SelectItem>
              <SelectItem value="invoice">Facturas</SelectItem>
              <SelectItem value="channel">Canales</SelectItem>
              <SelectItem value="api_key">API Keys</SelectItem>
              <SelectItem value="workspace">Workspace</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabla */}
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Fecha</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Acción</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Entidad</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">Cargando…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">Sin registros</td></tr>
              ) : logs.map((log: any) => (
                <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                  </td>
                  <td className="px-4 py-3">
                    {actionBadge(log.action)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                    <span className="font-mono">{log.entity_type}</span>
                    {log.entity_id && (
                      <span className="ml-1 text-muted-foreground/50 truncate max-w-[120px] inline-block align-middle">
                        :{log.entity_id.slice(-8)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell max-w-xs">
                    {log.after_json ? (
                      <span className="truncate block">
                        {Object.entries(log.after_json as Record<string, any>)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}
                      </span>
                    ) : log.before_json ? (
                      <span className="truncate block text-muted-foreground/60">eliminado</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {meta.pages > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{meta.total} registros · página {meta.page} de {meta.pages}</span>
            <div className="flex gap-1">
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                disabled={page >= meta.pages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
}
