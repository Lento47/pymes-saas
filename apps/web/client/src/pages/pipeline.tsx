import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Plus, User, Calendar, DollarSign, Trash2, Trophy, GripVertical, KanbanSquare, Upload } from "lucide-react";
import { useLocation } from "wouter";
import { DealSheet } from "@/components/pipeline/DealSheet";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import CsvImportModal from "@/components/import/csv-import-modal";

interface Deal { id: string; title: string; value: string | null; currency: string; priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; status: "OPEN" | "WON" | "LOST"; closing_date: string | null; notes: string | null; stage_id: string; contact: { id: string; full_name: string; company_name?: string | null } | null; assigned_user: { id: string; name: string } | null; created_at: string; }

interface Stage { id: string; name: string; color: string; order: number; deals: Deal[]; }

const PRIORITY_COLORS: Record<Deal["priority"], string> = { LOW: "text-muted-foreground/50", MEDIUM: "text-[#a78bfa]", HIGH: "text-amber-400", URGENT: "text-rose-400", };
const PRIORITY_LABELS: Record<Deal["priority"], string> = { LOW: "Baja", MEDIUM: "Media", HIGH: "Alta", URGENT: "Urgente", };

function fmtCRC(val: string | null, currency: string) { if (!val) return null; const n = parseFloat(val); if (isNaN(n)) return null; return new Intl.NumberFormat("es-CR", { style: "currency", currency, maximumFractionDigits: 0 }).format(n); }
function columnTotal(deals: Deal[]) { const s = deals.reduce((acc, d) => acc + (d.value ? parseFloat(d.value) : 0), 0); if (s === 0) return null; return new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(s); }

