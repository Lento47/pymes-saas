import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, parsePlanError } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useAuth, useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Zap, ArrowRight, CheckCircle2, GitBranch } from "lucide-react";
import { AutomationSheet } from "@/components/automations/AutomationSheet";

function triggerLabel(t: string) { return t.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }

export default function AutomationsPage() {
  useRequireAuth(); const { user } = useAuth();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAuto, setEditingAuto] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const currentPlan = user?.workspace?.plan ?? "FREE";

  const { data: automationsRaw = [], isLoading } = useQuery({ queryKey: ["/api/automations"], queryFn: api.getAutomations });
  const automations = Array.isArray(automationsRaw) ? automationsRaw : (automationsRaw as any)?.data || (automationsRaw as any)?.automations || [];
  const { data: channelsRaw = [] } = useQuery({ queryKey: ["/api/channels"], queryFn: api.getChannels });
  const channels = Array.isArray(channelsRaw) ? channelsRaw : (channelsRaw as any)?.data || (channelsRaw as any)?.channels || [];
  const { data: membersRaw } = useQuery({ queryKey: ["/api/workspaces/current/members", "automation-builder"], queryFn: api.getMembers });
  const members = Array.isArray(membersRaw) ? membersRaw : (membersRaw as any)?.data || [];

  const currentCount = automations.length;

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
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0c0c0e' }}>
      <header className="shrink-0 flex items-center justify-between px-6 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-3">
          <Zap style={{ width: 16, height: 16, color: '#a78bfa' }} />
          <h1 className="text-[15px] font-semibold text-white/90">Automatizaciones</h1>
          <span className="text-[11px] text-white/20">{automations?.length || 0} activas</span>
        </div>
        <Button onClick={() => { setEditingAuto(null); setCreateOpen(true); }} size="sm" className="gap-1.5 rounded-xl text-[12px]" style={{ background: '#8b7cf6' }}>
          <Plus style={{ width: 13, height: 13 }} />Nueva
        </Button>
      </header>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-white/20 text-sm">Cargando...</div>
      ) : automations.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-white/20">
          <GitBranch style={{ width: 40, height: 40, opacity: 0.3 }} />
          <p className="text-sm">Sin automatizaciones. Creá tu primera regla.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 pb-16 lg:pb-4 space-y-3">
          {automations.map((auto: any) => (
            <div key={auto.id}
              className="rounded-2xl p-4 transition-all duration-200 hover:bg-white/[0.01]"
              style={{ background: 'rgba(255,255,255,0.015)', border: `1px solid ${auto.enabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)'}` }}>
              <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                <div className="flex items-center gap-2 shrink-0 pt-1">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,124,246,0.12)' }}>
                      <Zap style={{ width: 14, height: 14, color: '#a78bfa' }} />
                    </div>
                    <span className="text-[10px] text-white/30">{triggerLabel(auto.trigger_type)}</span>
                  </div>
                  <ArrowRight style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.1)' }} />
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <GitBranch style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.3)' }} />
                    </div>
                    <span className="text-[10px] text-white/20">Condiciones</span>
                  </div>
                  <ArrowRight style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.1)' }} />
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.1)' }}>
                      <CheckCircle2 style={{ width: 14, height: 14, color: '#4ade80' }} />
                    </div>
                    <span className="text-[10px] text-white/30">{auto.action_type ? auto.action_type.replace(/_/g,' ') : 'Acción'}</span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-[14px] font-medium text-white/80">{auto.name}</h3>
                    <span className={auto.enabled ? 'text-green-400' : 'text-white/20'} style={{ fontSize: 10 }}>
                      {auto.enabled ? '● Activa' : '○ Pausada'}
                    </span>
                  </div>
                  {auto.description && <p className="text-[12px] text-white/20 mb-2">{auto.description}</p>}
                  <div className="flex items-center gap-2">
                    <Switch checked={auto.enabled} onCheckedChange={() => toggleMut.mutate(auto.id)} />
                    <span className="text-[11px] text-white/20">{auto.trigger_type.replace(/_/g,' ')}</span>
                    {auto.trigger_config_json?.channel_id && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white/20" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        {channels?.find((c:any)=>c.id===auto.trigger_config_json.channel_id)?.name || 'Canal específico'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(auto)} style={{ color: 'rgba(255,255,255,0.3)' }} className="hover:text-white/60">Editar</Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(auto.id)} style={{ color: 'rgba(248,113,113,0.4)' }}><Trash2 style={{ width: 14, height: 14 }} /></Button>
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
          <DialogContent className="max-w-sm" style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16 }}>
            <DialogHeader><DialogTitle className="text-white">¿Eliminar automatización?</DialogTitle></DialogHeader>
            <p className="text-white/40 text-sm">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={() => setDeleteId(null)} className="text-white/40">Cancelar</Button>
              <Button onClick={() => deleteMut.mutate(deleteId)} style={{ background: '#ef4444' }}>Eliminar</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
