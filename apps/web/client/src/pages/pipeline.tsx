import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useRequireAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Plus, User, Calendar, DollarSign, Trash2, Trophy, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

interface Deal {
  id: string;
  title: string;
  value: string | null;
  currency: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "OPEN" | "WON" | "LOST";
  closing_date: string | null;
  notes: string | null;
  stage_id: string;
  contact: { id: string; full_name: string; company_name?: string | null } | null;
  assigned_user: { id: string; name: string } | null;
  created_at: string;
}

interface Stage {
  id: string;
  name: string;
  color: string;
  order: number;
  deals: Deal[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<Deal["priority"], string> = {
  LOW:    "text-muted-foreground",
  MEDIUM: "text-primary",
  HIGH:   "text-orange-500",
  URGENT: "text-destructive",
};

const PRIORITY_LABELS: Record<Deal["priority"], string> = {
  LOW: "Baja", MEDIUM: "Media", HIGH: "Alta", URGENT: "Urgente",
};

function fmtCRC(val: string | null, currency: string) {
  if (!val) return null;
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  return new Intl.NumberFormat("es-CR", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function columnTotal(deals: Deal[]) {
  const s = deals.reduce((acc, d) => acc + (d.value ? parseFloat(d.value) : 0), 0);
  if (s === 0) return null;
  return new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(s);
}

// ── Deal Card ────────────────────────────────────────────────────────────────

function DealCard({
  deal,
  onDragStart,
  onClick,
}: {
  deal: Deal;
  onDragStart: (e: React.DragEvent, dealId: string) => void;
  onClick: (deal: Deal) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal.id)}
      onClick={() => onClick(deal)}
      className="rounded-md p-3 cursor-pointer select-none transition-all hover:brightness-110 active:opacity-70 bg-[hsl(var(--bg-sidebar))] border border-border"
    >
      <div className="text-foreground text-[13px] font-medium leading-snug mb-2">{deal.title}</div>

      {deal.value && (
        <div className="flex items-center gap-1 mb-1.5">
          <DollarSign className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs font-semibold text-primary">
            {fmtCRC(deal.value, deal.currency)}
          </span>
        </div>
      )}

      {deal.contact && (
        <div className="flex items-center gap-1 mb-1 text-secondary-foreground">
          <User className="w-2.5 h-2.5" />
          <span className="text-[11px] truncate">{deal.contact.full_name}</span>
        </div>
      )}

      {deal.closing_date && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Calendar className="w-2.5 h-2.5" />
          <span className="text-[11px]">{format(new Date(deal.closing_date), "dd/MM/yy")}</span>
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <span className={cn("text-[10px] font-medium uppercase tracking-wide", PRIORITY_COLORS[deal.priority])}>
          {PRIORITY_LABELS[deal.priority]}
        </span>
        {deal.assigned_user && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--bg-active))] text-secondary-foreground">
            {deal.assigned_user.name.split(" ")[0]}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Column ───────────────────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  onDragStart,
  onDrop,
  onAddDeal,
  onClickDeal,
}: {
  stage: Stage;
  onDragStart: (e: React.DragEvent, dealId: string) => void;
  onDrop: (e: React.DragEvent, stageId: string) => void;
  onAddDeal: (stageId: string) => void;
  onClickDeal: (deal: Deal) => void;
}) {
  const [over, setOver] = useState(false);
  const total = columnTotal(stage.deals);

  return (
    <div
      className="flex flex-col shrink-0 w-[260px] rounded-lg bg-[hsl(var(--bg-sidebar)/0.5)] border border-border"
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { setOver(false); onDrop(e, stage.id); }}
    >
      {/* Header */}
      <div
        className="px-3 py-2.5 flex items-center gap-2 rounded-t-lg border-b border-border"
        style={{ borderLeft: `3px solid ${stage.color}` }}
      >
        <span className="flex-1 text-[13px] font-semibold text-foreground truncate">{stage.name}</span>
        <span
          className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{ background: `${stage.color}22`, color: stage.color }}
        >
          {stage.deals.length}
        </span>
      </div>

