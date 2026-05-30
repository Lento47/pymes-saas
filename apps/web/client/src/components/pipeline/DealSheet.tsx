import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trophy, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useI18n } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";

const PRIORITIES = [
  { value: "LOW", label: "Baja", color: "bg-slate-500" },
  { value: "MEDIUM", label: "Media", color: "bg-yellow-500" },
  { value: "HIGH", label: "Alta", color: "bg-orange-500" },
  { value: "URGENT", label: "Urgente", color: "bg-red-500" },
] as const;

interface DealSheetProps {
  open: boolean;
  onClose: () => void;
  stages: Array<{ id: string; name: string; color?: string }>;
  deal?: Record<string, any>;
  defaultStageId?: string;
}

export function DealSheet({ open, onClose, stages, deal, defaultStageId }: DealSheetProps) {
  const { messages } = useI18n();
  const t = messages.pipeline;
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!deal;

  const [form, setForm] = useState({
    title: deal?.title ?? "",
    value: deal?.value ?? "",
    currency: deal?.currency ?? "CRC",
    priority: deal?.priority ?? "MEDIUM",
    stage_id: deal?.stage_id ?? defaultStageId ?? stages[0]?.id ?? "",
    closing_date: deal?.closing_date ? deal.closing_date.slice(0, 10) : "",
    notes: deal?.notes ?? "",
    contact_id: deal?.contact?.id ?? "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const { data: contacts } = useQuery({ queryKey: ["/api/contacts"], queryFn: () => api.getContacts(), staleTime: 30000 });

  const createMut = useMutation({
    mutationFn: (data: Record<string, any>) => api.createDeal(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pipeline/stages"] }); onClose(); },
    onError: () => toast({ title: "Error al crear deal", variant: "destructive" }),
  });
  const updateMut = useMutation({
    mutationFn: (data: Record<string, any>) => api.updateDeal(deal!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pipeline/stages"] }); onClose(); },
  });
  const deleteMut = useMutation({
    mutationFn: () => api.deleteDeal(deal!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pipeline/stages"] }); onClose(); },
  });
  const winMut = useMutation({
    mutationFn: () => api.winDeal(deal!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pipeline/stages"] }); onClose(); },
  });

  const handleSubmit = () => {
    if (!form.title) return;
    const data = { ...form, value: form.value ? parseFloat(form.value) : 0 };
    isEdit ? updateMut.mutate(data) : createMut.mutate(data);
  };

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:w-[520px] sm:max-w-[520px] p-0 gap-0 flex flex-col h-full">
        <SheetHeader className="px-6 py-4 border-b border-border/60 space-y-1 shrink-0">
          <SheetTitle className="text-sm font-semibold">
            {isEdit ? "Editar Deal" : "Nuevo Deal"}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Título <span className="text-red-400">*</span></Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Nombre del negocio o deal"
              className="h-9 text-xs bg-background border-border"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">{t.value}</Label>
              <Input
                type="number"
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
                placeholder="0"
                className="h-9 text-xs bg-background border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Moneda</Label>
              <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                <SelectTrigger className="h-9 text-xs bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRC">CRC — Colones</SelectItem>
                  <SelectItem value="USD">USD — Dólares</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Priority cards */}
          <div className="space-y-2">
            <Label className="text-[11px] text-muted-foreground">{t.value ? "Prioridad" : "Prioridad"}</Label>
            <div className="grid grid-cols-4 gap-2">
              {PRIORITIES.map((p) => {
                const isSelected = form.priority === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => set("priority", p.value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-center transition-all duration-200",
                      isSelected
                ? "border-primary/45 bg-primary/5"
                        : "border-border/60 bg-card/40 hover:bg-accent/40 hover:border-border"
                    )}
                  >
                    <div className={cn("w-3 h-3 rounded-full", p.color)} />
                    <span className="text-[11px] font-medium text-foreground">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">{t.stage}</Label>
            <Select value={form.stage_id} onValueChange={(v) => set("stage_id", v)}>
              <SelectTrigger className="h-9 text-xs bg-background border-border">
                <SelectValue placeholder="Seleccionar etapa" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color || "#8b7cf6" }} />
                      {s.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Fecha de cierre</Label>
            <Input
              type="date"
              value={form.closing_date}
              onChange={(e) => set("closing_date", e.target.value)}
              className="h-9 text-xs bg-background border-border"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Notas</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              placeholder="Detalles adicionales..."
              className="text-xs bg-background border-border resize-none"
            />
          </div>
        </div>

        <SheetFooter className="px-6 py-3 border-t border-border/60 shrink-0 flex-row justify-between sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            {isEdit && (
              <Button onClick={() => winMut.mutate()} variant="outline" size="sm" className="h-8 text-xs gap-1.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
                <Trophy className="w-3.5 h-3.5" />Ganado
              </Button>
            )}
            {isEdit && (
              <Button onClick={() => { if (confirm("¿Eliminar deal?")) deleteMut.mutate(); }} variant="ghost" size="sm" className="h-8 text-xs text-red-400 hover:text-red-300">
                <Trash2 className="w-3.5 h-3.5 mr-1" />Eliminar
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving} className="h-8 text-xs">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={isSaving || !form.title.trim()} className="h-8 text-xs gap-1.5">
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? "Guardar" : "Crear"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
