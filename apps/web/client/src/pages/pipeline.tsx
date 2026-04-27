import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Plus, User, Calendar, DollarSign, Trash2, Trophy, GripVertical, KanbanSquare } from "lucide-react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

interface Deal { id: string; title: string; value: string | null; currency: string; priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; status: "OPEN" | "WON" | "LOST"; closing_date: string | null; notes: string | null; stage_id: string; contact: { id: string; full_name: string; company_name?: string | null } | null; assigned_user: { id: string; name: string } | null; created_at: string; }

interface Stage { id: string; name: string; color: string; order: number; deals: Deal[]; }

const PRIORITY_COLORS: Record<Deal["priority"], string> = { LOW: "text-white/30", MEDIUM: "text-[#a78bfa]", HIGH: "text-amber-400", URGENT: "text-rose-400", };
const PRIORITY_LABELS: Record<Deal["priority"], string> = { LOW: "Baja", MEDIUM: "Media", HIGH: "Alta", URGENT: "Urgente", };

function fmtCRC(val: string | null, currency: string) { if (!val) return null; const n = parseFloat(val); if (isNaN(n)) return null; return new Intl.NumberFormat("es-CR", { style: "currency", currency, maximumFractionDigits: 0 }).format(n); }
function columnTotal(deals: Deal[]) { const s = deals.reduce((acc, d) => acc + (d.value ? parseFloat(d.value) : 0), 0); if (s === 0) return null; return new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(s); }