      {total && (
        <div className="px-3 py-1.5 border-b border-border">
          <span className="text-[11px] text-muted-foreground">{total}</span>
        </div>
      )}

      {/* Cards */}
      <div
        className={cn("flex-1 flex flex-col gap-2 p-2 min-h-[80px] transition-colors", over && "bg-muted/20")}
      >
        {stage.deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} onDragStart={onDragStart} onClick={onClickDeal} />
        ))}
        {stage.deals.length === 0 && (
          <div className="flex-1 flex items-center justify-center rounded text-[11px] text-muted-foreground min-h-[60px] border border-dashed border-border">
            Arrastra aquí
          </div>
        )}
      </div>

      {/* Add button */}
      <button
        onClick={() => onAddDeal(stage.id)}
        className="flex items-center gap-1.5 px-3 py-2 w-full hover:bg-muted/20 transition-colors rounded-b-lg border-t border-border text-muted-foreground text-xs"
      >
        <Plus className="w-3 h-3" />
        Agregar deal
      </button>
    </div>
  );
}

// ── Deal Modal ───────────────────────────────────────────────────────────────

interface DealFormData {
  title: string;
  value: string;
  currency: string;
  priority: Deal["priority"];
  stage_id: string;
  closing_date: string;
  notes: string;
  contact_id: string;
}

