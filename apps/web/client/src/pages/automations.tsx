import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, parsePlanError } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useAuth, useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Trash2, Zap, ArrowRight, CheckCircle2, AlertTriangle, Clock, GitBranch } from "lucide-react";

const TRIGGER_TYPES = ["MESSAGE_RECEIVED","CONVERSATION_CREATED","CONVERSATION_STATUS_CHANGED","TASK_CREATED","TASK_OVERDUE","DOCUMENT_UPLOADED","DOCUMENT_PROCESSED","SCHEDULED","MANUAL"] as const;
const ACTION_TYPES = [{ value:"notify_in_app",label:"Notificar en app" },{ value:"set_priority",label:"Cambiar prioridad" },{ value:"set_status",label:"Cambiar estado" },{ value:"assign",label:"Asignar agente" },{ value:"create_task",label:"Crear tarea" }] as const;

function triggerLabel(t: string) { return t.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }

export default function AutomationsPage() {
  useRequireAuth(); const { user } = useAuth();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAuto, setEditingAuto] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: automationsRaw = [], isLoading } = useQuery({ queryKey: ["/api/automations"], queryFn: api.getAutomations });
  const automations = Array.isArray(automationsRaw) ? automationsRaw : (automationsRaw as any)?.data || (automationsRaw as any)?.automations || [];
  const { data: channelsRaw = [] } = useQuery({ queryKey: ["/api/channels"], queryFn: api.getChannels });
  const channels = Array.isArray(channelsRaw) ? channelsRaw : (channelsRaw as any)?.data || (channelsRaw as any)?.channels || [];

  const toggleMut = useMutation({ mutationFn: (id: string) => api.toggleAutomation(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/automations"] }) });
  const deleteMut = useMutation({ mutationFn: (id: string) => api.deleteAutomation(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/automations"] }); setDeleteId(null); toast({ title: 'Automatización eliminada' }); } });

  const [name, setName] = useState(''); const [trigger, setTrigger] = useState('MESSAGE_RECEIVED');
  const [desc, setDesc] = useState(''); const [actionType, setActionType] = useState('notify_in_app');
  const [actionValue, setActionValue] = useState('');
  const [channelId, setChannelId] = useState('');

  const saveMut = useMutation({
    mutationFn: () => {
      const data: any = { name, description: desc, trigger_type: trigger, action_type: actionType,
        trigger_config_json: channelId ? { channel_id: channelId } : {},
        action_config_json: { value: actionValue, type: actionType } };
      return editingAuto ? api.updateAutomation(editingAuto.id, data) : api.createAutomation(data);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/automations"] }); setCreateOpen(false); setEditingAuto(null); resetForm(); },
    onError: (err: any) => { const p = parsePlanError(err); toast({ title: p.isPlanLimit ? 'Límite de plan' : 'Error', description: p.message, variant: 'destructive' }); }
  });

  const resetForm = () => { setName(''); setTrigger('MESSAGE_RECEIVED'); setDesc(''); setActionType('notify_in_app'); setActionValue(''); setChannelId(''); setEditingAuto(null); };

  const openEdit = (a: any) => { setEditingAuto(a); setName(a.name); setTrigger(a.trigger_type); setDesc(a.description||''); setActionType(a.action_type||'notify_in_app'); setActionValue(a.action_config_json?.value||''); setChannelId(a.trigger_config_json?.channel_id||''); setCreateOpen(true); };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0c0c0e' }}>
      <header className="shrink-0 flex items-center justify-between px-6 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-3">
          <Zap style={{ width: 16, height: 16, color: '#a78bfa' }} />
          <h1 className="text-[15px] font-semibold text-white/90">Automatizaciones</h1>
          <span className="text-[11px] text-white/20">{automations?.length || 0} activas</span>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }} size="sm" className="gap-1.5 rounded-xl text-[12px]" style={{ background: '#8b7cf6' }}>
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
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {automations.map((auto: any) => (
            <div key={auto.id}
              className="rounded-2xl p-4 transition-all duration-200 hover:bg-white/[0.01]"
              style={{ background: 'rgba(255,255,255,0.015)', border: `1px solid ${auto.enabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)'}` }}>
              <div className="flex items-start gap-4">
                {/* Workflow visualization */}
                <div className="flex items-center gap-2 shrink-0 pt-1" style={{ minWidth: 200 }}>
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

      {/* Create/Edit Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md" style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16 }}>
          <DialogHeader><DialogTitle className="text-white text-base">{editingAuto ? 'Editar Automatización' : 'Nueva Automatización'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-white/50 text-[12px]">Nombre *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Notificar soporte urgente" className="mt-1 text-[13px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'white' }} /></div>
            <div><Label className="text-white/50 text-[12px]">Descripción</Label><Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Opcional" className="mt-1 text-[13px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'white' }} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-white/50 text-[12px]">Trigger</Label>
                <Select value={trigger} onValueChange={setTrigger}>
                  <SelectTrigger style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'white' }}><SelectValue /></SelectTrigger>
                  <SelectContent style={{ background: '#1a1a1d', border: '1px solid rgba(255,255,255,0.06)' }}>{TRIGGER_TYPES.map(t => <SelectItem key={t} value={t}>{triggerLabel(t)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-white/50 text-[12px]">Acción</Label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'white' }}><SelectValue /></SelectTrigger>
                  <SelectContent style={{ background: '#1a1a1d', border: '1px solid rgba(255,255,255,0.06)' }}>{ACTION_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-white/50 text-[12px]">Valor de acción</Label><Input value={actionValue} onChange={e => setActionValue(e.target.value)} placeholder="Ej: URGENT, ID de usuario, etc." className="mt-1 text-[13px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'white' }} /></div>
            {trigger === 'MESSAGE_RECEIVED' && (
              <div><Label className="text-white/50 text-[12px]">Canal (opcional)</Label>
                <Select value={channelId} onValueChange={setChannelId}>
                  <SelectTrigger style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'white' }}><SelectValue placeholder="Todos los canales" /></SelectTrigger>
                  <SelectContent style={{ background: '#1a1a1d', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <SelectItem value="">Todos</SelectItem>
                    {channels?.map((c:any) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.type})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !name} className="w-full gap-2" style={{ background: '#8b7cf6' }}>
              {saveMut.isPending ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Zap style={{ width: 14, height: 14 }} />}
              {editingAuto ? 'Actualizar' : 'Crear Automatización'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