function DealCard({ deal, onDragStart, onClick }: { deal: Deal; onDragStart: (e: React.DragEvent, dealId: string) => void; onClick: (deal: Deal) => void; }) {
  return (
    <div draggable onDragStart={(e) => onDragStart(e, deal.id)} onClick={() => onClick(deal)}
      className="rounded-xl p-3 cursor-grab active:cursor-grabbing select-none transition-all duration-200 hover:scale-[1.01] hover:shadow-lg active:opacity-70 group"
      style={{ background: 'hsl(var(--foreground)/0.015)', border: '1px solid hsl(var(--foreground)/0.04)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
      <div className="flex items-start gap-2">
        <GripVertical style={{ width: 12, height: 12, color: 'hsl(var(--fg-3))', marginTop: 2 }} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex-1 min-w-0">
          <div className="text-white text-[13px] font-medium leading-snug mb-2">{deal.title}</div>
          {deal.value && (
            <div className="flex items-center gap-1 mb-1.5">
              <DollarSign style={{ width: 10, height: 10 }} className="text-muted-foreground/40" />
              <span className="text-[12px] font-semibold text-[#a78bfa]">{fmtCRC(deal.value, deal.currency)}</span>
            </div>
          )}
          {deal.contact && (
            <div className="flex items-center gap-1 mb-1 text-muted-foreground/60">
              <User style={{ width: 10, height: 10 }} />
              <span className="text-[11px] truncate">{deal.contact.full_name}</span>
            </div>
          )}
          {deal.closing_date && (
            <div className="flex items-center gap-1 text-muted-foreground/40">
              <Calendar style={{ width: 10, height: 10 }} />
              <span className="text-[11px]">{format(new Date(deal.closing_date), "dd/MM/yy")}</span>
            </div>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className={cn("text-[10px] font-medium", PRIORITY_COLORS[deal.priority])}>{PRIORITY_LABELS[deal.priority]}</span>
            {deal.assigned_user && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full text-muted-foreground/50" style={{ background: 'hsl(var(--foreground)/0.04)' }}>
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
    <div       className="flex flex-col shrink-0 rounded-2xl transition-all duration-300 bg-foreground/[0.015]"
      style={{ width: 270, border: `1px solid ${over ? 'rgba(139,124,246,0.25)' : 'hsl(var(--border))'}` }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { setOver(false); onDrop(e, stage.id); }}>
      <div className="px-3 py-3 flex items-center gap-2 rounded-t-2xl" style={{ borderBottom: '1px solid hsl(var(--foreground)/0.04)' }}>
        <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
        <span className="flex-1 text-[13px] font-semibold text-foreground/85 truncate">{stage.name}</span>
        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${stage.color}18`, color: stage.color }}>{stage.deals.length}</span>
      </div>
      {total && <div className="px-3 py-1.5" style={{ borderBottom: '1px solid hsl(var(--foreground)/0.04)' }}><span className="text-[11px] text-muted-foreground/40">{total}</span></div>}
      <div className={cn("flex-1 flex flex-col gap-2 p-2 min-h-[80px] transition-colors", over && "bg-primary/[0.03]")}>
        {stage.deals.map(deal => <DealCard key={deal.id} deal={deal} onDragStart={onDragStart} onClick={onClickDeal} />)}
        {stage.deals.length === 0 && (
          <div className="flex-1 flex items-center justify-center rounded-xl text-[11px] text-muted-foreground/20" style={{ border: '1px dashed hsl(var(--foreground)/0.04)', minHeight: 60 }}>Arrastra aquí</div>
        )}
      </div>
      <button onClick={() => onAddDeal(stage.id)}
        className="flex items-center justify-center gap-1.5 px-3 py-2.5 w-full hover:bg-foreground/[0.015] transition-colors rounded-b-2xl text-muted-foreground/40 hover:text-muted-foreground/60"
        style={{ borderTop: '1px solid hsl(var(--foreground)/0.04)' }}>
        <Plus style={{ width: 12, height: 12 }} /><span style={{ fontSize: 12 }}>Agregar</span>
      </button>
    </div>
  );
}

export default function PipelinePage() {
  const qc = useQueryClient(); const { toast } = useToast();
  const { data: stages = [], isLoading } = useQuery({ queryKey: ["/api/pipeline/stages"], queryFn: () => api.getPipelineStages() as Promise<Stage[]>, staleTime: 15000 });
  const [modalOpen, setModalOpen] = useState(false); const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [defaultStage, setDefaultStage] = useState<string>();
  const moveMut = useMutation({ mutationFn: ({ dealId, stageId }: { dealId: string; stageId: string }) => api.moveDeal(dealId, stageId), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/pipeline/stages"] }) });

  const handleDragStart = (e: React.DragEvent, dealId: string) => { e.dataTransfer.setData("dealId", dealId); e.dataTransfer.effectAllowed = "move"; };
  const handleDrop = (e: React.DragEvent, stageId: string) => { const dealId = e.dataTransfer.getData("dealId"); if (dealId) moveMut.mutate({ dealId, stageId }); };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <header className="shrink-0 flex items-center justify-between px-6 py-3" style={{ borderBottom: '1px solid hsl(var(--foreground)/0.04)' }}>
        <div className="flex items-center gap-3">
          <KanbanSquare style={{ width: 16, height: 16, color: '#a78bfa' }} />
          <h1 className="text-[15px] font-semibold text-foreground">Pipeline</h1>
          <span className="text-[11px] text-muted-foreground/40 ml-1">{stages?.length || 0} etapas</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-1.5 rounded-xl text-[12px]">
            <Upload style={{ width: 13, height: 13 }} />Import CSV
          </Button>
          <Button onClick={() => { setEditingDeal(null); setDefaultStage(undefined); setModalOpen(true); }}
          size="sm" className="gap-1.5 rounded-xl text-[12px]" style={{ background: '#8b7cf6', color: 'hsl(var(--fg))' }}>
          <Plus style={{ width: 13, height: 13 }} />Nuevo deal
        </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground/40 text-sm">Cargando pipeline...</div>
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

      <DealSheet open={modalOpen} onClose={() => setModalOpen(false)} stages={stages} deal={editingDeal} defaultStageId={defaultStage} />
      <CsvImportModal open={importOpen} onClose={() => setImportOpen(false)} entityType="pipeline" />
    </div>
  );
}
