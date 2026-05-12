import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, Trash2, Copy, AlertTriangle } from "lucide-react";

export function ApiTokensTab() {
  const { toast } = useToast();
  const { data: tokens = [], isLoading, refetch } = useQuery({
    queryKey: ['api-tokens'],
    queryFn: api.getApiTokens,
  });

  const createToken = useMutation({
    mutationFn: (name: string) => api.createApiToken(name),
    onSuccess: (data: any) => {
      refetch();
      setNewToken(data?.token || null);
      toast({ title: 'Token creado' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err?.message, variant: 'destructive' }),
  });

  const revokeToken = useMutation({
    mutationFn: (id: string) => api.revokeApiToken(id),
    onSuccess: () => { refetch(); toast({ title: 'Token revocado' }); },
    onError: (err: any) => toast({ title: 'Error', description: err?.message, variant: 'destructive' }),
  });

  const [name, setName] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">API Keys</h2>
          <p className="text-sm text-muted-foreground mt-1">Tokens de acceso para aplicaciones externas.</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Nuevo Token</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader><DialogTitle className="text-foreground">Generar API Key</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-foreground">Nombre</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: App de facturación" className="bg-[hsl(var(--elevated))] border-border" />
              </div>
              <Button className="w-full" disabled={createToken.isPending || !name.trim()} onClick={() => { createToken.mutate(name.trim()); setName(''); }}>
                {createToken.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Generar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {newToken && (
        <div className="rounded-lg p-4 border border-yellow-500/30 bg-yellow-500/5 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-semibold text-yellow-400">¡Guardá este token! No se mostrará de nuevo.</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-black/30 rounded px-3 py-2 text-xs text-yellow-200 break-all font-mono">{newToken}</code>
            <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(newToken); toast({ title: 'Copiado' }); }}><Copy className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-4"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Cargando...</span></div>
      ) : tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin API keys creadas aún. Requiere plan Enterprise.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--elevated))]"><tr><th className="text-left px-4 py-2 text-muted-foreground font-medium">Nombre</th><th className="text-left px-4 py-2 text-muted-foreground font-medium">Creado</th><th className="text-left px-4 py-2 text-muted-foreground font-medium">Último uso</th><th className="text-right px-4 py-2 text-muted-foreground font-medium"></th></tr></thead>
            <tbody>
              {tokens.map((t: any) => (
                <tr key={t.id} className="border-t border-border hover:bg-[hsl(var(--elevated))] transition-colors">
                  <td className="px-4 py-2.5 text-foreground font-medium">{t.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{t.created_at ? new Date(t.created_at).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{t.last_used_at ? new Date(t.last_used_at).toLocaleString() : 'Nunca'}</td>
                  <td className="px-4 py-2.5 text-right"><Button variant="ghost" size="sm" onClick={() => { if (confirm('¿Revocar?')) revokeToken.mutate(t.id); }}><Trash2 className="h-4 w-4 text-red-400" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
