import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Trash2 } from "lucide-react";

export function RoutingRulesTab() {
  const { toast } = useToast();
  const { data: rules = [], isLoading, refetch } = useQuery({
    queryKey: ['routing-rules'],
    queryFn: api.getRoutingRules,
  });

  const createRule = useMutation({
    mutationFn: api.createRoutingRule,
    onSuccess: () => { refetch(); toast({ title: 'Regla creada' }); },
    onError: (err: any) => toast({ title: 'Error', description: err?.message, variant: 'destructive' }),
  });

  const deleteRule = useMutation({
    mutationFn: (id: string) => api.deleteRoutingRule(id),
    onSuccess: () => { refetch(); toast({ title: 'Regla eliminada' }); },
    onError: (err: any) => toast({ title: 'Error', description: err?.message, variant: 'destructive' }),
  });

  const toggleRule = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.updateRoutingRule(id, { is_active: active }),
    onSuccess: () => refetch(),
  });

  const [newRule, setNewRule] = useState({ name: '', pattern: '', match_type: 'KEYWORD', department_id: '', channel_id: '', priority: 0, is_active: true });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Reglas de Enrutamiento</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Nueva Regla</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">Nueva Regla de Enrutamiento</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-foreground">Nombre</Label>
                <Input value={newRule.name} onChange={e => setNewRule({ ...newRule, name: e.target.value })} placeholder="Ej: Ventas" className="bg-[hsl(var(--elevated))] border-border" />
              </div>
              <div>
                <Label className="text-foreground">Tipo de coincidencia</Label>
                <Select value={newRule.match_type} onValueChange={v => setNewRule({ ...newRule, match_type: v })}>
                  <SelectTrigger className="bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="KEYWORD">Palabra clave</SelectItem>
                    <SelectItem value="MENU_REPLY">Menú (texto exacto)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-foreground">Patrón / Palabra clave</Label>
                <Input value={newRule.pattern} onChange={e => setNewRule({ ...newRule, pattern: e.target.value })} placeholder="Ej: factura, precio, ayuda, 1, 2..." className="bg-[hsl(var(--elevated))] border-border" />
              </div>
              <div>
                <Label className="text-foreground">ID del Depto</Label>
                <Input value={newRule.department_id} onChange={e => setNewRule({ ...newRule, department_id: e.target.value })} placeholder="ID del departamento destino" className="bg-[hsl(var(--elevated))] border-border" />
              </div>
              <div>
                <Label className="text-foreground">ID del Canal (opcional)</Label>
                <Input value={newRule.channel_id} onChange={e => setNewRule({ ...newRule, channel_id: e.target.value })} placeholder="Dejar vacío para todos" className="bg-[hsl(var(--elevated))] border-border" />
              </div>
              <Button
                className="w-full"
                disabled={createRule.isPending || !newRule.name || !newRule.pattern || !newRule.department_id}
                onClick={() => {
                  createRule.mutate({
                    name: newRule.name,
                    pattern: newRule.pattern,
                    match_type: newRule.match_type,
                    department_id: newRule.department_id,
                    channel_id: newRule.channel_id || undefined,
                    priority: newRule.priority,
                    is_active: newRule.is_active,
                  });
                  setNewRule({ name: '', pattern: '', match_type: 'KEYWORD', department_id: '', channel_id: '', priority: 0, is_active: true });
                }}
              >
                {createRule.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Crear
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Cargando...</span>
        </div>
      ) : rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin reglas de enrutamiento. Creá la primera regla para distribuir mensajes automáticamente.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--elevated))]">
              <tr>
                <th className="text-left px-4 py-2 text-muted-foreground font-medium">Nombre</th>
                <th className="text-left px-4 py-2 text-muted-foreground font-medium">Patrón</th>
                <th className="text-left px-4 py-2 text-muted-foreground font-medium">Tipo</th>
                <th className="text-left px-4 py-2 text-muted-foreground font-medium">Depto</th>
                <th className="text-left px-4 py-2 text-muted-foreground font-medium">Activo</th>
                <th className="text-right px-4 py-2 text-muted-foreground font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r: any) => (
                <tr key={r.id} className="border-t border-border hover:bg-[hsl(var(--elevated))] transition-colors">
                  <td className="px-4 py-2.5 text-foreground">{r.name}</td>
                  <td className="px-4 py-2.5 text-foreground font-mono text-xs">{r.pattern}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={r.match_type === 'MENU_REPLY' ? 'secondary' : 'default'}>
                      {r.match_type === 'MENU_REPLY' ? 'Menú' : 'Keyword'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{r.department_id}</td>
                  <td className="px-4 py-2.5">
                    <Switch
                      checked={r.is_active}
                      onCheckedChange={(checked) => toggleRule.mutate({ id: r.id, active: checked })}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { if (confirm('Eliminar regla?')) deleteRule.mutate(r.id); }}
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