function DealCard({ deal, onDragStart, onClick }: { deal: Deal; onDragStart: (e: React.DragEvent, dealId: string) => void; onClick: (deal: Deal) => void; }) {
  return (
    <div draggable onDragStart={(e) => onDragStart(e, deal.id)} onClick={() => onClick(deal)}
      className="rounded-xl p-3 cursor-grab active:cursor-grabbing select-none transition-all duration-200 hover:scale-[1.01] hover:shadow-lg active:opacity-70 group"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
      <div className="flex items-start gap-2">
        <GripVertical style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.1)', marginTop: 2 }} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex-1 min-w-0">
          <div className="text-white text-[13px] font-medium leading-snug mb-2">{deal.title}</div>
          {deal.value && (
            <div className="flex items-center gap-1 mb-1.5">
              <DollarSign style={{ width: 10, height: 10 }} className="text-white/20" />
              <span className="text-[12px] font-semibold text-[#a78bfa]">{fmtCRC(deal.value, deal.currency)}</span>
            </div>
          )}
          {deal.contact && (
            <div className="flex items-center gap-1 mb-1 text-white/40">
              <User style={{ width: 10, height: 10 }} />
              <span className="text-[11px] truncate">{deal.contact.full_name}</span>
            </div>
          )}
          {deal.closing_date && (
            <div className="flex items-center gap-1 text-white/20">
              <Calendar style={{ width: 10, height: 10 }} />
              <span className="text-[11px]">{format(new Date(deal.closing_date), "dd/MM/yy")}</span>
            </div>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className={cn("text-[10px] font-medium", PRIORITY_COLORS[deal.priority])}>{PRIORITY_LABELS[deal.priority]}</span>
            {deal.assigned_user && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white/30" style={{ background: 'rgba(255,255,255,0.04)' }}>
                {deal.assigned_user.name.split(" ")[0]}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ stage, onDragStart, onDrop, onAddDeal, onClickDeal }: { stage: Stage; onDragStart: (e: React.DragEvent, dealId: string) => void; onDrop: (e: React.DragEvent, stageId: string) => void; onAddDeal: (stageId: string) => void; onClickDeal: (deal: Deal) => void; }) {
  const [over, setOver] = useState(false);
  const total = columnTotal(stage.deals);
  return (
    <div className="flex flex-col shrink-0 rounded-2xl transition-all duration-300"
      style={{ width: 270, background: 'rgba(255,255,255,0.015)', border: `1px solid ${over ? 'rgba(139,124,246,0.25)' : 'rgba(255,255,255,0.04)'}` }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { setOver(false); onDrop(e, stage.id); }}>
      <div className="px-3 py-3 flex items-center gap-2 rounded-t-2xl" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
        <span className="flex-1 text-[13px] font-semibold text-white/80 truncate">{stage.name}</span>
        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${stage.color}18`, color: stage.color }}>{stage.deals.length}</span>
      </div>
      {total && <div className="px-3 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}><span className="text-[11px] text-white/20">{total}</span></div>}
      <div className={cn("flex-1 flex flex-col gap-2 p-2 min-h-[80px] transition-colors", over && "bg-[#8b7cf6]/[0.03]")}>
        {stage.deals.map(deal => <DealCard key={deal.id} deal={deal} onDragStart={onDragStart} onClick={onClickDeal} />)}
        {stage.deals.length === 0 && (
          <div className="flex-1 flex items-center justify-center rounded-xl text-[11px] text-white/10" style={{ border: '1px dashed rgba(255,255,255,0.04)', minHeight: 60 }}>Arrastra aquí</div>
        )}
      </div>
      <button onClick={() => onAddDeal(stage.id)}
        className="flex items-center justify-center gap-1.5 px-3 py-2.5 w-full hover:bg-white/[0.02] transition-colors rounded-b-2xl text-white/20 hover:text-white/40"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <Plus style={{ width: 12, height: 12 }} /><span style={{ fontSize: 12 }}>Agregar</span>
      </button>
    </div>
  );
}

function DealModal({ open, onClose, stages, deal, defaultStageId }: { open: boolean; onClose: () => void; stages: Stage[]; deal?: Deal | null; defaultStageId?: string; }) {
  const qc = useQueryClient(); const { toast } = useToast(); const isEdit = !!deal;
  const [form, setForm] = useState<any>(() => ({ title: deal?.title ?? "", value: deal?.value ?? "", currency: deal?.currency ?? "CRC", priority: deal?.priority ?? "MEDIUM", stage_id: deal?.stage_id ?? defaultStageId ?? stages[0]?.id ?? "", closing_date: deal?.closing_date ? deal.closing_date.slice(0, 10) : "", notes: deal?.notes ?? "", contact_id: deal?.contact?.id ?? "", }));
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));
  const { data: contacts } = useQuery({ queryKey: ["/api/contacts"], queryFn: () => api.getContacts(), staleTime: 30000 });
  const createMut = useMutation({ mutationFn: (data: any) => api.createDeal(data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pipeline/stages"] }); onClose(); }, onError: () => toast({ title: "Error al crear deal", variant: "destructive" }) });
  const updateMut = useMutation({ mutationFn: (data: any) => api.updateDeal(deal!.id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pipeline/stages"] }); onClose(); } });
  const deleteMut = useMutation({ mutationFn: () => api.deleteDeal(deal!.id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pipeline/stages"] }); onClose(); } });
  const winMut = useMutation({ mutationFn: () => api.winDeal(deal!.id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pipeline/stages"] }); onClose(); } });
  const handleSubmit = () => {
    if (!form.title) return;
    const data = { ...form, value: form.value ? parseFloat(form.value) : 0 };
    isEdit ? updateMut.mutate(data) : createMut.mutate(data);
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16 }}>
        <DialogHeader><DialogTitle className="text-white text-base">{isEdit ? 'Editar Deal' : 'Nuevo Deal'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-white/50 text-[12px]">Título *</Label><Input value={form.title} onChange={e => set('title', e.target.value)} className="mt-1 text-[13px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'white' }} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-white/50 text-[12px]">Valor</Label><Input type="number" value={form.value} onChange={e => set('value', e.target.value)} className="mt-1 text-[13px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'white' }} /></div>
            <div><Label className="text-white/50 text-[12px]">Moneda</Label>
              <Select value={form.currency} onValueChange={v => set('currency', v)}>
                <SelectTrigger style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'white' }}><SelectValue /></SelectTrigger>
                <SelectContent style={{ background: '#1a1a1d', border: '1px solid rgba(255,255,255,0.06)' }}><SelectItem value="CRC">CRC</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-white/50 text-[12px]">Prioridad</Label>
              <Select value={form.priority} onValueChange={v => set('priority', v)}>
                <SelectTrigger style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'white' }}><SelectValue /></SelectTrigger>
                <SelectContent style={{ background: '#1a1a1d', border: '1px solid rgba(255,255,255,0.06)' }}><SelectItem value="LOW">Baja</SelectItem><SelectItem value="MEDIUM">Media</SelectItem><SelectItem value="HIGH">Alta</SelectItem><SelectItem value="URGENT">Urgente</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-white/50 text-[12px]">Stage</Label>
              <Select value={form.stage_id} onValueChange={v => set('stage_id', v)}>
                <SelectTrigger style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'white' }}><SelectValue /></SelectTrigger>
                <SelectContent style={{ background: '#1a1a1d', border: '1px solid rgba(255,255,255,0.06)' }}>{stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-white/50 text-[12px]">Fecha de cierre</Label><Input type="date" value={form.closing_date} onChange={e => set('closing_date', e.target.value)} className="mt-1 text-[13px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'white' }} /></div>
          <div><Label className="text-white/50 text-[12px]">Notas</Label><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="mt-1 text-[13px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'white' }} /></div>
          <div className="flex gap-2 pt-1">
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending} className="flex-1" style={{ background: '#8b7cf6' }}>{isEdit ? 'Guardar' : 'Crear'}</Button>
            {isEdit && <Button onClick={() => winMut.mutate()} variant="outline" className="gap-1" style={{ borderColor: 'rgba(34,197,94,0.3)', color: '#4ade80' }}><Trophy style={{ width: 14, height: 14 }} />Ganado</Button>}
            {isEdit && <Button onClick={() => { if (confirm('Eliminar?')) deleteMut.mutate(); }} variant="ghost" style={{ color: '#f87171' }}><Trash2 style={{ width: 14, height: 14 }} /></Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PipelinePage() {
  const qc = useQueryClient(); const { toast } = useToast();
  const { data: stages = [], isLoading } = useQuery({ queryKey: ["/api/pipeline/stages"], queryFn: () => api.getPipelineStages() as Promise<Stage[]>, staleTime: 15000 });
  const [modalOpen, setModalOpen] = useState(false); const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [defaultStage, setDefaultStage] = useState<string>();
  const moveMut = useMutation({ mutationFn: ({ dealId, stageId }: { dealId: string; stageId: string }) => api.moveDeal(dealId, stageId), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/pipeline/stages"] }) });

  const handleDragStart = (e: React.DragEvent, dealId: string) => { e.dataTransfer.setData("dealId", dealId); e.dataTransfer.effectAllowed = "move"; };
  const handleDrop = (e: React.DragEvent, stageId: string) => { const dealId = e.dataTransfer.getData("dealId"); if (dealId) moveMut.mutate({ dealId, stageId }); };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0c0c0e' }}>
      <header className="shrink-0 flex items-center justify-between px-6 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-3">
          <KanbanSquare style={{ width: 16, height: 16, color: '#a78bfa' }} />
          <h1 className="text-[15px] font-semibold text-white/90">Pipeline</h1>
          <span className="text-[11px] text-white/20 ml-1">{stages?.length || 0} etapas</span>
        </div>
        <Button onClick={() => { setEditingDeal(null); setDefaultStage(undefined); setModalOpen(true); }}
          size="sm" className="gap-1.5 rounded-xl text-[12px]" style={{ background: '#8b7cf6', color: 'white' }}>
          <Plus style={{ width: 13, height: 13 }} />Nuevo deal
        </Button>
      </header>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-white/20 text-sm">Cargando pipeline...</div>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 p-4 h-full items-start" style={{ minWidth: stages.length * 280 }}>
            {stages.map(stage => (
              <KanbanColumn key={stage.id} stage={stage} onDragStart={handleDragStart} onDrop={handleDrop}
                onAddDeal={(sid) => { setEditingDeal(null); setDefaultStage(sid); setModalOpen(true); }} onClickDeal={(d) => { setEditingDeal(d); setModalOpen(true); }} />
            ))}
          </div>
        </div>
      )}

      <DealModal open={modalOpen} onClose={() => setModalOpen(false)} stages={stages} deal={editingDeal} defaultStageId={defaultStage} />
    </div>
  );
}