function DealModal({
  open,
  onClose,
  stages,
  deal,
  defaultStageId,
}: {
  open: boolean;
  onClose: () => void;
  stages: Stage[];
  deal?: Deal | null;
  defaultStageId?: string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const isEdit = !!deal;

  const [form, setForm] = useState<DealFormData>(() => ({
    title: deal?.title ?? "",
    value: deal?.value ?? "",
    currency: deal?.currency ?? "CRC",
    priority: deal?.priority ?? "MEDIUM",
    stage_id: deal?.stage_id ?? defaultStageId ?? stages[0]?.id ?? "",
    closing_date: deal?.closing_date ? deal.closing_date.slice(0, 10) : "",
    notes: deal?.notes ?? "",
    contact_id: deal?.contact?.id ?? "",
  }));

  const set = (k: keyof DealFormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const { data: contacts } = useQuery({
    queryKey: ["/api/contacts"],
    queryFn: () => api.getContacts(),
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: (data: Record<string, any>) => api.createDeal(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pipeline/stages"] }); onClose(); },
    onError: () => toast({ title: "Error al crear deal", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: (data: Record<string, any>) => api.updateDeal(deal!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pipeline/stages"] }); onClose(); },
    onError: () => toast({ title: "Error al actualizar deal", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.deleteDeal(deal!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pipeline/stages"] }); onClose(); },
    onError: () => toast({ title: "Error al eliminar deal", variant: "destructive" }),
  });

  const winMut = useMutation({
    mutationFn: () => api.winDeal(deal!.id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/pipeline/stages"] });
      onClose();
      toast({ title: `Deal ganado. Factura borrador ${data.invoice_number} creada.` });
      navigate("/invoices");
    },
    onError: (err) => {
      const msg = err?.message?.includes("contact") ? "Asigna un contacto al deal primero" : "Error al cerrar deal";
      toast({ title: msg, variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      title: form.title,
      stage_id: form.stage_id,
      value: form.value ? parseFloat(form.value) : undefined,
      currency: form.currency,
      priority: form.priority,
      closing_date: form.closing_date || undefined,
      notes: form.notes || undefined,
      contact_id: form.contact_id || undefined,
    };
    isEdit ? updateMut.mutate(payload) : createMut.mutate(payload);
  }

  const loading = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar deal" : "Nuevo deal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} required className="mt-1" placeholder="Ej: Propuesta empresa X" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor</Label>
              <Input type="number" value={form.value} onChange={e => set("value", e.target.value)} className="mt-1" placeholder="0" min={0} />
            </div>
            <div>
              <Label>Moneda</Label>
              <Select value={form.currency} onValueChange={v => set("currency", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRC">CRC</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Etapa</Label>
              <Select value={form.stage_id} onValueChange={v => set("stage_id", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridad</Label>
              <Select value={form.priority} onValueChange={v => set("priority", v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Baja</SelectItem>
                  <SelectItem value="MEDIUM">Media</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                  <SelectItem value="URGENT">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Contacto</Label>
            <Select value={form.contact_id || "__none__"} onValueChange={v => set("contact_id", v === "__none__" ? "" : v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Sin contacto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin contacto</SelectItem>
                {Array.isArray(contacts?.data ?? contacts)
                  ? (contacts?.data ?? contacts as any[]).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))
                  : null}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Fecha de cierre</Label>
            <Input type="date" value={form.closing_date} onChange={e => set("closing_date", e.target.value)} className="mt-1" />
          </div>

          <div>
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} className="mt-1" rows={3} placeholder="Observaciones..." />
          </div>

          {isEdit && deal?.status === "OPEN" && (
            <Button
              type="button"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={winMut.isPending}
              onClick={() => winMut.mutate()}
            >
              <Trophy className="w-3.5 h-3.5 mr-1.5" />
              {winMut.isPending ? "Procesando..." : "Marcar como Ganado → Generar Factura"}
            </Button>
          )}

          {isEdit && deal?.status !== "OPEN" && (
            <div className="text-center text-xs py-1.5 rounded bg-[hsl(var(--bg-active))] text-secondary-foreground">
              Deal {deal?.status === "WON" ? "ganado ✓" : "perdido"}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Guardando..." : isEdit ? "Guardar" : "Crear deal"}
            </Button>
            {isEdit && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                disabled={deleteMut.isPending}
                onClick={() => deleteMut.mutate()}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Pipeline() {
  useRequireAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const dragDealId = useRef<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [defaultStageId, setDefaultStageId] = useState<string | undefined>();

  const { data: stages = [], isLoading } = useQuery<Stage[]>({
    queryKey: ["/api/pipeline/stages"],
    queryFn: () => api.getPipelineStages() as Promise<Stage[]>,
    staleTime: 30_000,
  });

  const moveMut = useMutation({
    mutationFn: ({ dealId, stageId }: { dealId: string; stageId: string }) =>
      api.moveDeal(dealId, stageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/pipeline/stages"] }),
    onError: () => toast({ title: "Error al mover deal", variant: "destructive" }),
  });

  function handleDragStart(e: React.DragEvent, dealId: string) {
    dragDealId.current = dealId;
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    if (!dragDealId.current) return;
    moveMut.mutate({ dealId: dragDealId.current, stageId });
    dragDealId.current = null;
  }

  function openCreate(stageId: string) {
    setSelectedDeal(null);
    setDefaultStageId(stageId);
    setModalOpen(true);
  }

  function openEdit(deal: Deal) {
    setSelectedDeal(deal);
    setDefaultStageId(undefined);
    setModalOpen(true);
  }

  const totalValue = stages
    .flatMap(s => s.deals)
    .reduce((acc, d) => acc + (d.value ? parseFloat(d.value) : 0), 0);

  const totalFormatted = totalValue > 0
    ? new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(totalValue)
    : null;

  const totalDeals = stages.reduce((acc, s) => acc + s.deals.length, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 flex items-center justify-between border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-foreground">Pipeline de Ventas</h1>
          <p className="text-sm text-muted-foreground">
            {totalDeals} deal{totalDeals !== 1 ? "s" : ""}
            {totalFormatted && <> · <span className="text-primary">{totalFormatted}</span></>}
          </p>
        </div>
        <Button onClick={() => openCreate(stages[0]?.id ?? "")} size="sm">
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Nuevo deal
        </Button>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Cargando pipeline...
          </div>
        ) : stages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Trophy className="w-10 h-10 opacity-30" />
            <p className="text-sm">No hay etapas configuradas</p>
          </div>
        ) : (
          <div className="flex gap-4 p-6 h-full min-w-max">
            {stages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                onAddDeal={openCreate}
                onClickDeal={openEdit}
              />
            ))}
          </div>
        )}
      </div>

      <DealModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        stages={stages}
        deal={selectedDeal}
        defaultStageId={defaultStageId}
      />
    </div>
  );
}
