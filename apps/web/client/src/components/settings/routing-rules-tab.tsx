import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Shuffle } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function RoutingRulesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [matchType, setMatchType] = useState("KEYWORD");
  const [pattern, setPattern] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [channelId, setChannelId] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["routing-rules"],
    queryFn: () => api.getRoutingRules(),
  });

  const { data: depts } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api.getDepartments(),
  });

  const { data: channels } = useQuery({
    queryKey: ["/api/channels"],
    queryFn: () => api.getChannels(),
  });

  const rules: Record<string, any>[] = Array.isArray(data) ? data : data?.data ?? [];
  const deptList: Record<string, any>[] = Array.isArray(depts) ? depts : depts?.data ?? [];
  const channelList: Record<string, any>[] = Array.isArray(channels) ? channels : channels?.data ?? [];

  const createMut = useMutation({
    mutationFn: () => api.createRoutingRule({ name, match_type: matchType, pattern: pattern || undefined, department_id: departmentId || undefined, channel_id: channelId || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routing-rules"] });
      setCreateOpen(false);
      setName(""); setPattern(""); setDepartmentId(""); setChannelId("");
      toast({ title: "Regla de enrutamiento creada" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.updateRoutingRule(id, { is_active: active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["routing-rules"] }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteRoutingRule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routing-rules"] });
      toast({ title: "Regla eliminada" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{rules.length} regla(s)</p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />Nueva regla
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Crear regla de enrutamiento</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label>Nombre</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="ej. Redirigir ventas" className="mt-1 bg-[hsl(var(--elevated))] border-border" />
              </div>
              <div>
                <Label>Tipo de coincidencia</Label>
                <Select value={matchType} onValueChange={setMatchType}>
                  <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="KEYWORD">Palabra clave</SelectItem>
                    <SelectItem value="MENU_REPLY">Respuesta de menú</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Patrón / palabra clave</Label>
                <Input value={pattern} onChange={e => setPattern(e.target.value)} placeholder="ventas, soporte, etc." className="mt-1 bg-[hsl(var(--elevated))] border-border" />
              </div>
              <div>
                <Label>Departamento (opcional)</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue placeholder="Ninguno" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {deptList.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Canal (opcional)</Label>
                <Select value={channelId} onValueChange={setChannelId}>
                  <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue placeholder="Ninguno" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {channelList.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => createMut.mutate()} disabled={!name || createMut.isPending} className="w-full bg-primary hover:bg-primary/90">
                {createMut.isPending ? "Creando..." : "Crear regla"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Cargando...</div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
              <div className="flex items-center gap-3 min-w-0">
                <Shuffle className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{rule.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="outline" className="text-xs">{rule.match_type}</Badge>
                    {rule.pattern && <span className="text-[11px] text-muted-foreground truncate">{rule.pattern}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <Badge variant="outline" className={rule.is_active ? "text-green-400 border-green-500/30" : "text-gray-400 border-gray-500/30"}>
                  {rule.is_active ? "Activo" : "Inactivo"}
                </Badge>
                <Switch
                  checked={rule.is_active}
                  onCheckedChange={(v) => toggleMut.mutate({ id: rule.id, active: v })}
                />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMut.mutate(rule.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {rules.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Sin reglas de enrutamiento.</p>
          )}
        </div>
      )}
    </div>
  );
}
