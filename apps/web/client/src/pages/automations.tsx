import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, parsePlanError } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useAuth, useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Zap, ArrowRight, CheckCircle2, GitBranch, Search, X, LayoutTemplate } from "lucide-react";
import { AutomationSheet } from "@/components/automations/AutomationSheet";
import TemplateBrowser from "@/components/templates/template-browser";

function triggerLabel(t: string) { return t.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }

export default function AutomationsPage() {
  useRequireAuth(); const { user } = useAuth();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAuto, setEditingAuto] = useState<any>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const currentPlan = user?.workspace?.plan ?? "FREE";

  const { data: automationsRaw = [], isLoading } = useQuery({ queryKey: ["/api/automations"], queryFn: api.getAutomations });
  const automations = Array.isArray(automationsRaw) ? automationsRaw : (automationsRaw as any)?.data || (automationsRaw as any)?.automations || [];
  const { data: channelsRaw = [] } = useQuery({ queryKey: ["/api/channels"], queryFn: api.getChannels });
  const channels = Array.isArray(channelsRaw) ? channelsRaw : (channelsRaw as any)?.data || (channelsRaw as any)?.channels || [];
  const { data: membersRaw } = useQuery({ queryKey: ["/api/workspaces/current/members", "automation-builder"], queryFn: api.getMembers });
  const members = Array.isArray(membersRaw) ? membersRaw : (membersRaw as any)?.data || [];

  const filteredAutomations = useMemo(() => {
    if (!searchQuery.trim()) return automations;
    const q = searchQuery.toLowerCase().trim();
    return automations.filter((a: any) =>
      a.name?.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q) ||
      a.trigger_type?.toLowerCase().includes(q) ||
      a.action_type?.toLowerCase().includes(q)
    );
  }, [automations, searchQuery]);

  const toggleMut = useMutation({ mutationFn: (id: string) => api.toggleAutomation(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/automations"] }) });
  const deleteMut = useMutation({ mutationFn: (id: string) => api.deleteAutomation(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/automations"] }); setDeleteId(null); toast({ title: 'Automatización eliminada' }); } });

  const createMut = useMutation({
    mutationFn: (data: any) => api.createAutomation(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/automations"] }); setCreateOpen(false); setEditingAuto(null); },
    onError: (err: any) => { const p = parsePlanError(err); toast({ title: p.isPlanLimit ? 'Límite de plan' : 'Error', description: p.message, variant: 'destructive' }); },
    onSettled: () => setIsSaving(false),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateAutomation(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/automations"] }); setCreateOpen(false); setEditingAuto(null); },
    onError: (err: any) => { const p = parsePlanError(err); toast({ title: p.isPlanLimit ? 'Límite de plan' : 'Error', description: p.message, variant: 'destructive' }); },
    onSettled: () => setIsSaving(false),
  });

  const handleSave = async (payload: any) => {
    setIsSaving(true);
    if (editingAuto?.id) {
      await updateMut.mutateAsync({ id: editingAuto.id, data: payload });
    } else {
      await createMut.mutateAsync(payload);
    }
  };

  const openEdit = (a: any) => { setEditingAuto(a); setCreateOpen(true); };

  const handleClose = () => {
    if (isSaving) return;
    setCreateOpen(false);
    setEditingAuto(null);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Zap className="w-4 h-4 text-violet-500" />
          <h1 className="text-[15px] font-semibold text-foreground">Automatizaciones</h1>
          <span className="text-[11px] text-muted-foreground">{automations?.length || 0} activas</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)} className="gap-1.5 rounded-xl text-[12px]">
            <LayoutTemplate className="w-[13px] h-[13px]" />Plantillas
          </Button>
          <Button onClick={() => { setEditingAuto(null); setCreateOpen(true); }} size="sm" className="gap-1.5 rounded-xl text-[12px]">
            <Plus className="w-[13px] h-[13px]" />Nueva
          </Button>
        </div>
      </header>

      {/* Search bar */}
      <div className="shrink-0 px-6 py-2 border-b border-border/60">
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar automatizaciones..."
            className="h-8 pl-8 pr-8 text-[12px] bg-background border-border rounded-lg"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Cargando...</div>
      ) : filteredAutomations.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <GitBranch className="w-10 h-10 opacity-30" />
          <p className="text-sm">
            {searchQuery ? "Sin resultados para tu búsqueda." : "Sin automatizaciones. Creá tu primera regla."}
          </p>
          {searchQuery && (
            <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")} className="text-xs">
              Limpiar búsqueda
            </Button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 pb-16 lg:pb-4 space-y-3">
          {filteredAutomations.map((auto: any) => (
            <div key={auto.id}
              className="rounded-2xl p-4 transition-all duration-200 bg-card/40 border border-border hover:bg-card/60 hover:border-border/80"
            >
              <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                <div className="flex items-center gap-2 shrink-0 pt-1">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-500/10 border border-violet-500/20">
                      <Zap className="w-3.5 h-3.5 text-violet-400" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{triggerLabel(auto.trigger_type)}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/20" />
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted/30 border border-border/40">
                      <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <span className="text-[10px] text-muted-foreground/60">Condiciones</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/20" />
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{auto.action_type ? auto.action_type.replace(/_/g,' ') : 'Acción'}</span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-[14px] font-medium text-foreground">{auto.name}</h3>
                    <span className={auto.enabled ? 'text-emerald-400' : 'text-muted-foreground'} style={{ fontSize: 10 }}>
                      {auto.enabled ? '● Activa' : '○ Pausada'}
                    </span>
                  </div>
                  {auto.description && <p className="text-[12px] text-muted-foreground mb-2">{auto.description}</p>}
                  <div className="flex items-center gap-2">
                    <Switch checked={auto.enabled} onCheckedChange={() => toggleMut.mutate(auto.id)} />
                    <span className="text-[11px] text-muted-foreground">{auto.trigger_type.replace(/_/g,' ')}</span>
                    {auto.trigger_config_json?.channel_id && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full text-muted-foreground bg-muted/30">
                        {channels?.find((c:any)=>c.id===auto.trigger_config_json.channel_id)?.name || 'Canal específico'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(auto)} className="text-muted-foreground hover:text-foreground text-xs">Editar</Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(auto.id)} className="text-red-400/60 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Sheet */}
      <AutomationSheet
        key={editingAuto?.id || "new"}
        open={createOpen}
        onOpenChange={(o) => { if (!isSaving) setCreateOpen(o); }}
        members={members}
        channels={channels}
        currentPlan={currentPlan}
        currentCount={automations.length}
        editingAuto={editingAuto}
        onSave={handleSave}
        isSaving={isSaving}
        onClose={handleClose}
      />

      {/* Delete confirm */}
      {deleteId && (
        <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <DialogContent className="max-w-sm bg-card border-border rounded-2xl">
            <DialogHeader><DialogTitle className="text-foreground text-sm">¿Eliminar automatización?</DialogTitle></DialogHeader>
            <p className="text-muted-foreground text-sm">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={() => setDeleteId(null)} className="text-muted-foreground text-xs">Cancelar</Button>
              <Button onClick={() => deleteMut.mutate(deleteId)} variant="destructive" size="sm" className="text-xs">Eliminar</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      <TemplateBrowser open={templateOpen} onClose={() => setTemplateOpen(false)} type="automation" />
    </div>
  );
}
